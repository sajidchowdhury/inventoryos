// GET /api/businesses/[id]/sales/stats
// Returns sales aggregations: today, this week, this month, top products, etc.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    const now = new Date();

    // Date ranges
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const yearStart = new Date(now);
    yearStart.setFullYear(yearStart.getFullYear() - 1);

    // Aggregate for each period
    const [today, week, month, year] = await Promise.all([
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: weekStart } },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: monthStart } },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { businessId, status: "completed", createdAt: { gte: yearStart } },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
    ]);

    // Last 7 days breakdown (for chart)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayData = await db.sale.aggregate({
        where: {
          businessId,
          status: "completed",
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { totalAmount: true },
        _count: true,
      });

      last7Days.push({
        date: dayStart.toISOString().split("T")[0],
        dayName: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
        total: dayData._sum.totalAmount || 0,
        count: dayData._count,
      });
    }

    // Top 5 products by sales (last 30 days)
    const topProductsRaw = await db.saleItem.groupBy({
      by: ["productId", "productName"],
      where: {
        businessId,
        sale: {
          status: "completed",
          createdAt: { gte: monthStart },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 5,
    });

    // Payment method breakdown (last 30 days)
    const paymentMethods = await db.sale.groupBy({
      by: ["paymentMethod"],
      where: {
        businessId,
        status: "completed",
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Outstanding payments (partial + unpaid)
    const outstanding = await db.sale.aggregate({
      where: {
        businessId,
        status: "completed",
        paymentStatus: { in: ["partial", "unpaid"] },
      },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    // Cancelled sales count (last 30 days)
    const cancelledCount = await db.sale.count({
      where: {
        businessId,
        status: "cancelled",
        createdAt: { gte: monthStart },
      },
    });

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      periods: {
        today: {
          count: today._count,
          total: today._sum.totalAmount || 0,
          quantity: today._sum.totalQuantity || 0,
        },
        week: {
          count: week._count,
          total: week._sum.totalAmount || 0,
          quantity: week._sum.totalQuantity || 0,
        },
        month: {
          count: month._count,
          total: month._sum.totalAmount || 0,
          quantity: month._sum.totalQuantity || 0,
        },
        year: {
          count: year._count,
          total: year._sum.totalAmount || 0,
          quantity: year._sum.totalQuantity || 0,
        },
      },
      last7Days,
      topProducts: topProductsRaw.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantity: p._sum.quantity || 0,
        revenue: p._sum.totalPrice || 0,
        salesCount: p._count,
      })),
      paymentMethods: paymentMethods.map((pm) => ({
        method: pm.paymentMethod,
        total: pm._sum.totalAmount || 0,
        count: pm._count,
      })),
      outstanding: {
        count: outstanding._count,
        totalAmount: outstanding._sum.totalAmount || 0,
        paidAmount: outstanding._sum.paidAmount || 0,
        dueAmount: (outstanding._sum.totalAmount || 0) - (outstanding._sum.paidAmount || 0),
      },
      cancelledCount,
    });
  } catch (error) {
    console.error("Sales stats error:", error);
    return NextResponse.json({ error: "Failed to fetch sales stats" }, { status: 500 });
  }
}
