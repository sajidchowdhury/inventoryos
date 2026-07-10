// GET /api/businesses/[id]/reports/profit-loss
// Comprehensive P&L report: revenue, COGS, gross profit, expenses, net profit
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const period = url.searchParams.get("period") || "month"; // today, week, month, quarter, year
    const format = url.searchParams.get("format") || "json";

    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // ── REVENUE ──
    const sales = await db.sale.aggregate({
      where: { businessId, status: "completed", createdAt: { gte: startDate } },
      _sum: { totalAmount: true, subtotal: true, discountAmount: true, taxAmount: true },
      _count: true,
    });

    // ── RETURNS (reduces revenue) ──
    const returns = await db.return.aggregate({
      where: { businessId, createdAt: { gte: startDate } },
      _sum: { refundAmount: true },
      _count: true,
    });

    // ── COGS (Cost of Goods Sold) ──
    const saleItems = await db.saleItem.findMany({
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: startDate } },
      },
      select: { id: true, productId: true, productName: true, quantity: true, totalPrice: true, batchId: true, unit: true },
    });

    // Fetch batch purchase prices separately
    const batchIds = [...new Set(saleItems.map((i) => i.batchId).filter(Boolean))] as string[];
    const batchesForCOGS = await db.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, purchasePrice: true },
    });
    const batchPriceMap = new Map(batchesForCOGS.map((b) => [b.id, b.purchasePrice || 0]));

    let totalCOGS = 0;
    let totalRevenue = 0;
    const productWiseBreakdown = new Map<string, { name: string; quantity: number; revenue: number; cost: number; profit: number }>();

    for (const item of saleItems) {
      const cost = item.batchId ? batchPriceMap.get(item.batchId) || 0 : 0;
      const cogs = item.quantity * cost;
      const revenue = item.totalPrice;
      const profit = revenue - cogs;

      totalCOGS += cogs;
      totalRevenue += revenue;

      const key = item.productId;
      const existing = productWiseBreakdown.get(key) || { name: item.productName, quantity: 0, revenue: 0, cost: 0, profit: 0 };
      existing.quantity += item.quantity;
      existing.revenue += revenue;
      existing.cost += cogs;
      existing.profit += profit;
      productWiseBreakdown.set(key, existing);
    }

    // ── GROSS PROFIT ──
    const netRevenue = (sales._sum.totalAmount || 0) - (returns._sum.refundAmount || 0);
    const grossProfit = totalRevenue - totalCOGS;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // ── OPERATING EXPENSES (purchases) ──
    const purchases = await db.purchase.aggregate({
      where: { businessId, status: { not: "cancelled" }, createdAt: { gte: startDate } },
      _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
      _count: true,
    });

    // ── PAYMENTS RECEIVED ──
    const paymentsReceived = await db.payment.aggregate({
      where: { businessId, createdAt: { gte: startDate } },
      _sum: { amount: true },
      _count: true,
    });

    // ── SUPPLIER PAYMENTS MADE ──
    const supplierPaymentsMade = await db.purchase.aggregate({
      where: { businessId, status: { not: "cancelled" }, createdAt: { gte: startDate } },
      _sum: { paidAmount: true },
    });

    // ── NET PROFIT ──
    // Net profit = Gross Profit (operating profit, since we don't track separate opex yet)
    const netProfit = grossProfit;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    // ── TOP PROFITABLE PRODUCTS ──
    const topProducts = Array.from(productWiseBreakdown.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // ── LOSS-MAKING PRODUCTS ──
    const lossProducts = Array.from(productWiseBreakdown.values())
      .filter((p) => p.profit < 0)
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 5);

    const report = {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      revenue: {
        grossSales: sales._sum.totalAmount || 0,
        returns: returns._sum.refundAmount || 0,
        netRevenue,
        salesCount: sales._count,
        returnsCount: returns._count,
        subtotal: sales._sum.subtotal || 0,
        discounts: sales._sum.discountAmount || 0,
        tax: sales._sum.taxAmount || 0,
      },
      cogs: {
        total: totalCOGS,
        percentage: totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0,
      },
      grossProfit: {
        amount: grossProfit,
        margin: Math.round(grossMargin * 100) / 100,
      },
      expenses: {
        purchases: purchases._sum.totalAmount || 0,
        purchaseCount: purchases._count,
        purchaseDiscounts: purchases._sum.discountAmount || 0,
        purchaseTax: purchases._sum.taxAmount || 0,
      },
      cashFlow: {
        received: paymentsReceived._sum.amount || 0,
        paid: supplierPaymentsMade._sum.paidAmount || 0,
        net: (paymentsReceived._sum.amount || 0) - (supplierPaymentsMade._sum.paidAmount || 0),
      },
      netProfit: {
        amount: netProfit,
        margin: Math.round(netMargin * 100) / 100,
      },
      topProducts,
      lossProducts,
    };

    // CSV format
    if (format === "csv") {
      const lines = [
        `InventoryOS Profit & Loss Report`,
        `Period: ${period} (${startDate.toLocaleDateString()} to ${now.toLocaleDateString()})`,
        ``,
        `Section,Detail,Amount (BDT)`,
        `Revenue,Gross Sales,${(sales._sum.totalAmount || 0).toFixed(2)}`,
        `Revenue,Returns/Refunds,-${(returns._sum.refundAmount || 0).toFixed(2)}`,
        `Revenue,Net Revenue,${netRevenue.toFixed(2)}`,
        `Costs,COGS,-${totalCOGS.toFixed(2)}`,
        `Profit,Gross Profit,${grossProfit.toFixed(2)}`,
        `Profit,Gross Margin %,${(grossMargin).toFixed(2)}%`,
        `Expenses,Purchases,-${(purchases._sum.totalAmount || 0).toFixed(2)}`,
        `Cash Flow,Received,${(paymentsReceived._sum.amount || 0).toFixed(2)}`,
        `Cash Flow,Paid to Suppliers,-${(supplierPaymentsMade._sum.paidAmount || 0).toFixed(2)}`,
        `Cash Flow,Net Cash,${((paymentsReceived._sum.amount || 0) - (supplierPaymentsMade._sum.paidAmount || 0)).toFixed(2)}`,
        `Profit,Net Profit,${netProfit.toFixed(2)}`,
        `Profit,Net Margin %,${netMargin.toFixed(2)}%`,
        ``,
        `Top Products by Profit:`,
        `Product,Quantity,Revenue,Cost,Profit`,
        ...topProducts.map((p) => `"${p.name}",${p.quantity},${p.revenue.toFixed(2)},${p.cost.toFixed(2)},${p.profit.toFixed(2)}`),
      ];

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="profit_loss_${period}_${now.toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Profit-loss report error:", error);
    return NextResponse.json({ error: "Failed to generate P&L report" }, { status: 500 });
  }
}
