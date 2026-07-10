// GET/PUT/DELETE /api/businesses/[id]/batches/[batchId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const now = new Date();
  const diffDays = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;

    const batch = await db.batch.findFirst({
      where: { id: batchId, businessId },
      include: {
        product: {
          select: {
            id: true, name: true, genericName: true, strength: true,
            dosageForm: true, manufacturer: true, unit: true, mrp: true,
            scheduleType: true, isPrescription: true,
            category: { select: { id: true, name: true, color: true } },
            inventory: { select: { quantity: true, minStock: true } },
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, batch });
  } catch (error) {
    console.error("Get batch error:", error);
    return NextResponse.json({ error: "Failed to fetch batch" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;
    const body = await req.json();

    const existing = await db.batch.findFirst({
      where: { id: batchId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Compute quantity delta if quantity is being updated
    let quantityDelta = 0;
    if (body.quantity !== undefined) {
      const newQty = parseFloat(body.quantity);
      quantityDelta = newQty - existing.quantity;
    }

    // Recalculate status if expiry is changing
    let newStatus = existing.status;
    if (body.expiryDate) {
      newStatus = calculateBatchStatus(new Date(body.expiryDate));
    }

    const batch = await db.batch.update({
      where: { id: batchId },
      data: {
        batchNo: body.batchNo ?? existing.batchNo,
        mfgDate: body.mfgDate ? new Date(body.mfgDate) : existing.mfgDate,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : existing.expiryDate,
        quantity: body.quantity !== undefined ? parseFloat(body.quantity) : existing.quantity,
        purchasePrice: body.purchasePrice !== undefined
          ? (body.purchasePrice ? parseFloat(body.purchasePrice) : null)
          : existing.purchasePrice,
        mrp: body.mrp !== undefined
          ? (body.mrp ? parseFloat(body.mrp) : null)
          : existing.mrp,
        status: body.status ?? newStatus,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
      },
    });

    // Sync inventory if quantity changed
    if (quantityDelta !== 0) {
      await db.inventory.updateMany({
        where: { productId: existing.productId },
        data: { quantity: { increment: quantityDelta } },
      });

      // Audit transaction
      await db.transaction.create({
        data: {
          businessId,
          productId: existing.productId,
          batchId,
          type: "ADJUSTMENT",
          quantity: quantityDelta,
          note: `Batch ${batch.batchNo} quantity adjusted by ${quantityDelta > 0 ? "+" : ""}${quantityDelta}`,
        },
      });
    }

    return NextResponse.json({ success: true, batch });
  } catch (error) {
    console.error("Update batch error:", error);
    return NextResponse.json({ error: "Failed to update batch" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;

    const existing = await db.batch.findFirst({
      where: { id: batchId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Decrement inventory by batch quantity
    await db.inventory.updateMany({
      where: { productId: existing.productId },
      data: { quantity: { decrement: existing.quantity } },
    });

    // Audit transaction
    await db.transaction.create({
      data: {
        businessId,
        productId: existing.productId,
        batchId,
        type: "ADJUSTMENT",
        quantity: -existing.quantity,
        note: `Batch ${existing.batchNo} deleted`,
      },
    });

    // Hard delete batch (it's a transactional record, not soft-deletable)
    await db.batch.delete({ where: { id: batchId } });

    return NextResponse.json({ success: true, message: "Batch deleted" });
  } catch (error) {
    console.error("Delete batch error:", error);
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }
}
