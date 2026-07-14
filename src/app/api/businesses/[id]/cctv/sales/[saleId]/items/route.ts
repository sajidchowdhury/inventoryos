// POST /api/businesses/[id]/cctv/sales/[saleId]/items
// Add a new item to an existing sale (editable invoices)
// Recalculates total, updates due if no new payment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; saleId: string }> }) {
  const { id: businessId, saleId } = await params;
  const body = await req.json();

  const sale = await db.cCTVSale.findFirst({
    where: { id: saleId, businessId },
    include: { items: true },
  });

  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  if (!body.productName) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  // Create new sale item
  const newItem = await db.cCTVSaleItem.create({
    data: {
      saleId,
      businessId,
      productId: body.productId || "unknown",
      productName: body.productName,
      quantity: parseInt(body.quantity) || 1,
      sellPrice: parseFloat(body.sellPrice) || 0,
      costPrice: parseFloat(body.costPrice) || 0,
      serialNumber: body.serialNumber || null,
    },
  });

  // Recalculate total
  const allItems = [...sale.items, newItem];
  const newTotal = allItems.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
  const newDue = Math.max(0, newTotal - sale.paidAmount);

  // Update sale
  const updatedSale = await db.cCTVSale.update({
    where: { id: saleId },
    data: {
      totalAmount: newTotal,
      dueAmount: newDue,
      paymentType: newDue > 0 ? "credit" : "cash",
    },
  });

  // Decrement stock if product is linked and non-serial
  if (body.productId && body.productId !== "unknown" && !body.serialNumber) {
    try {
      await db.cCTVProduct.update({
        where: { id: body.productId },
        data: { stock: { decrement: parseInt(body.quantity) || 1 } },
      });
    } catch {}
  }

  return NextResponse.json({ success: true, sale: updatedSale, newItem }, { status: 201 });
}
