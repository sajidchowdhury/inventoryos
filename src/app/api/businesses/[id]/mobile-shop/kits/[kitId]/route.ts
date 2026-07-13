// GET/PUT/DELETE /api/businesses/[id]/mobile-shop/kits/[kitId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  try {
    const { id: businessId, kitId } = await params;
    const kit = await db.mSKitDefinition.findFirst({
      where: { id: kitId, businessId, isActive: true },
      include: {
        components: {
          include: { product: { select: { id: true, name: true, brand: true, sellPrice: true, stock: true, serialTracked: true, imageUrl: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    return NextResponse.json(kit);
  } catch (error) {
    console.error("Get kit error:", error);
    return NextResponse.json({ error: "Failed to get kit" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  try {
    const { id: businessId, kitId } = await params;
    const body = await req.json();
    const { name, slug, description, kitPrice, discountPercent, imageUrl, isActive, sortOrder } = body;

    const existing = await db.mSKitDefinition.findFirst({
      where: { id: kitId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    // Check slug uniqueness if changed
    if (slug && slug.trim() !== existing.slug) {
      const slugClean = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const dup = await db.mSKitDefinition.findFirst({
        where: { businessId, slug: slugClean, isActive: true, id: { not: kitId } },
      });
      if (dup) {
        return NextResponse.json({ error: `Kit slug "${slugClean}" is already in use` }, { status: 409 });
      }
    }

    const updated = await db.mSKitDefinition.update({
      where: { id: kitId },
      data: {
        name: name?.trim() || undefined,
        slug: slug?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        kitPrice: kitPrice !== undefined ? (kitPrice ?? null) : undefined,
        discountPercent: discountPercent !== undefined ? discountPercent : undefined,
        imageUrl: imageUrl !== undefined ? (imageUrl?.trim() || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined,
      },
      include: { _count: { select: { components: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update kit error:", error);
    return NextResponse.json({ error: "Failed to update kit" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  try {
    const { id: businessId, kitId } = await params;

    const kit = await db.mSKitDefinition.findFirst({
      where: { id: kitId, businessId, isActive: true },
    });
    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    // Soft delete — cascade will remove components
    await db.mSKitDefinition.update({
      where: { id: kitId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete kit error:", error);
    return NextResponse.json({ error: "Failed to delete kit" }, { status: 500 });
  }
}