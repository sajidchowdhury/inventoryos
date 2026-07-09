// POST /api/businesses/[id]/batches/[batchId]/adjust
// Adjust stock for a specific batch (in/out/waste/return)
// Body: { type: "STOCK_IN" | "STOCK_OUT" | "WASTE" | "RETURN", quantity: number, note?: string }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_TYPES = ["STOCK_IN", "STOCK_OUT", "WASTE", "RETURN"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; batchId: string }> }
) {
  try {
    const { id: businessId, batchId } = await params;
    const body = await req.json();

    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const qty = parseFloat(body.quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
    }

    const batch = await db.batch.findFirst({
      where: { id: batchId, businessId },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Determine direction: positive for IN/RETURN, negative for OUT/WASTE
    const isPositive = body.type === "STOCK_IN" || body.type === "RETURN";
    const delta = isPositive ? qty : -qty;

    // For OUT/WASTE, check that batch has enough quantity
    if (!isPositive && batch.quantity + delta < 0) {
      return NextResponse.json(
        { error: `Insufficient stock. Batch has ${batch.quantity} ${batch.product.unit}(s), cannot remove ${qty}.` },
        { status: 400 }
      );
    }

    // Update batch quantity
    const updatedBatch = await db.batch.update({
      where: { id: batchId },
      data: { quantity: { increment: delta } },
    });

    // Update inventory
    await db.inventory.updateMany({
      where: { productId: batch.productId },
      data: { quantity: { increment: delta } },
    });

    // Create audit transaction
    await db.transaction.create({
      data: {
        businessId,
        productId: batch.productId,
        batchId,
        type: body.type,
        quantity: qty, // always positive in Transaction; direction implied by type
        unitPrice: batch.purchasePrice,
        note: body.note || `${body.type}: ${qty} ${batch.product.unit}(s) for batch ${batch.batchNo}`,
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
      message: `${body.type.replace("_", " ")}: ${qty} ${batch.product.unit}(s) — new stock: ${updatedBatch.quantity}`,
    });
  } catch (error) {
    console.error("Adjust stock error:", error);
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 });
  }
}
