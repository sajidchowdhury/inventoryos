// GET/PUT/DELETE /api/businesses/[id]/categories/[categoryId]
// Individual category operations
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: businessId, categoryId } = await params;

    const category = await db.category.findFirst({
      where: { id: categoryId, businessId, isActive: true },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { isActive: true },
          include: { _count: { select: { products: true } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Get category error:", error);
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: businessId, categoryId } = await params;
    const body = await req.json();

    const existing = await db.category.findFirst({
      where: { id: categoryId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Prevent circular hierarchy: a category cannot be its own parent
    if (body.parentId === categoryId) {
      return NextResponse.json({ error: "Category cannot be its own parent" }, { status: 400 });
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: {
        name: body.name ?? existing.name,
        slug: body.slug ?? existing.slug,
        icon: body.icon ?? existing.icon,
        color: body.color ?? existing.color,
        type: body.type ?? existing.type,
        sortOrder: body.sortOrder ?? existing.sortOrder,
        parentId: body.parentId !== undefined ? body.parentId : existing.parentId,
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: businessId, categoryId } = await params;

    const existing = await db.category.findFirst({
      where: { id: categoryId, businessId, isActive: true },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Safety: prevent deletion if category has products
    if (existing._count.products > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${existing._count.products} product(s) still assigned to this category. Reassign them first.` },
        { status: 400 }
      );
    }

    // Safety: prevent deletion if category has children
    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${existing._count.children} subcategory(s) exist. Delete them first.` },
        { status: 400 }
      );
    }

    // Soft delete
    await db.category.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: "Category deleted" });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
