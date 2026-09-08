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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // include today = 7 days
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const previous7Start = new Date(sevenDaysAgo);
  previous7Start.setDate(previous7Start.getDate() - 7);

  // ── Build per-day data for graph ──
  type DayData = {
    date: string;
    label: string;
    sales: number;
    purchases: number;
    expenses: number;
    repairs: number;
    profit: number;
  };

  const dailyData: DayData[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [daySales, dayPurchases, dayExpenses, dayRepairs] = await Promise.all([
      db.cCTVSale.aggregate({
        where: { businessId, saleDate: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      db.cCTVPurchase.aggregate({
        where: { businessId, purchaseDate: { gte: dayStart, lte: dayEnd } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.cCTVExpense.aggregate({
        where: { businessId, expenseDate: { gte: dayStart, lte: dayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.cCTVRepair.aggregate({
        where: { businessId, receivedDate: { gte: dayStart, lte: dayEnd } },
        _sum: { repairCost: true },
        _count: true,
      }),
    ]);

    // WH-1 fix: use daySales._sum, dayExpenses._sum, etc. (was bare `_sum`)
    const salesTotal = daySales._sum.totalAmount ? Number(daySales._sum.totalAmount) : 0;
    const expensesTotal = dayExpenses._sum.amount ? Number(dayExpenses._sum.amount) : 0;
    const purchasesTotal = dayPurchases._sum.totalAmount ? Number(dayPurchases._sum.totalAmount) : 0;
    const repairsTotal = dayRepairs._sum.repairCost ? Number(dayRepairs._sum.repairCost) : 0;

    // WH-2 fix: compute COGS for this day's sales instead of using
    // the purchase total as an expense. COGS = sum(SaleItem.costPrice * qty)
    // for all sale items in sales made today.
    let dayCOGS = 0;
    if (daySales._count > 0) {
      // Fetch sale items for sales made today to compute COGS
      const todaySaleItems = await db.cCTVSaleItem.findMany({
        where: {
          businessId,
          sale: { saleDate: { gte: dayStart, lte: dayEnd } },
        },
        select: { costPrice: true, quantity: true },
      });
      dayCOGS = todaySaleItems.reduce(
        (sum, item) => sum + (Number(item.costPrice) || 0) * item.quantity,
        0
      );
    }

    dailyData.push({
      date: dayStart.toISOString().split("T")[0],
      label: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
      sales: salesTotal,
      purchases: purchasesTotal, // shown as cash flow (money out for inventory)
      expenses: expensesTotal,
      repairs: repairsTotal,
      // WH-2 fix: profit = revenue - COGS - expenses (not revenue - expenses - purchases)
      profit: salesTotal - dayCOGS - expensesTotal,
    });
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

  const [prevSales, prevPurchases, prevExpenses] = await Promise.all([
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
  ]);

  // WH-1 fix: use prevSales._sum, prevPurchases._sum, prevExpenses._sum
  const prevWeek = {
    sales: prevSales._sum.totalAmount ? Number(prevSales._sum.totalAmount) : 0,
    purchases: prevPurchases._sum.totalAmount ? Number(prevPurchases._sum.totalAmount) : 0,
    expenses: prevExpenses._sum.amount ? Number(prevExpenses._sum.amount) : 0,
  };

  // WH-2 fix: compute previous week COGS for profit comparison
  let prevWeekCOGS = 0;
  const prevWeekSaleItems = await db.cCTVSaleItem.findMany({
    where: {
      businessId,
      sale: { saleDate: { gte: previous7Start, lte: prevWeekEnd } },
    },
    select: { costPrice: true, quantity: true },
  });
  prevWeekCOGS = prevWeekSaleItems.reduce(
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
  // Simple heuristic: profit > 0 = good, sales growing = good, expenses controlled = good
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
  // A product is "low stock" when stock <= minStock AND minStock > 0.
  // Products with minStock = 0 (no threshold set) are NOT flagged.
  const allProducts = await db.cCTVProduct.findMany({
    where: { businessId, isActive: true },
    select: { id: true, stock: true, minStock: true, serialTracked: true },
  });
  let lowStockProducts = 0;
  for (const p of allProducts) {
    // For serial-tracked products, check IN_STOCK serial count (per §1 fix pattern)
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
