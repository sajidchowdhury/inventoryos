// GET/PUT/DELETE /api/businesses/[id]/cctv/categories/[categoryId]
// GET: Get a single CCTV category
// PUT: Update a CCTV category
// DELETE: Soft-delete a CCTV category (set isActive=false)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  try {
    const { id: businessId, categoryId } = await params;

    const category = await db.cCTVCategory.findFirst({
      where: { id: categoryId, businessId, isActive: true },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Get CCTV category error:", error);
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  try {
    const { id: businessId, categoryId } = await params;
    const body = await req.json();

    const existing = await db.cCTVCategory.findFirst({
      where: { id: categoryId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      updateData.name = name;
      // Re-generate slug when name changes
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const category = await db.cCTVCategory.update({
      where: { id: categoryId },
      data: updateData,
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Update CCTV category error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  try {
    const { id: businessId, categoryId } = await params;

    const existing = await db.cCTVCategory.findFirst({
      where: { id: categoryId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await db.cCTVCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Delete CCTV category error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}