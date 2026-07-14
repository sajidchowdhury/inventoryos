// GET/POST /api/businesses/[id]/cctv/products
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const where: Record<string, unknown> = { businessId, isActive: true };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  const [products, total] = await Promise.all([
    db.cCTVProduct.findMany({
      where,
      include: { category: { select: { id: true, name: true, color: true, icon: true, slug: true } } },
      orderBy: { name: "asc" },
      take: 50,
    }),
    db.cCTVProduct.count({ where }),
  ]);
  return NextResponse.json({ success: true, products, total });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();
  if (!body.name || !body.brand) {
    return NextResponse.json({ error: "Name and brand are required" }, { status: 400 });
  }
  const product = await db.cCTVProduct.create({
    data: {
      businessId,
      categoryId: body.categoryId || null,
      name: body.name,
      brand: body.brand,
      model: body.model || null,
      sku: body.sku || null,
      description: body.description || null,
      costPrice: body.costPrice || 0,
      sellPrice: body.sellPrice || 0,
      stock: body.stock || 0,
      unit: body.unit || "piece",
      minStock: body.minStock || 0,
      serialTracked: body.serialTracked ?? false,
      warrantyMonths: body.warrantyMonths || 0,
      imageUrl: body.imageUrl || null,
    },
    include: { category: { select: { id: true, name: true, color: true, icon: true, slug: true } } },
  });
  return NextResponse.json({ success: true, product }, { status: 201 });
}
