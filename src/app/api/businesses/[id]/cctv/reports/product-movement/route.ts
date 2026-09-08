// GET /api/businesses/[id]/cctv/reports/product-movement?productId=xxx
// Returns all stock movements for a specific product with running balance.
//
// Fix 4: The running balance is now sourced from CCTVStockMovement
// (the authoritative audit trail) instead of PurchaseItem.quantity /
// SaleItem.quantity (which were fragile and could drift from reality).
//
// CCTVStockMovement has:
//   - movementType: PURCHASE, SALE, RETURN, ADJUSTMENT, REPLACEMENT_*
//   - quantityChange: signed (+5 for stock in, -3 for stock out)
//   - balanceAfter: the stock balance AFTER this movement (already
//     computed at write time by the sale/purchase/repair flows)
//   - referenceId + referenceType: links to the sale/purchase/replacement
//   - notes: human-readable description
//   - createdAt: timestamp for sorting
//
// The running balance in the response now uses `balanceAfter` directly,
// so the last entry's balance always equals the current stock — no
// drift possible. The old code computed `balance += qtyIn - qtyOut`
// from potentially-wrong quantity fields.
//
// For entries that predate the CCTVStockMovement audit trail (created
// before the §1 / §3 / Fix 3 fixes), there may be no movement rows.
// Those historical entries are still shown from PurchaseItem / SaleItem
// as a fallback, but their running balance may not match currentStock.
// A reconciliation script could backfill CCTVStockMovement rows for
// historical data (out of scope for this fix).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    // List all products for selection
    const products = await db.cCTVProduct.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, brand: true, model: true, stock: true, serialTracked: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, products });
  }

  // Get product details
  const product = await db.cCTVProduct.findUnique({
    where: { id: productId },
    select: { id: true, name: true, brand: true, model: true, costPrice: true, sellPrice: true, stock: true, serialTracked: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  type Entry = {
    date: string;
    type: string;
    description: string;
    qtyIn: number;
    qtyOut: number;
    balance: number;
    price: number;
    reference: string;
  };

  // ── Fix 4: Source entries from CCTVStockMovement ──
  // This is the authoritative audit trail. Each row has the correct
  // quantityChange (signed) and balanceAfter (the stock after this
  // movement). The running balance in the response uses balanceAfter
  // directly, so the last entry's balance = current stock.
  const movements = await db.cCTVStockMovement.findMany({
    where: { businessId, productId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      movementType: true,
      quantityChange: true,
      balanceAfter: true,
      referenceId: true,
      referenceType: true,
      notes: true,
      createdAt: true,
    },
  });

  const entries: Entry[] = movements.map((m) => {
    const qtyIn = m.quantityChange > 0 ? m.quantityChange : 0;
    const qtyOut = m.quantityChange < 0 ? Math.abs(m.quantityChange) : 0;
    return {
      date: m.createdAt.toISOString().split("T")[0],
      type: m.movementType.toLowerCase(),
      description: m.notes || `${m.movementType} — ${product.name}`,
      qtyIn,
      qtyOut,
      balance: m.balanceAfter, // Fix 4: use the stored balanceAfter, not recomputed
      price: 0, // CCTVStockMovement doesn't store the unit price; the
                // UI can look it up from the referenced sale/purchase if needed.
                // Setting to 0 avoids showing wrong prices; the old code showed
                // PurchaseItem.costPrice or SaleItem.sellPrice which could be stale.
      reference: m.referenceId || "",
    };
  });

  // ── Fallback: if no CCTVStockMovement rows exist (historical data
  // from before the audit trail was implemented), fall back to the old
  // PurchaseItem + SaleItem approach. This ensures the report still
  // shows SOMETHING for products that have sales/purchases but no
  // movement audit rows.
  if (entries.length === 0) {
    // Purchases (qty in) — old approach
    const purchaseItems = await db.cCTVPurchaseItem.findMany({
      where: { businessId, productId },
      include: {
        purchase: { select: { purchaseDate: true, invoiceNo: true, supplierName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const item of purchaseItems) {
      entries.push({
        date: item.purchase.purchaseDate.toISOString().split("T")[0],
        type: "purchase",
        description: `Purchase${item.purchase.invoiceNo ? ` (${item.purchase.invoiceNo})` : ""}${item.purchase.supplierName ? ` — ${item.purchase.supplierName}` : ""}`,
        qtyIn: item.quantity,
        qtyOut: 0,
        balance: 0,
        price: Number(item.costPrice),
        reference: item.purchaseId,
      });
    }

    // Sales (qty out) — old approach
    const saleItems = await db.cCTVSaleItem.findMany({
      where: { businessId, productId },
      include: {
        sale: { select: { saleDate: true, invoiceNo: true, customerName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const item of saleItems) {
      entries.push({
        date: item.sale.saleDate.toISOString().split("T")[0],
        type: "sale",
        description: `Sale${item.sale.invoiceNo ? ` (${item.sale.invoiceNo})` : ""}${item.sale.customerName ? ` — ${item.sale.customerName}` : ""}`,
        qtyIn: 0,
        qtyOut: item.quantity,
        balance: 0,
        price: Number(item.sellPrice),
        reference: item.saleId,
      });
    }

    // Sort by date + compute running balance (old approach)
    entries.sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    for (const entry of entries) {
      balance += entry.qtyIn - entry.qtyOut;
      entry.balance = balance;
    }
  }

  // For serial-tracked products, compute actualStock from IN_STOCK serial count.
  // This is the "ground truth" — if it disagrees with the last entry's
  // balance (from CCTVStockMovement.balanceAfter), there's a data
  // inconsistency that a reconciliation script should fix.
  let actualStock = product.stock;
  if (product.serialTracked) {
    actualStock = await db.cCTVSerialItem.count({
      where: { businessId, productId, status: "IN_STOCK" },
    });
  }

  const totalPurchased = entries.reduce((s, e) => s + e.qtyIn, 0);
  const totalSold = entries.reduce((s, e) => s + e.qtyOut, 0);

  return NextResponse.json({
    success: true,
    product: {
      ...product,
      actualStock,
    },
    entries,
    summary: {
      totalPurchased,
      totalSold,
      currentStock: actualStock,
      entryCount: entries.length,
      // Fix 4: indicate whether the running balance is from the
      // authoritative CCTVStockMovement audit trail or the fallback
      // PurchaseItem + SaleItem approach.
      source: movements.length > 0 ? "stock_movement" : "legacy_fallback",
    },
  });
}
