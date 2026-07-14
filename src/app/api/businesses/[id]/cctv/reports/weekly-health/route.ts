// GET /api/businesses/[id]/cctv/reports/weekly-health
// Business health report for the last 7 days — trends + insights + graph data
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

    const salesTotal = daySales._sum.totalAmount ? Number(_sum.totalAmount) : 0;
    const expensesTotal = dayExpenses._sum.amount ? Number(_sum.amount) : 0;
    const purchasesTotal = dayPurchases._sum.totalAmount ? Number(_sum.totalAmount) : 0;

    dailyData.push({
      date: dayStart.toISOString().split("T")[0],
      label: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
      sales: salesTotal,
      purchases: purchasesTotal,
      expenses: expensesTotal,
      repairs: dayRepairs._sum.repairCost ? Number(_sum.repairCost) : 0,
      profit: salesTotal - expensesTotal - purchasesTotal, // simplified profit
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

  const prevWeek = {
    sales: prevSales._sum.totalAmount ? Number(_sum.totalAmount) : 0,
    purchases: prevPurchases._sum.totalAmount ? Number(_sum.totalAmount) : 0,
    expenses: prevExpenses._sum.amount ? Number(_sum.amount) : 0,
  };

  // ── Insights ──
  const salesChange = prevWeek.sales > 0 ? ((thisWeek.sales - prevWeek.sales) / prevWeek.sales) * 100 : 0;
  const expenseChange = prevWeek.expenses > 0 ? ((thisWeek.expenses - prevWeek.expenses) / prevWeek.expenses) * 100 : 0;
  const profitChange = thisWeek.profit - (prevWeek.sales - prevWeek.expenses - prevWeek.purchases);

  // Best day
  const bestDay = dailyData.reduce((best, day) => day.sales > best.sales ? day : best, dailyData[0] || { label: "—", sales: 0 } as DayData);
  const worstDay = dailyData.reduce((worst, day) => day.sales < worst.sales ? day : worst, dailyData[0] || { label: "—", sales: 0 } as DayData);

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
  const lowStockProducts = await db.cCTVProduct.count({
    where: { businessId, stock: { lte: 5 } },
  });

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
