// GET /api/businesses/[id]/payments/stats
// Returns payment aggregations for dashboard
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const now = new Date();

    // Date ranges
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);

    const [today, week, month] = await Promise.all([
      db.payment.aggregate({
        where: { businessId, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { businessId, createdAt: { gte: weekStart } },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { businessId, createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Last 7 days breakdown
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayData = await db.payment.aggregate({
        where: { businessId, createdAt: { gte: dayStart, lte: dayEnd } },
        _sum: { amount: true },
        _count: true,
      });

      last7Days.push({
        date: dayStart.toISOString().split("T")[0],
        dayName: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
        total: dayData._sum.amount || 0,
        count: dayData._count,
      });
    }

    // By payment method (last 30 days)
    const byMethod = await db.payment.groupBy({
      by: ["paymentMethod"],
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    });

    // Outstanding receivables (sales with partial/unpaid status)
    const outstanding = await db.sale.aggregate({
      where: {
        businessId,
        status: "completed",
        paymentStatus: { in: ["partial", "unpaid"] },
      },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    // Top paying customers (last 30 days)
    const topPayers = await db.payment.groupBy({
      by: ["customerId"],
      where: {
        businessId,
        customerId: { not: null },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    });

    // Enrich with customer names
    const customerIds = topPayers.map((p) => p.customerId).filter(Boolean) as string[];
    const customers = await db.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      periods: {
        today: { count: today._count, total: today._sum.amount || 0 },
        week: { count: week._count, total: week._sum.amount || 0 },
        month: { count: month._count, total: month._sum.amount || 0 },
      },
      last7Days,
      byMethod: byMethod.map((m) => ({
        method: m.paymentMethod,
        total: m._sum.amount || 0,
        count: m._count,
      })),
      outstanding: {
        count: outstanding._count,
        totalAmount: outstanding._sum.totalAmount || 0,
        paidAmount: outstanding._sum.paidAmount || 0,
        dueAmount: (outstanding._sum.totalAmount || 0) - (outstanding._sum.paidAmount || 0),
      },
      topPayers: topPayers.map((p) => ({
        customer: customerMap.get(p.customerId || "") || null,
        totalPaid: p._sum.amount || 0,
        paymentCount: p._count,
      })),
    });
  } catch (error) {
    console.error("Payment stats error:", error);
    return NextResponse.json({ error: "Failed to fetch payment stats" }, { status: 500 });
  }
}
