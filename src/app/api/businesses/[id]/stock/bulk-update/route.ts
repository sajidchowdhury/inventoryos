// POST /api/businesses/[id]/stock/bulk-update
// Apply N stock counts in one request. Designed for the Shelf Scanner's "Save
// all" button but reusable for CSV import, cycle counts, or any bulk stock
// adjustment flow.
//
// Option A (stock count adjustment):
//   For each item, set Inventory.quantity to the entered absolute value and
//   write an ADJUSTMENT Transaction for the delta (signed) — positive if the
//   count is higher than system stock, negative if lower. This keeps a full
//   audit trail without touching Batch.quantity or expiry tracking.
//
// Data architecture rule (CRITICAL):
//   This endpoint writes Inventory + Transaction + (optionally) Product client
//   fields (sellingPrice, reorderLevel, rackNo). It NEVER writes MasterProduct,
//   Batch, or any master/catalog table.
//
// Partial success semantics:
//   Each item is its own atomic $transaction (Inventory + Transaction + Product
//   + ShelfScanItem stamp). If one item fails, the others still apply. The
//   response reports exactly what applied, what skipped, and what errored.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── Types ──

interface BulkUpdateItem {
  shelfScanItemId?: string; // optional — links back to the scan item for appliedAt
  productId: string;        // required — which client Product to update
  newQuantity: number;      // required — absolute new stock count (>= 0)
  sellingPrice?: number;    // optional — update Product.sellingPrice
  reorderLevel?: number;    // optional — update Product.reorderLevel
  rackNo?: string;          // optional — update Product.rackNo
}

interface BulkUpdateBody {
  scanId?: string;          // optional — the ShelfScan this batch belongs to
  items: BulkUpdateItem[];
}

interface ItemResult {
  shelfScanItemId?: string;
  productId: string;
  status: "applied" | "skipped" | "error";
  error?: string;
  previousQuantity?: number;
  newQuantity?: number;
  delta?: number;
}

// ── Limits ──
const MAX_ITEMS_PER_BATCH = 100; // hard cap to prevent abuse

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    const body = (await req.json()) as BulkUpdateBody;

    // ── 1. Validate ──
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "No items provided. Send an array of stock updates." },
        { status: 400 }
      );
    }
    if (body.items.length > MAX_ITEMS_PER_BATCH) {
      return NextResponse.json(
        {
          error: `Too many items in one batch (max ${MAX_ITEMS_PER_BATCH}). Received ${body.items.length}. Please split into smaller batches.`,
        },
        { status: 400 }
      );
    }

    // Validate each item's shape before touching the DB.
    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i];
      if (!it.productId || typeof it.productId !== "string") {
        return NextResponse.json(
          { error: `Item ${i + 1}: productId is required.` },
          { status: 400 }
        );
      }
      if (typeof it.newQuantity !== "number" || isNaN(it.newQuantity) || it.newQuantity < 0) {
        return NextResponse.json(
          { error: `Item ${i + 1}: newQuantity must be a non-negative number.` },
          { status: 400 }
        );
      }
      if (it.sellingPrice !== undefined && (typeof it.sellingPrice !== "number" || it.sellingPrice < 0)) {
        return NextResponse.json(
          { error: `Item ${i + 1}: sellingPrice must be a non-negative number.` },
          { status: 400 }
        );
      }
      if (it.reorderLevel !== undefined && (typeof it.reorderLevel !== "number" || it.reorderLevel < 0)) {
        return NextResponse.json(
          { error: `Item ${i + 1}: reorderLevel must be a non-negative number.` },
          { status: 400 }
        );
      }
      if (it.rackNo !== undefined && typeof it.rackNo !== "string") {
        return NextResponse.json(
          { error: `Item ${i + 1}: rackNo must be a string.` },
          { status: 400 }
        );
      }
    }

    // ── 2. If scanId provided, verify it belongs to this business ──
    if (body.scanId) {
      const scan = await db.shelfScan.findFirst({
        where: { id: body.scanId, businessId },
        select: { id: true },
      });
      if (!scan) {
        return NextResponse.json(
          { error: "Scan not found or does not belong to this business." },
          { status: 404 }
        );
      }
    }

    // ── 3. Process each item (per-item atomic, partial success) ──
    const results: ItemResult[] = [];
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const item of body.items) {
      try {
        const result = await applyOneItem(businessId, body.scanId || null, item);
        results.push(result);
        if (result.status === "applied") appliedCount++;
        else if (result.status === "skipped") skippedCount++;
        else errorCount++;
      } catch (err) {
        // Shouldn't reach here (applyOneItem catches internally), but guard anyway.
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          shelfScanItemId: item.shelfScanItemId,
          productId: item.productId,
          status: "error",
          error: msg,
        });
        errorCount++;
      }
    }

    // ── 4. Return summary ──
    return NextResponse.json({
      success: true,
      scanId: body.scanId || null,
      applied: appliedCount,
      skipped: skippedCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    console.error("Bulk stock update error:", error);
    return NextResponse.json(
      { error: "Failed to apply stock updates. Please try again." },
      { status: 500 }
    );
  }
}

