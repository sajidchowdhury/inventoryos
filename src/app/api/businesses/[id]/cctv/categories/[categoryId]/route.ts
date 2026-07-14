// PATCH/DELETE /api/businesses/[id]/cctv/categories/[categoryId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id: businessId, categoryId } = await params;
  const body = await req.json();

  const existing = await db.cCTVCategory.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) {
    updateData.name = body.name;
    updateData.slug = body.name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  }
  if (body.color !== undefined) updateData.color = body.color;
  if (body.icon !== undefined) updateData.icon = body.icon;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const updated = await db.cCTVCategory.update({
    where: { id: categoryId },
    data: updateData,
  });

  return NextResponse.json({ success: true, category: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id: businessId, categoryId } = await params;

  const existing = await db.cCTVCategory.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // Unlink products from this category (set categoryId to null)
  await db.cCTVProduct.updateMany({
    where: { categoryId },
    data: { categoryId: null },
  });

  await db.cCTVCategory.delete({ where: { id: categoryId } });

  return NextResponse.json({ success: true });
}
