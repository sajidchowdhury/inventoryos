// GET/POST /api/businesses/[id]/cctv/kits
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const kits = await db.cCTVKitDefinition.findMany({
      where: { businessId, isActive: true },
      include: {
        _count: { select: { components: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(kits);
  } catch (error) {
    console.error("List kits error:", error);
    return NextResponse.json({ error: "Failed to list kits" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { name, slug: inputSlug, description, kitPrice, discountPercent, imageUrl, isActive, sortOrder } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Kit name is required" }, { status: 400 });
    }

    // Auto-generate slug from name
    let slug = (inputSlug || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug) {
      slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }

    if (slug.length < 2) {
      return NextResponse.json({ error: "Slug must be at least 2 characters" }, { status: 400 });
    }

    // Check uniqueness
    const existing = await db.cCTVKitDefinition.findFirst({
      where: { businessId, slug, isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: `Kit slug "${slug}" is already in use` }, { status: 409 });
    }

    const kit = await db.cCTVKitDefinition.create({
      data: {
        businessId,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        kitPrice: kitPrice ?? null,
        discountPercent: discountPercent ?? 0,
        imageUrl: imageUrl?.trim() || null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
      include: { _count: { select: { components: true } } },
    });

    return NextResponse.json(kit, { status: 201 });
  } catch (error) {
    console.error("Create kit error:", error);
    return NextResponse.json({ error: "Failed to create kit" }, { status: 500 });
  }
}