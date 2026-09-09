// GET /api/businesses/[id]/cctv/reports/profit-loss?from=&to=&format=monthly|quarterly|yearly&comparePrevious=true
// Revenue (sales) - COGS (cost of sold items) - Expenses = Net Profit
// PL-4: repair revenue now noted with a caveat — repair COGS (spare parts)
//   is NOT subtracted because the schema has no "repair parts" model. The
//   response includes a `repairCOGSCaveat` flag so the UI can warn.
// PL-5: accepts ?format=monthly|quarterly|yearly to bucket the period into
//   sub-periods. Returns `periods` array alongside the single-period summary.
// PL-6: accepts ?comparePrevious=true to return the prior period's totals
//   for a "this month vs last month" view.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // PL-5: sub-period bucketing
  const format = searchParams.get("format"); // "monthly" | "quarterly" | "yearly" | null
  // PL-6: prior-period comparison
  const comparePrevious = searchParams.get("comparePrevious") === "true";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const startDate = new Date(from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  // 1. Revenue from sales
  const sales = await db.cCTVSale.findMany({
    where: { businessId, saleDate: { gte: startDate, lte: endDate } },
    include: { items: { select: { sellPrice: true, costPrice: true, quantity: true } } },
  });
  const totalRevenue = sales.reduce((s, x) => s + Number(x.totalAmount), 0);

  // 2. COGS = sum of (costPrice * quantity) for each sale item
  let totalCOGS = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      totalCOGS += (Number(item.costPrice) || 0) * item.quantity;
    }
  }

  // 3. Gross profit
  const grossProfit = totalRevenue - totalCOGS;

  // 4. Expenses
  const expenses = await db.cCTVExpense.findMany({
    where: { businessId, expenseDate: { gte: startDate, lte: endDate } },
    select: { category: true, amount: true },
  });
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);

  // Expense breakdown by category
  const expenseByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + Number(exp.amount);
  }

  // 5. Repair revenue
  // PL-4: repair revenue is the sum of repairCost for repairs RETURNED in
  // the period (when the customer paid). Repair COGS (spare parts) is NOT
  // subtracted because the schema has no "repair parts" model — a ৳500
  // HDD replaced under a ৳1000 repair is counted as ৳1000 revenue with
  // ৳0 cost, overstating repair profit by the parts cost. The response
  // flags this via `repairCOGSCaveat` so the UI can show a warning.
  const repairs = await db.cCTVRepair.findMany({
    where: { businessId, returnedDate: { gte: startDate, lte: endDate } },
    select: { repairCost: true, underWarranty: true },
  });
  const repairRevenue = repairs.reduce((s, x) => s + Number(x.repairCost), 0);

  // 6. Net profit
  const netProfit = grossProfit + repairRevenue - totalExpenses;

  // PL-5: sub-period bucketing. Split [from, to] into monthly/quarterly/yearly
  // buckets and compute revenue + COGS + expenses + netProfit per bucket.
  let periods: { period: string; revenue: number; cogs: number; expenses: number; repairRevenue: number; netProfit: number }[] | undefined;
  if (format) {
    // Bucket key: "YYYY-MM" (monthly), "YYYY-Qn" (quarterly), "YYYY" (yearly)
    const bucketKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = d.getMonth(); // 0-11
      if (format === "yearly") return String(y);
      if (format === "quarterly") return `${y}-Q${Math.floor(m / 3) + 1}`;
      return `${y}-${String(m + 1).padStart(2, "0")}`; // monthly
    };
    const bucketMap = new Map<string, { revenue: number; cogs: number; expenses: number; repairRevenue: number; netProfit: number }>();

    for (const sale of sales) {
      const key = bucketKey(new Date(sale.saleDate));
      if (!bucketMap.has(key)) bucketMap.set(key, { revenue: 0, cogs: 0, expenses: 0, repairRevenue: 0, netProfit: 0 });
      const b = bucketMap.get(key)!;
      b.revenue += Number(sale.totalAmount);
      for (const item of sale.items) b.cogs += (Number(item.costPrice) || 0) * item.quantity;
    }
    for (const exp of expenses) {
      const key = bucketKey(new Date(exp.expenseDate));
      if (!bucketMap.has(key)) bucketMap.set(key, { revenue: 0, cogs: 0, expenses: 0, repairRevenue: 0, netProfit: 0 });
      bucketMap.get(key)!.expenses += Number(exp.amount);
    }
    for (const r of repairs) {
      if (!r.returnedDate) continue;
      const key = bucketKey(new Date(r.returnedDate));
      if (!bucketMap.has(key)) bucketMap.set(key, { revenue: 0, cogs: 0, expenses: 0, repairRevenue: 0, netProfit: 0 });
      bucketMap.get(key)!.repairRevenue += Number(r.repairCost);
    }
    // Compute netProfit per bucket
    for (const b of bucketMap.values()) {
      b.netProfit = (b.revenue - b.cogs) + b.repairRevenue - b.expenses;
    }
    periods = Array.from(bucketMap.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  // PL-6: prior-period comparison
  let previousPeriod: { totalRevenue: number; totalCOGS: number; totalExpenses: number; repairRevenue: number; netProfit: number } | undefined;
  if (comparePrevious) {
    const periodMs = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodMs - 24 * 60 * 60 * 1000);
    const prevEnd = new Date(startDate.getTime() - 1);
    const [prevSales, prevExpenses, prevRepairs] = await Promise.all([
      db.cCTVSale.findMany({
        where: { businessId, saleDate: { gte: prevStart, lte: prevEnd } },
        include: { items: { select: { costPrice: true, quantity: true } } },
      }),
      db.cCTVExpense.findMany({
        where: { businessId, expenseDate: { gte: prevStart, lte: prevEnd } },
        select: { amount: true },
      }),
      db.cCTVRepair.findMany({
        where: { businessId, returnedDate: { gte: prevStart, lte: prevEnd } },
        select: { repairCost: true },
      }),
    ]);
    const prevRevenue = prevSales.reduce((s, x) => s + Number(x.totalAmount), 0);
    let prevCOGS = 0;
    for (const sale of prevSales) for (const item of sale.items) prevCOGS += (Number(item.costPrice) || 0) * item.quantity;
    const prevExpensesTotal = prevExpenses.reduce((s, x) => s + Number(x.amount), 0);
    const prevRepairRevenue = prevRepairs.reduce((s, x) => s + Number(x.repairCost), 0);
    previousPeriod = {
      totalRevenue: prevRevenue,
      totalCOGS: prevCOGS,
      totalExpenses: prevExpensesTotal,
      repairRevenue: prevRepairRevenue,
      netProfit: (prevRevenue - prevCOGS) + prevRepairRevenue - prevExpensesTotal,
    };
  }

  return NextResponse.json({
    success: true,
    period: { from, to },
    summary: {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      repairRevenue,
      netProfit,
      salesCount: sales.length,
      expenseCount: expenses.length,
      repairCount: repairs.length,
      // PL-4: flag so the UI can show "Repair profit excludes spare parts cost"
      repairCOGSCaveat: repairRevenue > 0,
    },
    expenseByCategory,
    // PL-5: only present when ?format= is set
    ...(periods ? { periods } : {}),
    // PL-6: only present when ?comparePrevious=true
    ...(previousPeriod ? { previousPeriod } : {}),
  });
}
