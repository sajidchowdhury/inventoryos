// GET/POST /api/businesses/[id]/cctv/products
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  // P-5: Pagination metadata — page/pageSize/total/totalPages so the UI can tell
  // whether more pages exist. Default pageSize=50 (matches earlier behaviour).
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50") || 50));
  const skip = (page - 1) * pageSize;
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
      skip,
      take: pageSize,
    }),
    db.cCTVProduct.count({ where }),
  ]);
  return NextResponse.json({
    success: true,
    products,
    total,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

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
