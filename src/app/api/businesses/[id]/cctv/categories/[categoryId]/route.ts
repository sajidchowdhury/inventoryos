// PATCH/DELETE /api/businesses/[id]/cctv/categories/[categoryId]
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { slugify, uniqueCategorySlug } from "@/lib/cctv-slug";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id: businessId, categoryId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

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
    // C-3: Use the shared unique-slug helper. Previously PATCH auto-regenerated
    // the slug from the new name without checking for collisions with other
    // categories → P2002 on rename if the new name's slug was taken.
    // Now we exclude this category's own id from the uniqueness check, and
    // append -2, -3, ... if needed.
    const requestedSlug = body.slug ? slugify(body.slug) : slugify(body.name);
    updateData.slug = await uniqueCategorySlug(businessId, requestedSlug, categoryId);
  }
  if (body.color !== undefined) updateData.color = body.color;
  if (body.icon !== undefined) updateData.icon = body.icon;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  try {
    const updated = await db.cCTVCategory.update({
      where: { id: categoryId },
      data: updateData,
    });
    return NextResponse.json({ success: true, category: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Another category with that name already exists. Try a different name." },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id: businessId, categoryId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

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
