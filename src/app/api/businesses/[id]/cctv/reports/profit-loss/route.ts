// GET /api/businesses/[id]/cctv/reports/profit-loss?from=&to=
// Revenue (sales) - COGS (cost of sold items) - Expenses = Net Profit
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

  // 1. Revenue from sales
  const sales = await db.cCTVSale.findMany({
    where: { businessId, saleDate: { gte: startDate, lte: endDate } },
    include: { items: { select: { sellPrice: true, costPrice: true, quantity: true } } },
  });
  const totalRevenue = sales.reduce((s, x) => s + x.totalAmount, 0);

  // 2. COGS = sum of (costPrice * quantity) for each sale item
  let totalCOGS = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      totalCOGS += (item.costPrice || 0) * item.quantity;
    }
  }

  // 3. Gross profit
  const grossProfit = totalRevenue - totalCOGS;

  // 4. Expenses
  const expenses = await db.cCTVExpense.findMany({
    where: { businessId, expenseDate: { gte: startDate, lte: endDate } },
    select: { category: true, amount: true },
  });
  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);

  // Expense breakdown by category
  const expenseByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount;
  }

  // 5. Repair revenue
  const repairs = await db.cCTVRepair.findMany({
    where: { businessId, receivedDate: { gte: startDate, lte: endDate } },
    select: { repairCost: true, underWarranty: true },
  });
  const repairRevenue = repairs.reduce((s, x) => s + x.repairCost, 0);

  // 6. Net profit
  const netProfit = grossProfit + repairRevenue - totalExpenses;

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
    },
    expenseByCategory,
  });
}
