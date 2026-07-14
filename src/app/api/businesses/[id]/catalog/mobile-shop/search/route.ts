// GET /api/businesses/[id]/catalog/mobile-shop/search
// Search the CCTV master catalog. Returns products with 'subscribed' flag
// indicating if this CCTV shop already carries them.
//
// Query: ?q=Hikvision&brand=Hikvision&limit=50&offset=0

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const brand = searchParams.get("brand") || "";
  const category = searchParams.get("category") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    // Build search query on MSMasterProduct
    const where: Record<string, unknown> = { isActive: true, isApproved: true };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { hsnCode: { contains: q, mode: "insensitive" } },
      ];
    }
    if (brand) where.brand = { contains: brand, mode: "insensitive" };
    if (category) where.defaultCategoryName = { contains: category, mode: "insensitive" };

    // Get master products
    const [products, total] = await Promise.all([
      db.mSMasterProduct.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        include: {
          manufacturer: { select: { id: true, name: true } },
        },
      }),
      db.mSMasterProduct.count({ where }),
    ]);

    // Get this shop's existing MSProduct masterProductId list
    const existingProducts = await db.mSProduct.findMany({
      where: { businessId, masterProductId: { not: null } },
      select: { masterProductId: true, isActive: true },
    });
    const subscribedSet = new Set(existingProducts.map(p => p.masterProductId));

    // Mark each product with subscribed flag
    const results = products.map(p => ({
      ...p,
      subscribed: subscribedSet.has(p.id),
    }));

    return NextResponse.json({ success: true, products: results, total, limit, offset });
  } catch (error) {
    console.error("[catalog/mobile-shop/search] failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
