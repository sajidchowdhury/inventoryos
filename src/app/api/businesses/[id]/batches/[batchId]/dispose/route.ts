// POST /api/businesses/[id]/batches/[batchId]/dispose
// Records disposal/destruction of expired or unwanted stock
// Body: { reason: "expired" | "damaged" | "recall" | "quality_issue" | "other",
//         quantity: number,  // how much to dispose (can be partial)
//         disposalMethod?: "landfill" | "incineration" | "return_to_supplier" | "sewer" | "other",
//         witness?: string,  // name of witness (regulatory requirement)
//         notes?: string }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_REASONS = ["expired", "damaged", "recall", "quality_issue", "other"];
const VALID_METHODS = ["landfill", "incineration", "return_to_supplier", "sewer", "other"];

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

    // Validate reason
    if (!body.reason || !VALID_REASONS.includes(body.reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate quantity
    const disposeQty = parseFloat(body.quantity);
    if (isNaN(disposeQty) || disposeQty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
    }

    // Validate disposal method if provided
    if (body.disposalMethod && !VALID_METHODS.includes(body.disposalMethod)) {
      return NextResponse.json(
        { error: `Invalid disposal method. Must be one of: ${VALID_METHODS.join(", ")}` },
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

    if (disposeQty > batch.quantity) {
      return NextResponse.json(
        { error: `Cannot dispose ${disposeQty} ${batch.product.unit}. Batch only has ${batch.quantity} ${batch.product.unit}.` },
        { status: 400 }
      );
    }

    const isFullDisposal = disposeQty === batch.quantity;
    const valueLost = (batch.mrp || batch.purchasePrice || 0) * disposeQty;

    // Update batch: reduce quantity, update status if fully disposed
    const newQuantity = batch.quantity - disposeQty;
    let newStatus = batch.status;

    if (isFullDisposal) {
      newStatus = "destroyed";
    } else {
      // Partial disposal — keep status, but recalc in case expiry passed
      newStatus = calculateBatchStatus(batch.expiryDate);
    }

    const updatedBatch = await db.batch.update({
      where: { id: batchId },
      data: {
        quantity: newQuantity,
        status: newStatus,
        notes: isFullDisposal
          ? `[DISPOSED ${new Date().toISOString().split("T")[0]}] ${batch.notes || ""}`.trim()
          : batch.notes,
      },
    });

    // Decrement inventory
    await db.inventory.updateMany({
      where: { productId: batch.productId },
      data: { quantity: { decrement: disposeQty } },
    });

    // Create audit transaction with full disposal details
    const disposalDetails = [
      `Disposal: ${disposeQty} ${batch.product.unit}`,
      `Reason: ${body.reason}`,
      body.disposalMethod ? `Method: ${body.disposalMethod}` : null,
      body.witness ? `Witness: ${body.witness}` : null,
      body.notes ? `Notes: ${body.notes}` : null,
      `Value lost: ৳${valueLost.toFixed(2)}`,
    ].filter(Boolean).join(" | ");

    await db.transaction.create({
      data: {
        businessId,
        productId: batch.productId,
        batchId,
        type: "WASTE",
        quantity: disposeQty,
        unitPrice: batch.mrp || batch.purchasePrice,
        note: disposalDetails,
      },
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: updatedBatch.id,
        batchNo: updatedBatch.batchNo,
        quantity: updatedBatch.quantity,
        status: updatedBatch.status,
      },
      disposal: {
        quantity: disposeQty,
        reason: body.reason,
        method: body.disposalMethod || "unspecified",
        witness: body.witness || null,
        valueLost,
        isFullDisposal,
      },
      message: isFullDisposal
        ? `Batch #${updatedBatch.batchNo} fully disposed (${disposeQty} ${batch.product.unit}). Status: destroyed. Value lost: ৳${valueLost.toFixed(2)}`
        : `Disposed ${disposeQty} of ${batch.quantity} ${batch.product.unit} from batch #${updatedBatch.batchNo}. ${newQuantity} remaining. Value lost: ৳${valueLost.toFixed(2)}`,
    });
  } catch (error) {
    console.error("Dispose error:", error);
    return NextResponse.json({ error: "Failed to dispose batch" }, { status: 500 });
  }
}
