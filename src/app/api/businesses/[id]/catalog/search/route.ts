// GET /api/businesses/[id]/catalog/search
// Search the master catalog. Returns products with 'subscribed' flag
// indicating if this pharmacy already carries them.
//
// Query: ?q=Napa&manufacturer=Square&limit=50&offset=0

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const manufacturer = searchParams.get("manufacturer") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    // Build search query on MasterProduct
    const where: any = { isActive: true };
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { genericName: { contains: q } },
        { barcode: { contains: q } },
      ];
    }
    if (manufacturer) {
      where.manufacturerStr = { contains: manufacturer };
    }

    // Get master products
    const [products, total] = await Promise.all([
      db.masterProduct.findMany({ where, orderBy: { name: "asc" }, take: limit, skip: offset }),
      db.masterProduct.count({ where }),
    ]);

    // Get this pharmacy's existing product masterProductId list
    const existingProducts = await db.product.findMany({
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
    console.error("[catalog/search] failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
