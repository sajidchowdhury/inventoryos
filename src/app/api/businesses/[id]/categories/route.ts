// GET/POST /api/businesses/[id]/categories
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    // Top-level categories (no parent)
    const categories = await db.category.findMany({
      where: { businessId, isActive: true, parentId: null },
      include: {
        _count: { select: { products: true } },
        children: {
          where: { isActive: true },
          include: { _count: { select: { products: true } } },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // All categories flat
    const allCategories = await db.category.findMany({
      where: { businessId, isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, categories, allCategories });
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const category = await db.category.create({
      data: {
        businessId,
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        parentId: body.parentId || null,
        icon: body.icon || "Tag",
        color: body.color || "#6B7280",
        type: body.type || "medicine",
        sortOrder: body.sortOrder || 0,
      },
    });

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
