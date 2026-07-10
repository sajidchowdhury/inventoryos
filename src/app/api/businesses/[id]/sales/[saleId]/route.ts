// GET/PUT /api/businesses/[id]/sales/[saleId]
// GET: view sale details
// PUT: update sale (cancel, mark as paid, etc.)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> }
) {
  try {
    const { id: businessId, saleId } = await params;

    const sale = await db.sale.findFirst({
      where: { id: saleId, businessId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, genericName: true, strength: true, category: { select: { name: true, color: true } } },
            },
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, sale });
  } catch (error) {
    console.error("Get sale error:", error);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> }
) {
  try {
    const { id: businessId, saleId } = await params;
    const body = await req.json();

    const existing = await db.sale.findFirst({
      where: { id: saleId, businessId },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Handle cancellation
    if (body.action === "cancel") {
      if (existing.status === "cancelled") {
        return NextResponse.json({ error: "Sale is already cancelled" }, { status: 400 });
      }
      if (!body.cancelReason || !body.cancelReason.trim()) {
        return NextResponse.json({ error: "cancelReason is required" }, { status: 400 });
      }

      // Reverse stock movements (restore batch + inventory quantities)
      await db.$transaction(async (tx) => {
        for (const item of existing.items) {
          if (item.batchId) {
            // Restore batch quantity
            const batch = await tx.batch.update({
              where: { id: item.batchId },
              data: { quantity: { increment: item.quantity } },
            });
            // Recalc status
            const newStatus = calculateBatchStatus(batch.expiryDate);
            if (batch.status !== newStatus) {
              await tx.batch.update({
                where: { id: batch.id },
                data: { status: newStatus },
              });
            }
          }

          // Restore inventory
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { increment: item.quantity } },
          });

          // Audit transaction for reversal
          await tx.transaction.create({
            data: {
              businessId,
              productId: item.productId,
              batchId: item.batchId,
              type: "RETURN",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              note: `Sale ${existing.invoiceNo} cancelled — stock returned (${item.quantity} ${item.unit})`,
            },
          });
        }

        // Update sale status
        await tx.sale.update({
          where: { id: saleId },
          data: {
            status: "cancelled",
            paymentStatus: "refunded",
            cancelledAt: new Date(),
            cancelledBy: body.cancelledBy || null,
            cancelReason: body.cancelReason.trim(),
          },
        });

        // Reverse customer stats if customer was linked
        if (existing.customerId) {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: {
              totalSpent: { decrement: existing.totalAmount },
              visitCount: { decrement: 1 },
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `Sale ${existing.invoiceNo} cancelled. Stock restored to inventory.`,
      });
    }

    // Handle payment status update
    if (body.action === "update_payment") {
      const paidAmount = parseFloat(body.paidAmount);
      if (isNaN(paidAmount) || paidAmount < 0) {
        return NextResponse.json({ error: "paidAmount must be a non-negative number" }, { status: 400 });
      }

      let paymentStatus = "paid";
      if (paidAmount < existing.totalAmount) paymentStatus = "partial";
      if (paidAmount <= 0) paymentStatus = "unpaid";

      const sale = await db.sale.update({
        where: { id: saleId },
        data: {
          paidAmount,
          paymentStatus,
          paymentMethod: body.paymentMethod || existing.paymentMethod,
        },
      });

      return NextResponse.json({
        success: true,
        sale,
        message: `Payment updated: ৳${paidAmount.toFixed(2)} / ৳${existing.totalAmount.toFixed(2)} (${paymentStatus})`,
      });
    }

    return NextResponse.json({ error: "Unknown action. Use 'cancel' or 'update_payment'." }, { status: 400 });
  } catch (error) {
    console.error("Update sale error:", error);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}