// ── Per-item apply (atomic via $transaction) ──
//
// Steps:
//   1. Verify the Product belongs to this business (security: don't let a user
//      update another business's stock).
//   2. Read current Inventory.quantity (0 if no Inventory row exists yet).
//   3. Compute delta = newQuantity - currentQuantity.
//   4. Upsert Inventory to the new absolute quantity.
//   5. If delta !== 0, create an ADJUSTMENT Transaction with the signed delta
//      and a human-readable note.
//   6. Update optional Product fields (sellingPrice, reorderLevel, rackNo) if
//      provided — these are client-side fields, NEVER master fields.
//   7. If shelfScanItemId provided, stamp appliedAt + set newQuantity on the
//      ShelfScanItem.
//   8. If delta === 0 AND no optional field updates, skip (no change needed).

async function applyOneItem(
  businessId: string,
  scanId: string | null,
  item: BulkUpdateItem
): Promise<ItemResult> {
  // 1. Verify product ownership
  const product = await db.product.findFirst({
    where: { id: item.productId, businessId },
    select: { id: true, name: true, unit: true },
  });
  if (!product) {
    return {
      shelfScanItemId: item.shelfScanItemId,
      productId: item.productId,
      status: "error",
      error: "Product not found or does not belong to this business.",
    };
  }

  // 2. Read current inventory
  const existingInv = await db.inventory.findUnique({
    where: { productId: item.productId },
    select: { quantity: true },
  });
  const currentQuantity = existingInv?.quantity ?? 0;
  const delta = item.newQuantity - currentQuantity;

  const hasOptionalUpdates =
    item.sellingPrice !== undefined ||
    item.reorderLevel !== undefined ||
    item.rackNo !== undefined;

  // 3. Skip if nothing to do
  if (delta === 0 && !hasOptionalUpdates) {
    // Still stamp the scan item as "applied" (counted, no change needed)
    if (item.shelfScanItemId) {
      await db.shelfScanItem.update({
        where: { id: item.shelfScanItemId },
        data: { appliedAt: new Date(), newQuantity: item.newQuantity },
      });
    }
    return {
      shelfScanItemId: item.shelfScanItemId,
      productId: item.productId,
      status: "skipped",
      previousQuantity: currentQuantity,
      newQuantity: item.newQuantity,
      delta: 0,
    };
  }

  // 4. Build the transaction operations
  //    Using the array form of $transaction so all ops commit or roll back together.
  const ops: Promise<unknown>[] = [];

  // 4a. Upsert Inventory to the new absolute quantity
  ops.push(
    db.inventory.upsert({
      where: { productId: item.productId },
      update: { quantity: item.newQuantity },
      create: {
        businessId,
        productId: item.productId,
        quantity: item.newQuantity,
      },
    })
  );

  // 4b. Create ADJUSTMENT Transaction (only if stock actually changed)
  if (delta !== 0) {
    const deltaSign = delta > 0 ? "+" : "";
    const note = `Shelf scan: counted ${item.newQuantity}, was ${currentQuantity} (${deltaSign}${delta})`;
    ops.push(
      db.transaction.create({
        data: {
          businessId,
          productId: item.productId,
          batchId: null, // shelf scan is product-level, not batch-level
          type: "ADJUSTMENT",
          quantity: delta, // signed: + for stock found, - for stock missing
          note,
        },
      })
    );
  }

  // 4c. Update optional Product client fields (NOT master fields)
  if (hasOptionalUpdates) {
    const productUpdate: Record<string, unknown> = {};
    if (item.sellingPrice !== undefined) productUpdate.sellingPrice = item.sellingPrice;
    if (item.reorderLevel !== undefined) productUpdate.reorderLevel = item.reorderLevel;
    if (item.rackNo !== undefined) productUpdate.rackNo = item.rackNo;
    ops.push(
      db.product.update({
        where: { id: item.productId },
        data: productUpdate,
      })
    );
  }

  // 4d. Stamp the ShelfScanItem (if linked)
  if (item.shelfScanItemId) {
    ops.push(
      db.shelfScanItem.update({
        where: { id: item.shelfScanItemId },
        data: {
          appliedAt: new Date(),
          newQuantity: item.newQuantity,
        },
      })
    );
  }

  // 5. Execute atomically
  await db.$transaction(ops);

  return {
    shelfScanItemId: item.shelfScanItemId,
    productId: item.productId,
    status: "applied",
    previousQuantity: currentQuantity,
    newQuantity: item.newQuantity,
    delta,
  };
}
