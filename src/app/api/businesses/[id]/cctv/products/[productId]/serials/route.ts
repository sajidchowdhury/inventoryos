// GET/POST /api/businesses/[id]/cctv/products/[productId]/serials
// GET: List serial items for a product with status/search filters and pagination
// POST: Bulk-add serial items to a product, auto-calculate warrantyEnd, sync stock count
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  try {
    const { id: businessId, productId } = await params;
    const url = req.nextUrl;
    const status = url.searchParams.get("status") || "";
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, productId, isActive: true };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { serialNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      db.cCTVSerialItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.cCTVSerialItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get CCTV serial items error:", error);
    return NextResponse.json({ error: "Failed to fetch serial items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; productId: string }> }) {
  try {
    const { id: businessId, productId } = await params;
    const body = await req.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    // Verify product exists
    const product = await db.cCTVProduct.findFirst({
      where: { id: productId, businessId, isActive: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Build serial item records
    const serialItems = body.items.map(
      (item: { serialNumber: string; costPrice?: number; sellPrice?: number; warrantyStart?: string; notes?: string }) => {
        const warrantyStart = item.warrantyStart ? new Date(item.warrantyStart) : new Date();
        const warrantyEnd = product.warrantyMonths > 0
          ? new Date(warrantyStart.getTime() + product.warrantyMonths * 30.44 * 24 * 60 * 60 * 1000)
          : null;

        return {
          businessId,
          productId,
          serialNumber: item.serialNumber,
          status: "in-stock" as const,
          costPrice: item.costPrice ?? null,
          sellPrice: item.sellPrice ?? null,
          purchaseDate: new Date(),
          warrantyStart,
          warrantyEnd,
          notes: item.notes || null,
        };
      }
    );

    // Bulk create all serial items
    const created = await db.cCTVSerialItem.createMany({
      data: serialItems,
    });

    // Sync stock: count of in-stock serial items for this product
    const inStockCount = await db.cCTVSerialItem.count({
      where: { productId, businessId, status: "in-stock", isActive: true },
    });

    await db.cCTVProduct.update({
      where: { id: productId },
      data: { stock: inStockCount },
    });

    return NextResponse.json({
      success: true,
      created: created.count,
      stock: inStockCount,
    }, { status: 201 });
  } catch (error) {
    console.error("Create CCTV serial items error:", error);
    return NextResponse.json({ error: "Failed to create serial items" }, { status: 500 });
  }
}