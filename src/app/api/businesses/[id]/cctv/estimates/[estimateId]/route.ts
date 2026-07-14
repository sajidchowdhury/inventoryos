// GET/PATCH/DELETE /api/businesses/[id]/cctv/estimates/[estimateId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id: businessId, estimateId } = await params;

  const estimate = await db.cCTVEstimate.findFirst({
    where: { id: estimateId, businessId },
    include: { items: true },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, estimate });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id: businessId, estimateId } = await params;
  const body = await req.json();

  const existing = await db.cCTVEstimate.findFirst({
    where: { id: estimateId, businessId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Update basic fields
  const updateData: Record<string, unknown> = {};
  if (body.customerId !== undefined) updateData.customerId = body.customerId || null;
  if (body.customerName !== undefined) updateData.customerName = body.customerName || null;
  if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone || null;
  if (body.projectTitle !== undefined) updateData.projectTitle = body.projectTitle || null;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes || null;
  if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null;

  // If items provided, replace all items
  if (body.items && Array.isArray(body.items)) {
    // Delete existing items
    await db.cCTVEstimateItem.deleteMany({ where: { estimateId } });
    // Create new items
    let totalAmount = 0;
    for (const item of body.items) {
      totalAmount += (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity) || 1);
      await db.cCTVEstimateItem.create({
        data: {
          estimateId,
          businessId,
          productId: item.productId || null,
          productName: item.productName,
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          notes: item.notes || null,
        },
      });
    }
    updateData.totalAmount = totalAmount;
  }

  const updated = await db.cCTVEstimate.update({
    where: { id: estimateId },
    data: updateData,
    include: { items: true },
  });

  return NextResponse.json({ success: true, estimate: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; estimateId: string }> }) {
  const { id: businessId, estimateId } = await params;

  const existing = await db.cCTVEstimate.findFirst({
    where: { id: estimateId, businessId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Don't allow deleting converted estimates
  if (existing.status === "converted" || existing.convertedSaleId) {
    return NextResponse.json({ error: "Cannot delete a converted estimate" }, { status: 400 });
  }

  await db.cCTVEstimate.delete({ where: { id: estimateId } });

  return NextResponse.json({ success: true });
}
