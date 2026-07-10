// GET /api/businesses/[id]/sales/analytics
// Returns comprehensive sales analytics for the analytics dashboard
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const period = url.searchParams.get("period") || "30d"; // 7d, 30d, 90d, 365d

    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case "7d": startDate.setDate(startDate.getDate() - 7); break;
      case "30d": startDate.setDate(startDate.getDate() - 30); break;
      case "90d": startDate.setDate(startDate.getDate() - 90); break;
      case "365d": startDate.setFullYear(startDate.getFullYear() - 1); break;
      default: startDate.setDate(startDate.getDate() - 30);
    }

    // 1. KPIs for the period
    const periodSales = await db.sale.aggregate({
      where: {
        businessId,
        status: "completed",
        createdAt: { gte: startDate },
      },
      _sum: { totalAmount: true, subtotal: true, discountAmount: true, taxAmount: true },
      _count: true,
      _avg: { totalAmount: true },
    });

    const periodPayments = await db.payment.aggregate({
      where: {
        businessId,
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    const periodReturns = await db.return.aggregate({
      where: {
        businessId,
        createdAt: { gte: startDate },
      },
      _sum: { refundAmount: true },
      _count: true,
    });

    // 2. Daily breakdown for trend chart
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
    const dailyData = [];
    const stepDays = days > 90 ? 7 : 1; // Weekly buckets for >90d

    for (let i = days - 1; i >= 0; i -= stepDays) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + stepDays - 1);
      dayEnd.setHours(23, 59, 59, 999);

      const [salesAgg, returnsAgg] = await Promise.all([
        db.sale.aggregate({
          where: {
            businessId, status: "completed",
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { totalAmount: true },
          _count: true,
        }),
        db.return.aggregate({
          where: {
            businessId,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
          _sum: { refundAmount: true },
          _count: true,
        }),
      ]);

      dailyData.push({
        date: dayStart.toISOString().split("T")[0],
        label: stepDays === 1
          ? dayStart.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" })
          : `W${Math.floor((days - i) / 7)}`,
        sales: salesAgg._sum.totalAmount || 0,
        count: salesAgg._count,
        refunds: returnsAgg._sum.refundAmount || 0,
        net: (salesAgg._sum.totalAmount || 0) - (returnsAgg._sum.refundAmount || 0),
      });
    }

    // 3. Top products by revenue
    const topProducts = await db.saleItem.groupBy({
      by: ["productId", "productName"],
      where: {
        businessId,
        sale: { status: "completed", createdAt: { gte: startDate } },
      },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 10,
    });

    // 4. Top customers by spending
    const topCustomers = await db.sale.groupBy({
      by: ["customerId"],
      where: {
        businessId,
        status: "completed",
        customerId: { not: null },
        createdAt: { gte: startDate },
      },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    });

    const customerIds = topCustomers.map((c) => c.customerId).filter(Boolean) as string[];
    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    // 5. Payment method breakdown
    const paymentMethods = await db.payment.groupBy({
      by: ["paymentMethod"],
      where: { businessId, createdAt: { gte: startDate } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // 6. Sales by hour (peak hours)
    const hourlyData = [];
    for (let h = 0; h < 24; h++) {
      hourlyData.push({ hour: h, label: `${h.toString().padStart(2, "0")}:00`, count: 0, total: 0 });
    }
    const allSales = await db.sale.findMany({
      where: { businessId, status: "completed", createdAt: { gte: startDate } },
      select: { createdAt: true, totalAmount: true },
    });
    allSales.forEach((s) => {
      const h = s.createdAt.getHours();
      hourlyData[h].count++;
      hourlyData[h].total += s.totalAmount;
    });
    const peakHours = hourlyData.filter((h) => h.count > 0).sort((a, b) => b.total - a.total).slice(0, 5);

    // 7. Sales by day of week
    const dayOfWeekData = [
      { day: "Sun", dayNum: 0, count: 0, total: 0 },
      { day: "Mon", dayNum: 1, count: 0, total: 0 },
      { day: "Tue", dayNum: 2, count: 0, total: 0 },
      { day: "Wed", dayNum: 3, count: 0, total: 0 },
      { day: "Thu", dayNum: 4, count: 0, total: 0 },
      { day: "Fri", dayNum: 5, count: 0, total: 0 },
      { day: "Sat", dayNum: 6, count: 0, total: 0 },
    ];
    allSales.forEach((s) => {
      const d = s.createdAt.getDay();
      dayOfWeekData[d].count++;
      dayOfWeekData[d].total += s.totalAmount;
    });

    // 8. Discount rules usage (if any)
    const discountRulesUsed = await db.discountRule.findMany({
      where: { businessId, timesUsed: { gt: 0 } },
      select: { id: true, name: true, timesUsed: true, totalDiscountGiven: true },
      orderBy: { timesUsed: "desc" },
      take: 5,
    });

    // 9. Comparison with previous period (growth %)
    const prevStartDate = new Date(startDate);
    const periodDuration = now.getTime() - startDate.getTime();
    prevStartDate.setTime(startDate.getTime() - periodDuration);

    const prevPeriodSales = await db.sale.aggregate({
      where: {
        businessId, status: "completed",
        createdAt: { gte: prevStartDate, lt: startDate },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const currentTotal = periodSales._sum.totalAmount || 0;
    const prevTotal = prevPeriodSales._sum.totalAmount || 0;
    const growthPercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : currentTotal > 0 ? 100 : 0;

    return NextResponse.json({
      success: true,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      kpis: {
        totalSales: currentTotal,
        salesCount: periodSales._count,
        avgSaleValue: periodSales._avg.totalAmount || 0,
        totalCollected: periodPayments._sum.amount || 0,
        paymentsCount: periodPayments._count,
        totalRefunds: periodReturns._sum.refundAmount || 0,
        refundsCount: periodReturns._count,
        netRevenue: currentTotal - (periodReturns._sum.refundAmount || 0),
        totalDiscounts: periodSales._sum.discountAmount || 0,
        totalTax: periodSales._sum.taxAmount || 0,
        // Growth
        prevPeriodTotal: prevTotal,
        growthPercent: Math.round(growthPercent * 10) / 10,
      },
      dailyTrend: dailyData,
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantity: p._sum.quantity || 0,
        revenue: p._sum.totalPrice || 0,
        salesCount: p._count,
      })),
      topCustomers: topCustomers.map((c) => ({
        customer: customerMap.get(c.customerId || "") || null,
        totalSpent: c._sum.totalAmount || 0,
        visitCount: c._count,
      })),
      paymentMethods: paymentMethods.map((pm) => ({
        method: pm.paymentMethod,
        total: pm._sum.amount || 0,
        count: pm._count,
        percent: currentTotal > 0 ? ((pm._sum.amount || 0) / currentTotal) * 100 : 0,
      })),
      peakHours,
      dayOfWeek: dayOfWeekData,
      discountRulesUsed,
    });
  } catch (error) {
    console.error("Sales analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
