// POST /api/businesses/[id]/batches/[batchId]/quarantine
// Body: { reason: "damaged" | "suspected" | "recall" | "quality_issue" | "other", notes?: string }
// Sets batch.status to "quarantined" and removes it from FEFO rotation
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_REASONS = ["damaged", "suspected", "recall", "quality_issue", "other"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;
    const body = await req.json();

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

    if (batch.status === "quarantined") {
      return NextResponse.json({ error: "Batch is already quarantined" }, { status: 400 });
    }

    if (batch.quantity <= 0) {
      return NextResponse.json({ error: "Cannot quarantine a batch with zero quantity" }, { status: 400 });
    }

    const previousStatus = batch.status;

    // Update batch status to quarantined
    const updatedBatch = await db.batch.update({
      where: { id: batchId },
      data: { status: "quarantined" },
    });

    // Create audit transaction
    await db.transaction.create({
      data: {
        businessId,
        productId: batch.productId,
        batchId,
        type: "QUARANTINE",
        quantity: batch.quantity,
        note: `Quarantined: ${body.reason}${body.notes ? ` — ${body.notes}` : ""} (was ${previousStatus})`,
      },
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: updatedBatch.id,
        batchNo: updatedBatch.batchNo,
        status: updatedBatch.status,
        quantity: updatedBatch.quantity,
      },
      message: `Batch #${updatedBatch.batchNo} quarantined (${body.reason}). Removed from FEFO rotation.`,
    });
  } catch (error) {
    console.error("Quarantine error:", error);
    return NextResponse.json({ error: "Failed to quarantine batch" }, { status: 500 });
  }
}

// DELETE /api/businesses/[id]/batches/[batchId]/quarantine
// Release a batch from quarantine back to its calculated status
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;

    const batch = await db.batch.findFirst({
      where: { id: batchId, businessId },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (batch.status !== "quarantined") {
      return NextResponse.json({ error: "Batch is not quarantined" }, { status: 400 });
    }

    // Recalculate proper status based on expiry
    const diffDays = (batch.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const newStatus = diffDays < 0 ? "expired" : diffDays <= 90 ? "near_expiry" : "active";

    const updatedBatch = await db.batch.update({
      where: { id: batchId },
      data: { status: newStatus },
    });

    await db.transaction.create({
      data: {
        businessId,
        productId: batch.productId,
        batchId,
        type: "RELEASE",
        quantity: batch.quantity,
        note: `Released from quarantine → ${newStatus}`,
      },
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: updatedBatch.id,
        batchNo: updatedBatch.batchNo,
        status: updatedBatch.status,
        quantity: updatedBatch.quantity,
      },
      message: `Batch released from quarantine. New status: ${newStatus}.`,
    });
  } catch (error) {
    console.error("Release quarantine error:", error);
    return NextResponse.json({ error: "Failed to release batch" }, { status: 500 });
  }
}
