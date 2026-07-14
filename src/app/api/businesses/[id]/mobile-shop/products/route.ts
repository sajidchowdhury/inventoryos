// GET/POST /api/businesses/[id]/mobile-shop/products
// GET: List CCTV products with search, category, brand, serialTracked filters and pagination
// POST: Create a new CCTV product
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const brand = url.searchParams.get("brand") || "";
    const serialTracked = url.searchParams.get("serialTracked") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (category) where.categoryId = category;
    // Case-insensitive brand search (PostgreSQL mode:"insensitive" — restored in Phase 2A).
    if (brand) where.brand = { contains: brand, mode: "insensitive" };
    if (serialTracked === "true") where.serialTracked = true;
    else if (serialTracked === "false") where.serialTracked = false;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      db.mSProduct.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true, slug: true } },
          masterProduct: { select: { id: true, name: true, brand: true, model: true } },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.mSProduct.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get CCTV products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!body.name || !body.brand) {
      return NextResponse.json({ error: "Product name and brand are required" }, { status: 400 });
    }

    const product = await db.mSProduct.create({
      data: {
        businessId,
        categoryId: body.categoryId || null,
        masterProductId: body.masterProductId || null,
        name: body.name,
        brand: body.brand,
        model: body.model || null,
        sku: body.sku || null,
        description: body.description || null,
        hsnCode: body.hsnCode || null,
        costPrice: body.costPrice ?? 0,
        sellPrice: body.sellPrice ?? 0,
        mrp: body.mrp ?? null,
        vatRate: body.vatRate ?? 0,
        stock: body.stock ?? 0,
        unit: body.unit || "piece",
        minStock: body.minStock ?? 0,
        maxStock: body.maxStock ?? 0,
        serialTracked: body.serialTracked ?? false,
        warrantyMonths: body.warrantyMonths ?? 0,
        imageUrl: body.imageUrl || null,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true, slug: true } },
        masterProduct: { select: { id: true, name: true, brand: true, model: true } },
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("Create CCTV product error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}