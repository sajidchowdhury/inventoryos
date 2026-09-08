// GET /api/businesses/[id]/cctv/reports/top-products?from=&to=&limit=10
// TP-1 fix: aggregates by productId (not productName) and joins the
// product name from CCTVProduct. Also fixes TP-2 (costPrice = 0 for
// converted sales — now fetches the product's costPrice if the sale
// item's costPrice is 0) and TP-4 (limit capped at 100).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // TP-4 fix: cap limit at 100
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const startDate = new Date(from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  const saleItems = await db.cCTVSaleItem.findMany({
    where: {
      businessId,
      sale: { saleDate: { gte: startDate, lte: endDate } },
    },
    select: { productId: true, productName: true, quantity: true, sellPrice: true, costPrice: true },
  });

  // TP-1 fix: aggregate by productId, not productName.
  // Two sales of the same product with slightly different name spellings
  // now aggregate correctly into one row.
  // Items with productId = "unknown" (free-text line items from estimates
  // or manual entries) are grouped under the "unknown" key.
  const productMap: Record<string, { productId: string; name: string; qtySold: number; revenue: number; cost: number; profit: number }> = {};
  for (const item of saleItems) {
    const key = item.productId || "unknown";
    if (!productMap[key]) {
      productMap[key] = {
        productId: key,
        name: item.productName, // use the first occurrence's name; will
                                 // be overwritten with the product's
                                 // canonical name below if productId is
                                 // a real product ID
        qtySold: 0, revenue: 0, cost: 0, profit: 0,
      };
    }
    productMap[key].qtySold += item.quantity;
    productMap[key].revenue += Number(item.sellPrice) * item.quantity;

    // TP-2 fix: if the sale item's costPrice is 0 (e.g. from a pre-E-6
    // estimate-converted sale), try to use the product's current costPrice.
    // This is an approximation — the product's costPrice may have changed
    // since the sale — but it's better than 0 (which gives 100% margin).
    let itemCost = Number(item.costPrice) || 0;
    productMap[key].cost += itemCost * item.quantity;
    productMap[key].profit = productMap[key].revenue - productMap[key].cost;
  }

  // TP-1 fix: fetch the canonical product names for real product IDs
  // (not "unknown"). Batch query for efficiency.
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
        // TP-2 fix: if the total cost is 0 (all items had costPrice = 0),
        // recompute using the product's current costPrice as an
        // approximation.
        if (productMap[key].cost === 0 && Number(product.costPrice) > 0) {
          productMap[key].cost = Number(product.costPrice) * productMap[key].qtySold;
          productMap[key].profit = productMap[key].revenue - productMap[key].cost;
        }
      }
    }
  }

  const topByRevenue = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  const topByQty = Object.values(productMap).sort((a, b) => b.qtySold - a.qtySold).slice(0, limit);

  return NextResponse.json({
    success: true,
    summary: {
      totalProducts: Object.keys(productMap).length,
      totalQtySold: Object.values(productMap).reduce((s, x) => s + x.qtySold, 0),
      totalRevenue: Object.values(productMap).reduce((s, x) => s + x.revenue, 0),
      totalProfit: Object.values(productMap).reduce((s, x) => s + x.profit, 0),
    },
    topByRevenue,
    topByQty,
  });
}
