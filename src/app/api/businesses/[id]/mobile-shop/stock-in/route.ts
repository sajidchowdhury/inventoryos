// POST /api/businesses/[id]/mobile-shop/stock-in
// IMEI-First Stock-In Workflow (1B)
// Validates uniqueness of serial numbers and IMEI within the business,
// creates SerialUnit records with IN_STOCK status, and logs history.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface StockInItem {
  serialNumber: string;
  imei?: string;
  costPrice?: number;
  sellPrice?: number;
  grade?: string;
  notes?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const productId: string = body.productId;
    const items: StockInItem[] = body.items;
    const purchaseId: string | undefined = body.purchaseId || undefined;
    const supplierId: string | undefined = body.supplierId || undefined;

    if (!productId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "productId and items array are required" }, { status: 400 });
    }

    // Validate purchaseId if provided
    if (purchaseId) {
      const purchase = await db.mSPurchase.findFirst({
        where: { id: purchaseId, businessId },
      });
      if (!purchase) {
        return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
      }
    }

    // Validate supplierId if provided
    if (supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId, businessId, isActive: true },
      });
      if (!supplier) {
        return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
      }
    }

    // Verify product exists and belongs to this business
    const product = await db.mSProduct.findFirst({
      where: { id: productId, businessId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // ── Validate uniqueness ──
    const serialNumbers = items.map((i) => i.serialNumber?.trim()).filter(Boolean);
    const imeiNumbers = items.map((i) => i.imei?.trim()).filter(Boolean);

    // Check for duplicates within the batch itself
    const batchDuplicateSerials: string[] = [];
    const batchDuplicateImeis: string[] = [];
    const seenSerials = new Set<string>();
    const seenImeis = new Set<string>();

    for (const item of items) {
      const sn = item.serialNumber?.trim().toLowerCase();
      const im = item.imei?.trim();
      if (sn) {
        if (seenSerials.has(sn)) batchDuplicateSerials.push(item.serialNumber.trim());
        seenSerials.add(sn);
      }
      if (im) {
        if (seenImeis.has(im)) batchDuplicateImeis.push(im);
        seenImeis.add(im);
      }
    }

    // Check for duplicates against existing database records
    const existingSerials = serialNumbers.length > 0
      ? await db.mSSerialItem.findMany({
          where: { businessId, serialNumber: { in: serialNumbers } },
          select: { serialNumber: true },
        })
      : [];

    const existingImeis = imeiNumbers.length > 0
      ? await db.mSSerialItem.findMany({
          where: { businessId, imei: { in: imeiNumbers }, isActive: true },
          select: { imei: true, serialNumber: true },
        })
      : [];

    const existingSerialSet = new Set(existingSerials.map((e) => e.serialNumber.toLowerCase()));
    const existingImeiSet = new Set(existingImeis.map((e) => e.imei?.toLowerCase()).filter(Boolean));

    // Build duplicate report
    const duplicates: { serialNumber: string; reason: string }[] = [];

    for (const item of items) {
      const sn = item.serialNumber.trim();
      const snLower = sn.toLowerCase();
      const im = item.imei?.trim();

      if (batchDuplicateSerials.includes(sn)) {
        duplicates.push({ serialNumber: sn, reason: "Duplicate serial in this batch" });
      } else if (existingSerialSet.has(snLower)) {
        duplicates.push({ serialNumber: sn, reason: "Serial number already exists" });
      }

      if (im) {
        if (batchDuplicateImeis.includes(im)) {
          duplicates.push({ serialNumber: sn || im, reason: "Duplicate IMEI in this batch" });
        } else if (existingImeiSet.has(im.toLowerCase())) {
          const existingImeiRecord = existingImeis.find((e) => e.imei?.toLowerCase() === im.toLowerCase());
          duplicates.push({ serialNumber: sn || im, reason: `IMEI already used by SN: ${existingImeiRecord?.serialNumber || 'unknown'}` });
        }
      }
    }

    // If any duplicates, reject the entire batch
    if (duplicates.length > 0) {
      return NextResponse.json({
        success: false,
        error: `${duplicates.length} duplicate(s) found. Fix and retry.`,
        duplicates,
        validCount: items.length - duplicates.length,
      }, { status: 409 });
    }

    // ── Create Serial Items + History in a sequential operation ──
    // TODO (future): wrap in a Prisma $transaction for atomicity.
    // The current sequential approach works but is not atomic — if a later
    // operation fails, earlier ones are not rolled back.
    const now = new Date();
    const createdItems: string[] = [];

    for (const item of items) {
      const warrantyMonths = item.grade === 'C' || item.grade === 'D'
        ? Math.max(0, (product.warrantyMonths || 0) - 3) // Refurbished/used get reduced warranty
        : (product.warrantyMonths || 0);

      const serialItem = await db.mSSerialItem.create({
        data: {
          businessId,
          productId,
          serialNumber: item.serialNumber.trim(),
          imei: item.imei?.trim() || null,
          status: "IN_STOCK",
          grade: item.grade || null,
          conditionNotes: item.notes || null,
          costPrice: item.costPrice ?? product.costPrice,
          sellPrice: item.sellPrice ?? product.sellPrice,
          purchaseDate: now,
          warrantyMonths,
          // warrantyStart/warrantyEnd not set until sold
          source: "STOCK_IN",
          notes: item.notes || null,
          // Procurement traceability (Phase 1D)
          purchaseId: purchaseId || null,
          supplierId: supplierId || null,
        },
      });

      // Create history entry
      await db.mSSerialItemHistory.create({
        data: {
          businessId,
          serialItemId: serialItem.id,
          fromStatus: null,
          toStatus: "IN_STOCK",
          event: "STOCKED",
          notes: item.grade
            ? `Grade ${item.grade} stock-in${supplierId ? ' via supplier' : ''}${purchaseId ? ` (PO ref)` : ''}${item.notes ? ': ' + item.notes : ''}`
            : (item.notes || "Stocked in"),
          referenceId: purchaseId || null,
          referenceType: purchaseId ? "PURCHASE" : null,
        },
      });

      createdItems.push(serialItem.id);
    }

    // ── Sync stock count on the product ──
    const inStockCount = await db.mSSerialItem.count({
      where: { productId, businessId, status: "IN_STOCK", isActive: true },
    });

    await db.mSProduct.update({
      where: { id: productId },
      data: { stock: inStockCount },
    });

    return NextResponse.json({
      success: true,
      created: createdItems.length,
      serialItemIds: createdItems,
      newStockCount: inStockCount,
    }, { status: 201 });

  } catch (error) {
    console.error("CCTV Stock-In error:", error);
    return NextResponse.json({ error: "Stock-in failed. Please try again." }, { status: 500 });
  }
}