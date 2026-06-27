// POST /api/businesses/[id]/batches/[batchId]/return
// Record return of batch to supplier (with supplier name and reason)
// Body: {
//   supplierName: string,
//   reason: "expired" | "damaged" | "recall" | "wrong_supply" | "other",
//   quantity?: number,  // defaults to full batch quantity
//   creditExpected?: boolean,  // whether supplier credit is expected
//   notes?: string,
// }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_REASONS = ["expired", "damaged", "recall", "wrong_supply", "other"];

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;
    const body = await req.json();

    if (!body.supplierName || !body.supplierName.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    if (!body.reason || !VALID_REASONS.includes(body.reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` },
        { status: 400 }
      );
    }

    const batch = await db.batch.findFirst({
      where: { id: batchId, businessId },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const returnQty = body.quantity ? parseFloat(body.quantity) : batch.quantity;
    if (isNaN(returnQty) || returnQty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
    }

    if (returnQty > batch.quantity) {
      return NextResponse.json(
        { error: `Cannot return ${returnQty} ${batch.product.unit}. Batch only has ${batch.quantity} ${batch.product.unit}.` },
        { status: 400 }
      );
    }

    const isFullReturn = returnQty === batch.quantity;
    const valueReturned = (batch.purchasePrice || 0) * returnQty;

    // Update batch
    const newQuantity = batch.quantity - returnQty;
    let newStatus = batch.status;

    if (isFullReturn) {
      newStatus = "returned";
    } else {
      newStatus = calculateBatchStatus(batch.expiryDate);
    }

    const updatedBatch = await db.batch.update({
      where: { id: batchId },
      data: {
        quantity: newQuantity,
        status: newStatus,
        supplierId: body.supplierName.trim(), // store supplier name in supplierId field
      },
    });

    // Decrement inventory
    await db.inventory.updateMany({
      where: { productId: batch.productId },
      data: { quantity: { decrement: returnQty } },
    });

    // Create audit transaction
    const returnDetails = [
      `Return to supplier: ${body.supplierName}`,
      `Quantity: ${returnQty} ${batch.product.unit}`,
      `Reason: ${body.reason}`,
      body.creditExpected ? "Credit expected: Yes" : null,
      body.notes ? `Notes: ${body.notes}` : null,
      `Value returned: ৳${valueReturned.toFixed(2)}`,
    ].filter(Boolean).join(" | ");

    await db.transaction.create({
      data: {
        businessId,
        productId: batch.productId,
        batchId,
        type: "RETURN",
        quantity: returnQty,
        unitPrice: batch.purchasePrice,
        note: returnDetails,
      },
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: updatedBatch.id,
        batchNo: updatedBatch.batchNo,
        quantity: updatedBatch.quantity,
        status: updatedBatch.status,
        supplierId: updatedBatch.supplierId,
      },
      return: {
        supplierName: body.supplierName,
        quantity: returnQty,
        reason: body.reason,
        creditExpected: body.creditExpected || false,
        valueReturned,
        isFullReturn,
      },
      message: isFullReturn
        ? `Batch #${updatedBatch.batchNo} fully returned to ${body.supplierName} (${returnQty} ${batch.product.unit}). Status: returned. Value: ৳${valueReturned.toFixed(2)}`
        : `Returned ${returnQty} of ${batch.quantity} ${batch.product.unit} from batch #${updatedBatch.batchNo} to ${body.supplierName}. ${newQuantity} remaining. Value: ৳${valueReturned.toFixed(2)}`,
    });
  } catch (error) {
    console.error("Supplier return error:", error);
    return NextResponse.json({ error: "Failed to return batch to supplier" }, { status: 500 });
  }
}
