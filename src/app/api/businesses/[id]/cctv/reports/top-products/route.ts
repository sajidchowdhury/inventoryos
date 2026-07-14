// GET /api/businesses/[id]/cctv/reports/top-products?from=&to=&limit=10
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = parseInt(searchParams.get("limit") || "10");

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
    select: { productName: true, quantity: true, sellPrice: true, costPrice: true },
  });

  // Aggregate by product name
  const productMap: Record<string, { name: string; qtySold: number; revenue: number; cost: number; profit: number }> = {};
  for (const item of saleItems) {
    const key = item.productName;
    if (!productMap[key]) productMap[key] = { name: key, qtySold: 0, revenue: 0, cost: 0, profit: 0 };
    productMap[key].qtySold += item.quantity;
    productMap[key].revenue += item.sellPrice * item.quantity;
    productMap[key].cost += (item.costPrice || 0) * item.quantity;
    productMap[key].profit = productMap[key].revenue - productMap[key].cost;
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
