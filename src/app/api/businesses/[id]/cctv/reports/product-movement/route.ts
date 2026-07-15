// GET /api/businesses/[id]/cctv/reports/product-movement?productId=xxx
// Returns all purchases and sales for a specific product
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

  const entries: Entry[] = [];

  // Purchases (qty in)
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
      price: item.costPrice,
      reference: item.purchaseId,
    });
  }

  // Sales (qty out)
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
      price: item.sellPrice,
      reference: item.saleId,
    });
  }

  // Sort by date
  entries.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate running balance
  let balance = 0;
  for (const entry of entries) {
    balance += entry.qtyIn - entry.qtyOut;
    entry.balance = balance;
  }

  // For serial-tracked products, adjust balance to match actual serial count
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
    },
  });
}
