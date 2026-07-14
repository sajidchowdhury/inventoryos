// GET /api/businesses/[id]/cctv/reports/expense-summary?from=&to=
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const startDate = new Date(from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  const expenses = await db.cCTVExpense.findMany({
    where: { businessId, expenseDate: { gte: startDate, lte: endDate } },
    orderBy: { expenseDate: "desc" },
  });

  const total = expenses.reduce((s, x) => s + x.amount, 0);

  // Breakdown by category
  const byCategory: Record<string, { count: number; total: number }> = {};
  for (const exp of expenses) {
    if (!byCategory[exp.category]) byCategory[exp.category] = { count: 0, total: 0 };
    byCategory[exp.category].count++;
    byCategory[exp.category].total += exp.amount;
  }
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, data]) => ({ category, ...data, pct: total > 0 ? (data.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    success: true,
    summary: {
      count: expenses.length,
      total,
      avgPerExpense: expenses.length > 0 ? total / expenses.length : 0,
      categoryCount: Object.keys(byCategory).length,
    },
    categoryBreakdown,
    expenses,
  });
}
