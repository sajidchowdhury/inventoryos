// POST /api/businesses/[id]/cctv/estimates/[estimateId]/convert
// Convert an estimate into a real sale (invoice)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id: businessId, estimateId } = await params;
  const body = await req.json();

  const estimate = await db.cCTVEstimate.findFirst({
    where: { id: estimateId, businessId },
    include: { items: true },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (estimate.status === "converted" || estimate.convertedSaleId) {
    return NextResponse.json({ error: "Estimate already converted" }, { status: 400 });
  }

  // Calculate total
  let totalAmount = 0;
  for (const item of estimate.items) {
    totalAmount += item.unitPrice * item.quantity;
  }

  const paidAmount = body.paidAmount !== undefined ? parseFloat(body.paidAmount) : 0;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // Create sale
  const sale = await db.cCTVSale.create({
    data: {
      businessId,
      customerId: estimate.customerId || null,
      customerName: estimate.customerName || null,
      invoiceNo: estimate.estimateNo?.replace("EST-", "INV-") || null,
      totalAmount,
      paidAmount,
      dueAmount,
      paymentType: dueAmount > 0 ? "credit" : "cash",
      saleDate: new Date(),
      notes: `Converted from estimate ${estimate.estimateNo}${estimate.projectTitle ? ` — ${estimate.projectTitle}` : ""}`,
    },
  });

  // Create sale items from estimate items
  for (const item of estimate.items) {
    await db.cCTVSaleItem.create({
      data: {
        saleId: sale.id,
        businessId,
        productId: item.productId || "unknown",
        productName: item.productName,
        quantity: item.quantity,
        sellPrice: item.unitPrice,
        costPrice: 0, // estimates don't track cost
        serialNumber: null, // estimates don't have serials
      },
    });

    // Decrement product stock if product was linked (with stock safety check)
    if (item.productId && item.productId !== "unknown") {
      try {
        const product = await db.cCTVProduct.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true },
        });
        if (product) {
          if (product.stock < item.quantity) {
            // Not enough stock — skip decrement but still create the sale item
            console.warn(`[convert] Insufficient stock for ${product.name}: ${product.stock} available, ${item.quantity} needed`);
          } else {
            await db.cCTVProduct.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      } catch {
        // Product may not exist — skip
      }
    }
  }

  // Record payment if any
  if (paidAmount > 0) {
    await db.cCTVPayment.create({
      data: {
        businessId,
        type: "sale",
        referenceId: sale.id,
        customerId: estimate.customerId || null,
        amount: paidAmount,
        paymentMethod: body.paymentMethod || "cash",
        paymentDate: new Date(),
        notes: `Payment for converted estimate ${estimate.estimateNo}`,
      },
    });
  }

  // Mark estimate as converted
  const updated = await db.cCTVEstimate.update({
    where: { id: estimateId },
    data: {
      status: "converted",
      convertedSaleId: sale.id,
    },
  });

  return NextResponse.json({ success: true, sale, estimate: updated }, { status: 201 });
}
