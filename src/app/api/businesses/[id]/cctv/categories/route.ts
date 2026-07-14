// GET/POST /api/businesses/[id]/cctv/categories
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const categories = await db.cCTVCategory.findMany({
    where: { businessId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ success: true, categories });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const slug = body.slug || name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const category = await db.cCTVCategory.create({
    data: { businessId, name, slug, icon: body.icon || "Package", color: body.color || "#7c3aed" },
  });
  return NextResponse.json(category, { status: 201 });
}
