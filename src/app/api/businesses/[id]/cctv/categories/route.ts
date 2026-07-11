// GET/POST /api/businesses/[id]/cctv/categories
// GET: List all active CCTV categories sorted by sortOrder asc, name asc
// POST: Create a new CCTV category
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    const categories = await db.cCTVCategory.findMany({
      where: { businessId, isActive: true },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Get CCTV categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Case-insensitive unique name check (SQLite compatible — no mode:"insensitive")
    const allCats = await db.cCTVCategory.findMany({
      where: { businessId, isActive: true },
      select: { name: true },
    });
    const nameLower = name.toLowerCase();
    if (allCats.some((c) => c.name.toLowerCase() === nameLower)) {
      return NextResponse.json({ error: `Category "${name}" already exists` }, { status: 409 });
    }

    // Generate slug from name: lowercase, replace spaces/special chars with hyphens
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const category = await db.cCTVCategory.create({
      data: {
        businessId,
        name,
        slug,
        icon: body.icon || "Package",
        color: body.color || "#7c3aed",
        sortOrder: body.sortOrder ?? 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Create CCTV category error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}