// GET/PUT /api/businesses/[id]/purchases/[purchaseId]
// GET: view purchase details
// PUT: update payment status or cancel purchase
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  try {
    const { id: businessId, purchaseId } = await params;

    const purchase = await db.purchase.findFirst({
      where: { id: purchaseId, businessId },
      include: {
        supplier: { select: { id: true, name: true, code: true, phone: true, email: true, address: true } },
        items: {
          include: {
            product: {
              select: {
                id: true, name: true, genericName: true, strength: true, unit: true,
                category: { select: { name: true, color: true } },
              },
            },
            batch: { select: { id: true, batchNo: true, expiryDate: true, status: true, quantity: true } },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, purchase });
  } catch (error) {
    console.error("Get purchase error:", error);
    return NextResponse.json({ error: "Failed to fetch purchase" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  try {
    const { id: businessId, purchaseId } = await params;
    const body = await req.json();

    const existing = await db.purchase.findFirst({
      where: { id: purchaseId, businessId },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // Handle payment update
    if (body.action === "update_payment") {
      const paidAmount = parseFloat(body.paidAmount);
      if (isNaN(paidAmount) || paidAmount < 0) {
        return NextResponse.json({ error: "paidAmount must be non-negative" }, { status: 400 });
      }

      let paymentStatus = "unpaid";
      if (paidAmount >= existing.totalAmount) paymentStatus = "paid";
      else if (paidAmount > 0) paymentStatus = "partial";

      const paymentDelta = paidAmount - existing.paidAmount;

      const purchase = await db.$transaction(async (tx) => {
        const updated = await tx.purchase.update({
          where: { id: purchaseId },
          data: { paidAmount, paymentStatus },
        });

        // Update supplier balance
        if (existing.supplierId) {
          await tx.supplier.update({
            where: { id: existing.supplierId },
            data: {
              balance: { decrement: paymentDelta },
              totalPaid: { increment: paymentDelta },
            },
          });
        }

        return updated;
      });

      return NextResponse.json({
        success: true,
        purchase,
        message: `Payment updated: ৳${paidAmount.toFixed(2)} / ৳${existing.totalAmount.toFixed(2)} (${paymentStatus})`,
      });
    }

    // Handle cancellation
    if (body.action === "cancel") {
      if (existing.status === "cancelled") {
        return NextResponse.json({ error: "Purchase is already cancelled" }, { status: 400 });
      }
      if (!body.cancelReason?.trim()) {
        return NextResponse.json({ error: "cancelReason is required" }, { status: 400 });
      }

      // Reverse stock movements (remove batches + reduce inventory)
      await db.$transaction(async (tx) => {
        for (const item of existing.items) {
          if (item.batchId) {
            // Delete the batch created by this purchase
            await tx.batch.delete({ where: { id: item.batchId } });
          }

          // Reduce inventory
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { quantity: { decrement: item.receivedQuantity } },
          });

          // Audit transaction
          await tx.transaction.create({
            data: {
              businessId,
              productId: item.productId,
              batchId: item.batchId,
              type: "ADJUSTMENT",
              quantity: -item.receivedQuantity,
              note: `Purchase ${existing.purchaseNo} cancelled — ${item.receivedQuantity} ${item.unit} removed`,
            },
          });
        }

        // Update purchase status
        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            status: "cancelled",
            notes: `CANCELLED: ${body.cancelReason.trim()}${existing.notes ? ` | ${existing.notes}` : ""}`,
          },
        });

        // Reverse supplier balance
        if (existing.supplierId) {
          await tx.supplier.update({
            where: { id: existing.supplierId },
            data: {
              totalPurchased: { decrement: existing.totalAmount },
              balance: { decrement: existing.totalAmount - existing.paidAmount },
              totalPaid: { decrement: existing.paidAmount },
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `Purchase ${existing.purchaseNo} cancelled. ${existing.items.length} batches deleted, stock removed.`,
      });
    }

    return NextResponse.json({ error: "Unknown action. Use 'cancel' or 'update_payment'." }, { status: 400 });
  } catch (error) {
    console.error("Update purchase error:", error);
    return NextResponse.json({ error: "Failed to update purchase" }, { status: 500 });
  }
}
