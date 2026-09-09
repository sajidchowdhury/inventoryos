// GET /api/businesses/[id]/cctv/reports/expense-summary?from=&to=&category=&page=&pageSize=&comparePrevious=true
// ES-2: accepts ?category= to filter to a single category.
// ES-3: expenses array is now paginated (default 50, max 200). Summary
//   totals are computed over ALL matching expenses regardless of page.
// ES-4: accepts ?comparePrevious=true to return prior-period totals by
//   category for trend comparison.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // ES-2: single-category filter
  const category = searchParams.get("category");
  // ES-3: pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50") || 50));
  const skip = (page - 1) * pageSize;
  // ES-4: prior-period comparison
  const comparePrevious = searchParams.get("comparePrevious") === "true";

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const startDate = new Date(from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  // ES-2: filter by category if set (case-insensitive).
  const where: any = { businessId, expenseDate: { gte: startDate, lte: endDate } };
  if (category) where.category = { equals: category, mode: "insensitive" };

  // ES-3: paginated expenses for the list, but aggregate over ALL matching.
  const [expensesPage, allExpenses, total] = await Promise.all([
    db.cCTVExpense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      skip,
      take: pageSize,
    }),
    db.cCTVExpense.findMany({
      where,
      select: { category: true, amount: true, expenseDate: true },
    }),
    db.cCTVExpense.count({ where }),
  ]);

  const allTotal = allExpenses.reduce((s, x) => s + Number(x.amount), 0);

  // Breakdown by category (over ALL matching, not just the page)
  const byCategory: Record<string, { count: number; total: number }> = {};
  for (const exp of allExpenses) {
    if (!byCategory[exp.category]) byCategory[exp.category] = { count: 0, total: 0 };
    byCategory[exp.category].count++;
    byCategory[exp.category].total += Number(exp.amount);
  }
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, data]) => ({ category, ...data, pct: allTotal > 0 ? (data.total / allTotal) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // ES-4: prior-period comparison. If comparePrevious=true, compute the
  // same breakdown for the immediately preceding period of equal length.
  // The prior period is [from - N days, to - N days] where N = (to - from).
  let previousPeriod: { total: number; byCategory: Record<string, number> } | undefined;
  if (comparePrevious) {
    const periodMs = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - periodMs - 24 * 60 * 60 * 1000);
    const prevEnd = new Date(startDate.getTime() - 1); // day before `from`
    const prevWhere: any = {
      businessId,
      expenseDate: { gte: prevStart, lte: prevEnd },
      ...(category ? { category: { equals: category, mode: "insensitive" as const } } : {}),
    };
    const prevExpenses = await db.cCTVExpense.findMany({
      where: prevWhere,
      select: { category: true, amount: true },
    });
    const prevByCat: Record<string, number> = {};
    let prevTotal = 0;
    for (const exp of prevExpenses) {
      prevByCat[exp.category] = (prevByCat[exp.category] || 0) + Number(exp.amount);
      prevTotal += Number(exp.amount);
    }
    previousPeriod = { total: prevTotal, byCategory: prevByCat };
  }

  return NextResponse.json({
    success: true,
    summary: {
      count: total,
      total: allTotal,
      avgPerExpense: total > 0 ? allTotal / total : 0,
      categoryCount: Object.keys(byCategory).length,
    },
    categoryBreakdown,
    // ES-3: paginated expenses + pagination metadata
    expenses: expensesPage,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    // ES-2: echo the active filter
    filter: { category: category || null },
    // ES-4: only present when ?comparePrevious=true
    ...(previousPeriod ? { previousPeriod } : {}),
  });
}
