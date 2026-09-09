// GET /api/businesses/[id]/cctv/reports/top-products?from=&to=&limit=10&sortBy=revenue|qty&categoryId=
// TP-3: accepts ?sortBy=revenue|qty — only computes the requested list
//   (was always computing both topByRevenue + topByQty). Minor waste.
// TP-5: accepts ?categoryId= to filter by product category.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "10") || 10);
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
  // We need to join via the product's categoryId. Prisma allows nested where.
  const saleItemWhere: any = {
    businessId,
    sale: { saleDate: { gte: startDate, lte: endDate } },
  };
  if (categoryId) {
    saleItemWhere.product = { categoryId };
  }

  const saleItems = await db.cCTVSaleItem.findMany({
    where: saleItemWhere,
    select: { productName: true, quantity: true, sellPrice: true, costPrice: true, productId: true },
  });

  // Aggregate by product (use productId if available for stable grouping,
  // fall back to productName for legacy items without a productId).
  const productMap: Record<string, { name: string; qtySold: number; revenue: number; cost: number; profit: number }> = {};
  for (const item of saleItems) {
    const key = item.productId || item.productName;
    if (!productMap[key]) productMap[key] = { name: item.productName, qtySold: 0, revenue: 0, cost: 0, profit: 0 };
    productMap[key].qtySold += item.quantity;
    productMap[key].revenue += Number(item.sellPrice) * item.quantity;
    productMap[key].cost += (Number(item.costPrice) || 0) * item.quantity;
    productMap[key].profit = productMap[key].revenue - productMap[key].cost;
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
