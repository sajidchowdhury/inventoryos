// GET/POST /api/businesses/[id]/purchases/[purchaseId]/returns
// GET: List returns for a purchase
// POST: Process a return to supplier (reduces stock, refunds from supplier)
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
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  try {
    const { id: businessId, purchaseId } = await params;

    const purchase = await db.purchase.findFirst({
      where: { id: purchaseId, businessId },
      include: {
        items: {
          include: {
            batch: { select: { id: true, batchNo: true, quantity: true, status: true } },
            product: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        purchaseNo: purchase.purchaseNo,
        supplierId: purchase.supplierId,
        status: purchase.status,
        totalAmount: purchase.totalAmount,
        paidAmount: purchase.paidAmount,
      },
      items: purchase.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        receivedQuantity: item.receivedQuantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalPrice: item.totalPrice,
        batchNo: item.batchNo,
        batchId: item.batchId,
        batchCurrentQty: item.batch?.quantity || 0,
        batchStatus: item.batch?.status || "unknown",
      })),
    });
  } catch (error) {
    console.error("Get purchase returns error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; purchaseId: string }> }
) {
  try {
    const { id: businessId, purchaseId } = await params;
    const body = await req.json();

    const purchase = await db.purchase.findFirst({
      where: { id: purchaseId, businessId },
      include: { items: true, supplier: true },
    });
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    if (purchase.status === "cancelled") {
      return NextResponse.json({ error: "Cannot return items from a cancelled purchase" }, { status: 400 });
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one return item is required" }, { status: 400 });
    }

    const validReasons = ["defective", "wrong_item", "expired", "damaged", "quality_issue", "other"];
    if (!body.reason || !validReasons.includes(body.reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${validReasons.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate each return item
    let totalRefund = 0;
    const returnItemsData = [];

    for (const item of body.items) {
      const purchaseItem = purchase.items.find((pi) => pi.id === item.purchaseItemId);
      if (!purchaseItem) {
        return NextResponse.json({ error: `Purchase item not found: ${item.purchaseItemId}` }, { status: 404 });
      }

      const returnQty = parseFloat(item.quantity);
      if (isNaN(returnQty) || returnQty <= 0) {
        return NextResponse.json({ error: "Return quantity must be positive" }, { status: 400 });
      }

      // Check batch has enough quantity
      if (purchaseItem.batchId) {
        const batch = await db.batch.findUnique({ where: { id: purchaseItem.batchId } });
        if (batch && returnQty > batch.quantity) {
          return NextResponse.json(
            { error: `Cannot return ${returnQty} ${purchaseItem.unit}. Batch ${purchaseItem.batchNo} only has ${batch.quantity} ${purchaseItem.unit} in stock.` },
            { status: 400 }
          );
        }
      }

      const refundAmount = returnQty * purchaseItem.unitCost;
      totalRefund += refundAmount;

      returnItemsData.push({
        purchaseItem,
        quantity: returnQty,
        refundAmount,
      });
    }

    // Cap refund to purchase total
    if (totalRefund > purchase.totalAmount) {
      totalRefund = purchase.totalAmount;
    }

    const restockToSupplier = body.restockToSupplier !== false; // default true

    // Process atomically
    const result = await db.$transaction(async (tx) => {
      // For each return item: reduce batch quantity + inventory
      for (const item of returnItemsData) {
        const { purchaseItem, quantity } = item;

        if (purchaseItem.batchId && restockToSupplier) {
          // Reduce batch quantity
          const batch = await tx.batch.update({
            where: { id: purchaseItem.batchId },
            data: { quantity: { decrement: quantity } },
          });

          // If batch reaches 0, mark as returned
          if (batch.quantity <= 0) {
            await tx.batch.update({
              where: { id: batch.id },
              data: { status: "returned" },
            });
          } else {
            // Recalc status
            const newStatus = calculateBatchStatus(batch.expiryDate);
            if (batch.status !== newStatus) {
              await tx.batch.update({
                where: { id: batch.id },
                data: { status: newStatus },
              });
            }
          }
        }

        if (restockToSupplier) {
          // Reduce inventory
          await tx.inventory.updateMany({
            where: { productId: purchaseItem.productId },
            data: { quantity: { decrement: quantity } },
          });
        }

        // Audit transaction
        await tx.transaction.create({
          data: {
            businessId,
            productId: purchaseItem.productId,
            batchId: purchaseItem.batchId,
            type: "RETURN",
            quantity: quantity,
            unitPrice: purchaseItem.unitCost,
            note: `Purchase return for ${purchase.purchaseNo} — ${body.reason}${body.notes ? `: ${body.notes}` : ""}`,
          },
        });
      }

      // Update purchase: reduce paidAmount if refund applies
      const newPaidAmount = Math.max(0, purchase.paidAmount - totalRefund);
      let newPaymentStatus = purchase.paymentStatus;
      if (newPaidAmount >= purchase.totalAmount) newPaymentStatus = "paid";
      else if (newPaidAmount > 0) newPaymentStatus = "partial";
      else newPaymentStatus = "unpaid";

      await tx.purchase.update({
        where: { id: purchaseId },
        data: { paidAmount: newPaidAmount, paymentStatus: newPaymentStatus },
      });

      // Update supplier balance + totals
      if (purchase.supplierId) {
        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: {
            balance: { decrement: totalRefund },
            totalPurchased: { decrement: totalRefund },
            totalPaid: { decrement: Math.min(totalRefund, purchase.paidAmount) },
          },
        });
      }

      return { totalRefund, newPaidAmount, newPaymentStatus };
    });

    return NextResponse.json({
      success: true,
      return: {
        purchaseNo: purchase.purchaseNo,
        supplier: purchase.supplier?.name || null,
        refundAmount: result.totalRefund,
        reason: body.reason,
        itemsReturned: body.items.length,
        restocked: restockToSupplier,
      },
      purchase: {
        paidAmount: result.newPaidAmount,
        paymentStatus: result.newPaymentStatus,
      },
      message: `Return processed for ${purchase.purchaseNo} — Refund: ৳${result.totalRefund.toFixed(2)}${restockToSupplier ? " — stock returned to supplier" : ""}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Process purchase return error:", error);
    return NextResponse.json({ error: "Failed to process return" }, { status: 500 });
  }
}
