// GET/POST /api/businesses/[id]/products
// GET: List products with search & filters
// POST: Create a new product
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";
    const type = url.searchParams.get("type") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, isActive: true };
    if (category) where.categoryId = category;
    if (type) where.productType = type;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { genericName: { contains: search } },
        { manufacturer: { contains: search } },
        { barcode: { contains: search } },
        { rackNo: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          inventory: true,
          batches: {
            where: { status: "active" },
            select: { id: true, batchNo: true, expiryDate: true, quantity: true },
            orderBy: { expiryDate: "asc" },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const product = await db.product.create({
      data: {
        businessId,
        categoryId: body.categoryId || null,
        name: body.name,
        genericName: body.genericName || null,
        sku: body.sku || null,
        barcode: body.barcode || null,
        productType: body.productType || "medicine",
        unit: body.unit || "piece",
        stripSize: body.stripSize || null,
        boxSize: body.boxSize || null,
        strength: body.strength || null,
        dosageForm: body.dosageForm || null,
        manufacturer: body.manufacturer || null,
        scheduleType: body.scheduleType || null,
        hsnCode: body.hsnCode || null,
        vatRate: body.vatRate || 0,
        mrp: body.mrp || null,
        isPrescription: body.isPrescription || false,
        storageCondition: body.storageCondition || null,
        rackNo: body.rackNo || null,
        minStock: body.minStock || 0,
        maxStock: body.maxStock || 0,
        reorderLevel: body.reorderLevel || 0,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    // Create inventory record
    await db.inventory.create({
      data: {
        businessId,
        productId: product.id,
        quantity: 0,
        minStock: body.minStock || 0,
        unitCost: null,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
