// GET /api/businesses/[id]/cctv/reports/top-products?from=&to=&limit=10&sortBy=revenue|qty&categoryId=
// TP-1 fix: aggregates by productId (not productName) and joins the
//   product name from CCTVProduct. Also fixes TP-2 (costPrice = 0 for
//   converted sales — now fetches the product's costPrice if the sale
//   item's costPrice is 0) and TP-4 (limit capped at 100).
// TP-3 fix: accepts ?sortBy=revenue|qty — only computes the requested list.
// TP-5 fix: accepts ?categoryId= to filter by product category.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // TP-4 fix: cap limit at 100
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
  // TP-3: sortBy — default both for backward compat, or pick one.
  const sortBy = searchParams.get("sortBy"); // "revenue" | "qty" | null
  // TP-5: category filter
  const categoryId = searchParams.get("categoryId");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const startDate = new Date(from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  // TP-5: if categoryId is set, restrict sale items to products in that category.
  const saleItemWhere: any = {
    businessId,
    sale: { saleDate: { gte: startDate, lte: endDate } },
  };
  if (categoryId) {
    saleItemWhere.product = { categoryId };
  }

  const saleItems = await db.cCTVSaleItem.findMany({
    where: saleItemWhere,
    select: { productId: true, productName: true, quantity: true, sellPrice: true, costPrice: true },
  });

  // TP-1 fix: aggregate by productId, not productName.
  const productMap: Record<string, { productId: string; name: string; qtySold: number; revenue: number; cost: number; profit: number }> = {};
  for (const item of saleItems) {
    const key = item.productId || "unknown";
    if (!productMap[key]) {
      productMap[key] = {
        productId: key,
        name: item.productName,
        qtySold: 0, revenue: 0, cost: 0, profit: 0,
      };
    }
    productMap[key].qtySold += item.quantity;
    productMap[key].revenue += Number(item.sellPrice) * item.quantity;

    // TP-2 fix: use the sale item's costPrice (may be 0 for pre-E-6 converted sales).
    let itemCost = Number(item.costPrice) || 0;
    productMap[key].cost += itemCost * item.quantity;
    productMap[key].profit = productMap[key].revenue - productMap[key].cost;
  }

  // TP-1 fix: fetch canonical product names + TP-2 costPrice fallback.
  const realProductIds = Object.keys(productMap).filter((id) => id !== "unknown");
  if (realProductIds.length > 0) {
    const products = await db.cCTVProduct.findMany({
      where: { id: { in: realProductIds } },
      select: { id: true, name: true, costPrice: true },
    });
    const productMapByName = new Map(products.map((p) => [p.id, p]));

    for (const key of realProductIds) {
      const product = productMapByName.get(key);
      if (product) {
        productMap[key].name = product.name;
        // TP-2 fix: if total cost is 0, recompute using product's current costPrice.
        if (productMap[key].cost === 0 && Number(product.costPrice) > 0) {
          productMap[key].cost = Number(product.costPrice) * productMap[key].qtySold;
          productMap[key].profit = productMap[key].revenue - productMap[key].cost;
        }
      }
    }
  }

  // TP-3: only compute the requested sort, or both for backward compat.
  const topByRevenue = (!sortBy || sortBy === "revenue")
    ? Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, limit)
    : undefined;
  const topByQty = (!sortBy || sortBy === "qty")
    ? Object.values(productMap).sort((a, b) => b.qtySold - a.qtySold).slice(0, limit)
    : undefined;

  return NextResponse.json({
    success: true,
    summary: {
      totalProducts: Object.keys(productMap).length,
      totalQtySold: Object.values(productMap).reduce((s, x) => s + x.qtySold, 0),
      totalRevenue: Object.values(productMap).reduce((s, x) => s + x.revenue, 0),
      totalProfit: Object.values(productMap).reduce((s, x) => s + x.profit, 0),
    },
    // TP-3: omit the unrequested list to save payload
    ...(topByRevenue !== undefined ? { topByRevenue } : {}),
    ...(topByQty !== undefined ? { topByQty } : {}),
  });
}
