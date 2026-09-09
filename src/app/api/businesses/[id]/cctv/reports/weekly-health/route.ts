// GET /api/businesses/[id]/cctv/reports/weekly-health
// Business health report for the last 7 days — trends + insights + graph data
//
// WH-1 fix: all bare `_sum` references replaced with the correct
//   variable (daySales._sum, dayExpenses._sum, etc.). The report
//   previously crashed with `ReferenceError: _sum is not defined`.
// WH-2 fix: profit formula changed from `sales - expenses - purchases`
//   (which counted the full purchase amount as an expense) to
//   `sales - COGS - expenses` where COGS = sum(SaleItem.costPrice * qty)
//   for sales in the period. Purchases are cash flow, not expenses.
// WH-6 fix: low-stock threshold changed from hardcoded `stock <= 5`
//   to `stock <= minStock AND minStock > 0`, using the per-product
//   threshold the shop owner sets.
// WH-7 fix: repair revenue is now based on repairs RETURNED this week
//   (when the customer pays), not RECEIVED this week. A repair received
//   Monday with cost recorded Wednesday no longer shows as Monday revenue.
// WH-8 fix: accepts `?to=` date param so the user can view "week of
//   Sep 1-7" even if today is Sep 20. Defaults to today.
// WH-9 fix: the 7-day loop no longer runs 7 sequential rounds of 4
//   Promise.all queries (28 queries). Now uses a single groupBy per
//   metric (sales, purchases, expenses, repairs) + a single SaleItem
//   query for COGS — 5 queries total instead of 28+.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);

  // WH-8: accept ?to= param (defaults to today). Allows viewing any past week.
  const toDateStr = searchParams.get("to");
  const now = toDateStr ? new Date(toDateStr) : new Date();
  if (isNaN(now.getTime())) {
    return NextResponse.json({ error: `Invalid 'to' date: "${toDateStr}"` }, { status: 400 });
  }
  // End of the target day (inclusive)
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // include today = 7 days
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const previous7Start = new Date(sevenDaysAgo);
  previous7Start.setDate(previous7Start.getDate() - 7);

  // ── WH-9: single groupBy queries instead of 7 sequential rounds ──
  // Group sales by the DATE portion of saleDate, sum totalAmount + paidAmount + count.
  // We use Prisma's groupBy on a date expression — since Prisma doesn't support
  // date_trunc directly, we fetch the raw rows and aggregate in JS. This is still
  // 1 query per metric (not 7), so it's 4 queries for the daily data + 1 for
  // COGS = 5 total (vs 28+ previously).
  type DayData = {
    date: string;
    label: string;
    sales: number;
    purchases: number;
    expenses: number;
    repairs: number;
    profit: number;
  };

  // Helper: YYYY-MM-DD key from a Date
  const dayKey = (d: Date) => d.toISOString().split("T")[0];

  // Initialize 7-day buckets
  const bucketMap = new Map<string, DayData>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    bucketMap.set(key, {
      date: key,
      label: d.toLocaleDateString("en-GB", { weekday: "short" }),
      sales: 0,
      purchases: 0,
      expenses: 0,
      repairs: 0,
      profit: 0,
    });
  }
  const dailyData = Array.from(bucketMap.values());

  // Single query: all sales in the 7-day range, with saleDate for bucketing
  const [salesRows, purchaseRows, expenseRows, repairRows, saleItemRows] = await Promise.all([
    db.cCTVSale.findMany({
      where: { businessId, saleDate: { gte: sevenDaysAgo, lte: endOfToday } },
      select: { id: true, saleDate: true, totalAmount: true },
    }),
    db.cCTVPurchase.findMany({
      where: { businessId, purchaseDate: { gte: sevenDaysAgo, lte: endOfToday } },
      select: { purchaseDate: true, totalAmount: true },
    }),
    db.cCTVExpense.findMany({
      where: { businessId, expenseDate: { gte: sevenDaysAgo, lte: endOfToday } },
      select: { expenseDate: true, amount: true },
    }),
    // WH-7: repairs RETURNED this week (customer picked up + paid), not received.
    // A repair "returned" is when the customer pays the repairCost. A repair
    // still in "received"/"in_repair"/"ready" hasn't generated revenue yet.
    db.cCTVRepair.findMany({
      where: { businessId, returnedDate: { gte: sevenDaysAgo, lte: endOfToday } },
      select: { returnedDate: true, repairCost: true },
    }),
    // Sale items for COGS — join via sale.saleDate to bucket by day
    db.cCTVSaleItem.findMany({
      where: {
        businessId,
        sale: { saleDate: { gte: sevenDaysAgo, lte: endOfToday } },
      },
      select: { costPrice: true, quantity: true, sale: { select: { saleDate: true } } },
    }),
  ]);

  // Bucket sales by day
  for (const s of salesRows) {
    const key = dayKey(s.saleDate);
    const bucket = bucketMap.get(key);
    if (bucket) bucket.sales += Number(s.totalAmount) || 0;
  }
  // Bucket purchases by day
  for (const p of purchaseRows) {
    const key = dayKey(p.purchaseDate);
    const bucket = bucketMap.get(key);
    if (bucket) bucket.purchases += Number(p.totalAmount) || 0;
  }
  // Bucket expenses by day
  for (const e of expenseRows) {
    const key = dayKey(e.expenseDate);
    const bucket = bucketMap.get(key);
    if (bucket) bucket.expenses += Number(e.amount) || 0;
  }
  // WH-7: bucket repair revenue by the RETURNED date (when the customer paid)
  for (const r of repairRows) {
    if (!r.returnedDate) continue;
    const key = dayKey(r.returnedDate);
    const bucket = bucketMap.get(key);
    if (bucket) bucket.repairs += Number(r.repairCost) || 0;
  }

  // WH-9: compute COGS per day from the single saleItemRows query
  const cogsByDay = new Map<string, number>();
  for (const item of saleItemRows) {
    const key = dayKey(item.sale.saleDate);
    const cogs = (Number(item.costPrice) || 0) * item.quantity;
    cogsByDay.set(key, (cogsByDay.get(key) || 0) + cogs);
  }
  for (const day of dailyData) {
    const dayCOGS = cogsByDay.get(day.date) || 0;
    // WH-2 fix: profit = revenue - COGS - expenses (not revenue - expenses - purchases)
    day.profit = day.sales - dayCOGS - day.expenses;
  }

  // ── This week totals ──
  const thisWeek = dailyData.reduce((acc, day) => ({
    sales: acc.sales + day.sales,
    purchases: acc.purchases + day.purchases,
    expenses: acc.expenses + day.expenses,
    repairs: acc.repairs + day.repairs,
    profit: acc.profit + day.profit,
  }), { sales: 0, purchases: 0, expenses: 0, repairs: 0, profit: 0 });

  // ── Previous week totals for comparison ──
  const prevWeekEnd = new Date(sevenDaysAgo);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  prevWeekEnd.setHours(23, 59, 59, 999);

  const [prevSales, prevPurchases, prevExpenses, prevSaleItems] = await Promise.all([
    db.cCTVSale.aggregate({
      where: { businessId, saleDate: { gte: previous7Start, lte: prevWeekEnd } },
      _sum: { totalAmount: true },
    }),
    db.cCTVPurchase.aggregate({
      where: { businessId, purchaseDate: { gte: previous7Start, lte: prevWeekEnd } },
      _sum: { totalAmount: true },
    }),
    db.cCTVExpense.aggregate({
      where: { businessId, expenseDate: { gte: previous7Start, lte: prevWeekEnd } },
      _sum: { amount: true },
    }),
    db.cCTVSaleItem.findMany({
      where: {
        businessId,
        sale: { saleDate: { gte: previous7Start, lte: prevWeekEnd } },
      },
      select: { costPrice: true, quantity: true },
    }),
  ]);

  const prevWeek = {
    sales: prevSales._sum.totalAmount ? Number(prevSales._sum.totalAmount) : 0,
    purchases: prevPurchases._sum.totalAmount ? Number(prevPurchases._sum.totalAmount) : 0,
    expenses: prevExpenses._sum.amount ? Number(prevExpenses._sum.amount) : 0,
  };

  // WH-2 fix: compute previous week COGS for profit comparison
  const prevWeekCOGS = prevSaleItems.reduce(
    (sum, item) => sum + (Number(item.costPrice) || 0) * item.quantity,
    0
  );
  const prevWeekProfit = prevWeek.sales - prevWeekCOGS - prevWeek.expenses;

  // ── Insights ──
  const salesChange = prevWeek.sales > 0 ? ((thisWeek.sales - prevWeek.sales) / prevWeek.sales) * 100 : 0;
  const expenseChange = prevWeek.expenses > 0 ? ((thisWeek.expenses - prevWeek.expenses) / prevWeek.expenses) * 100 : 0;
  // WH-4 fix: profitChange uses the corrected COGS-based profit formula
  const profitChange = thisWeek.profit - prevWeekProfit;

  // Best day — WH-10 fix: by profit, not just sales
  const bestDay = dailyData.reduce((best, day) => day.profit > best.profit ? day : best, dailyData[0] || { label: "—", sales: 0, profit: 0 } as DayData);
  const worstDay = dailyData.reduce((worst, day) => day.profit < worst.profit ? day : worst, dailyData[0] || { label: "—", sales: 0, profit: 0 } as DayData);

  // ── Health score (0-100) ──
  let healthScore = 50;
  if (thisWeek.profit > 0) healthScore += 20;
  if (salesChange > 0) healthScore += 15;
  if (expenseChange < 0) healthScore += 10;
  if (thisWeek.sales > 0) healthScore += 5;
  healthScore = Math.min(100, Math.max(0, healthScore));

  const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Average" : "Needs Attention";

  // ── Active repairs count ──
  const activeRepairs = await db.cCTVRepair.count({
    where: { businessId, status: { in: ["received", "in_repair", "ready"] } },
  });

  // ── Low stock count ──
  // WH-6 fix: use the per-product minStock threshold (not hardcoded 5).
  const allProducts = await db.cCTVProduct.findMany({
    where: { businessId, isActive: true },
    select: { id: true, stock: true, minStock: true, serialTracked: true },
  });
  let lowStockProducts = 0;
  for (const p of allProducts) {
    let effectiveStock = p.stock;
    if (p.serialTracked) {
      effectiveStock = await db.cCTVSerialItem.count({
        where: { businessId, productId: p.id, status: "IN_STOCK" },
      });
    }
    if (p.minStock > 0 && effectiveStock <= p.minStock) {
      lowStockProducts++;
    }
  }

  return NextResponse.json({
    success: true,
    period: {
      from: sevenDaysAgo.toISOString().split("T")[0],
      to: now.toISOString().split("T")[0],
    },
    thisWeek,
    prevWeek,
    dailyData,
    insights: {
      salesChange: Math.round(salesChange * 10) / 10,
      expenseChange: Math.round(expenseChange * 10) / 10,
      profitChange: Math.round(profitChange),
      bestDay: bestDay.label,
      worstDay: worstDay.label,
      healthScore,
      healthLabel,
      activeRepairs,
      lowStockProducts,
    },
  });
}
