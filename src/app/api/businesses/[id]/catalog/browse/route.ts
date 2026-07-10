// GET /api/businesses/[id]/catalog/browse
// Browse catalog by manufacturer. Returns manufacturers with product counts.
// Optional ?manufacturerId=xxx returns products for that manufacturer.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const manufacturerId = searchParams.get("manufacturerId");

  try {
    if (manufacturerId) {
      // Return products for a specific manufacturer
      const products = await db.masterProduct.findMany({
        where: { manufacturerId, isActive: true },
        orderBy: { name: "asc" },
      });

      // Mark subscribed
      const existing = await db.product.findMany({
        where: { businessId, masterProductId: { not: null } },
        select: { masterProductId: true },
      });
      const subSet = new Set(existing.map(p => p.masterProductId));

      return NextResponse.json({
        success: true,
        products: products.map(p => ({ ...p, subscribed: subSet.has(p.id) })),
        total: products.length,
      });
    } else {
      // Return all manufacturers with product counts
      const manufacturers = await db.masterManufacturer.findMany({
        where: { isActive: true, productCount: { gt: 0 } },
        orderBy: { productCount: "desc" },
        select: { id: true, name: true, productCount: true },
      });

      return NextResponse.json({ success: true, manufacturers, total: manufacturers.length });
    }
  } catch (error) {
    console.error("[catalog/browse] failed:", error);
    return NextResponse.json({ error: "Browse failed" }, { status: 500 });
  }
}
