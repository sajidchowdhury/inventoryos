// GET /api/businesses/[id]/cctv/reports/profit-loss?from=X&to=Y
// CCTV-specific P&L Report
// Revenue = sum of paid amounts from CCTVPayment
// COGS   = cost price of sold items (serial item costPrice or product costPrice × qty)
// Gross Profit = Revenue - COGS
// Operating Expenses = from CCTVExpense
// Net Profit = Gross Profit - OpEx
// Supports monthly breakdown within the date range.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── Types ──

interface MonthlyBreakdown {
  month: string;       // "2025-07"
  monthLabel: string;  // "Jul 2025"
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number; // percentage
  opex: number;
  netProfit: number;
  netMargin: number;   // percentage
  saleCount: number;
  expenseCount: number;
}

interface ProfitLossResponse {
  success: boolean;
  from: string;
  to: string;
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    opex: number;
    netProfit: number;
    netMargin: number;
    saleCount: number;
    expenseCount: number;
  };
  months: MonthlyBreakdown[];
  expenseBreakdown: Array<{ category: string; total: number; count: number }>;
}

// ── Helpers ──

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal %
}

// ── GET handler ──

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;

    const fromStr = url.searchParams.get("from") || "";
    const toStr = url.searchParams.get("to") || "";

    // Date range — default: current month
    const now = new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toStr
      ? (() => {
          const d = new Date(toStr);
          d.setHours(23, 59, 59, 999);
          return d;
        })()
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── 1. Revenue: sum of CCTVPayment amounts ──
    // Group by month for monthly comparison
    const payments = await db.cCTVPayment.findMany({
      where: {
        businessId,
        isActive: true,
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        saleId: true,
        sale: {
          select: {
            saleCode: true,
            customerName: true,
            items: {
              select: {
                id: true,
                productId: true,
                serialItemId: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
                product: {
                  select: { costPrice: true, name: true },
                },
                serialItem: {
                  select: { costPrice: true, serialNumber: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── 2. Operating Expenses ──
    const expenses = await db.cCTVExpense.findMany({
      where: {
        businessId,
        isActive: true,
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        date: true,
        category: true,
        amount: true,
        description: true,
      },
      orderBy: { date: "asc" },
    });

    // ── 3. COGS calculation ──
    // For each payment, we calculate the COGS of the sale items.
    // COGS is tied to the sale (not the payment), so we need to be careful
    // about sales that span months. We'll attribute COGS based on the payment date.
    // However, to avoid double-counting COGS for partial payments on the same sale,
    // we track which sale items we've already accounted for.

    // Track COGS per month
    const monthlyCOGS: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};
    const monthlySaleCount: Record<string, number> = {};
    const monthlyOpex: Record<string, number> = {};
    const monthlyExpenseCount: Record<string, number> = {};

    // Track which sale items have been counted for COGS (avoid double-counting
    // when multiple payments exist for the same sale)
    const countedSaleItems = new Set<string>();

    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalOpex = 0;
    let totalSaleCount = 0;
    let totalExpenseCount = 0;

    // Process payments → revenue + COGS
    for (const payment of payments) {
      const mk = monthKey(payment.createdAt);

      // Revenue
      totalRevenue += payment.amount;
      monthlyRevenue[mk] = (monthlyRevenue[mk] || 0) + payment.amount;
      totalSaleCount++;
      monthlySaleCount[mk] = (monthlySaleCount[mk] || 0) + 1;

      // COGS from sale items (only count each sale item once)
      if (payment.sale?.items) {
        for (const item of payment.sale.items) {
          if (countedSaleItems.has(item.id)) continue;
          countedSaleItems.add(item.id);

          // Determine cost price: serial item cost > product cost > 0
          let itemCost = 0;
          if (item.serialItemId && item.serialItem?.costPrice) {
            itemCost = item.serialItem.costPrice;
          } else if (item.product?.costPrice) {
            itemCost = item.product.costPrice;
          }

          const cogsForItem = itemCost * item.quantity;
          totalCOGS += cogsForItem;
          monthlyCOGS[mk] = (monthlyCOGS[mk] || 0) + cogsForItem;
        }
      }
    }

    // Process expenses → OpEx
    const categoryBreakdown: Record<string, { total: number; count: number }> = {};

    for (const expense of expenses) {
      const mk = monthKey(expense.date);

      totalOpex += expense.amount;
      monthlyOpex[mk] = (monthlyOpex[mk] || 0) + expense.amount;
      totalExpenseCount++;
      monthlyExpenseCount[mk] = (monthlyExpenseCount[mk] || 0) + 1;

      // Category breakdown
      if (!categoryBreakdown[expense.category]) {
        categoryBreakdown[expense.category] = { total: 0, count: 0 };
      }
      categoryBreakdown[expense.category].total += expense.amount;
      categoryBreakdown[expense.category].count++;
    }

    // ── 4. Compute monthly breakdown ──
    // Collect all month keys across revenue, COGS, and OpEx
    const allMonths = new Set([
      ...Object.keys(monthlyRevenue),
      ...Object.keys(monthlyCOGS),
      ...Object.keys(monthlyOpex),
    ]);

    const months: MonthlyBreakdown[] = Array.from(allMonths)
      .sort()
      .map((mk) => {
        const rev = monthlyRevenue[mk] || 0;
        const cogs = monthlyCOGS[mk] || 0;
        const gp = rev - cogs;
        const opex = monthlyOpex[mk] || 0;
        const np = gp - opex;

        return {
          month: mk,
          monthLabel: monthLabel(mk),
          revenue: rev,
          cogs,
          grossProfit: gp,
          grossMargin: pct(gp, rev),
          opex,
          netProfit: np,
          netMargin: pct(np, rev),
          saleCount: monthlySaleCount[mk] || 0,
          expenseCount: monthlyExpenseCount[mk] || 0,
        };
      });

    // ── 5. Summary ──
    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalOpex;

    const response: ProfitLossResponse = {
      success: true,
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        revenue: totalRevenue,
        cogs: totalCOGS,
        grossProfit,
        grossMargin: pct(grossProfit, totalRevenue),
        opex: totalOpex,
        netProfit,
        netMargin: pct(netProfit, totalRevenue),
        saleCount: totalSaleCount,
        expenseCount: totalExpenseCount,
      },
      months,
      expenseBreakdown: Object.entries(categoryBreakdown).map(
        ([category, data]) => ({
          category,
          total: data.total,
          count: data.count,
        })
      ),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("P&L API error:", error);
    return NextResponse.json(
      { error: "Failed to generate profit & loss report" },
      { status: 500 }
    );
  }
}