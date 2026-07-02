// GET /api/businesses/[id]/purchases/stats
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const now = new Date();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);

    const [today, week, month] = await Promise.all([
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: weekStart } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
      db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: monthStart } },
        _sum: { totalAmount: true, paidAmount: true },
        _count: true,
      }),
    ]);

    // Last 7 days trend
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayData = await db.purchase.aggregate({
        where: { businessId, status: { not: "cancelled" }, createdAt: { gte: dayStart, lte: dayEnd } },
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

    // Top suppliers by purchase value (last 30 days)
    const topSuppliers = await db.purchase.groupBy({
      by: ["supplierId"],
      where: {
        businessId,
        status: { not: "cancelled" },
        supplierId: { not: null },
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    });

    const supplierIds = topSuppliers.map((s) => s.supplierId).filter(Boolean) as string[];
    const suppliers = await db.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true, code: true },
    });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

    // Outstanding payables
    const outstanding = await db.purchase.aggregate({
      where: { businessId, status: "received", paymentStatus: { in: ["partial", "unpaid"] } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    // Top purchased products (last 30 days)
    const topProducts = await db.purchaseItem.groupBy({
      by: ["productId", "productName"],
      where: {
        businessId,
        purchase: { status: { not: "cancelled" }, createdAt: { gte: monthStart } },
      },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      periods: {
        today: {
          count: today._count,
          total: today._sum.totalAmount || 0,
          paid: today._sum.paidAmount || 0,
        },
        week: {
          count: week._count,
          total: week._sum.totalAmount || 0,
          paid: week._sum.paidAmount || 0,
        },
        month: {
          count: month._count,
          total: month._sum.totalAmount || 0,
          paid: month._sum.paidAmount || 0,
        },
      },
      last7Days,
      topSuppliers: topSuppliers.map((s) => ({
        supplier: supplierMap.get(s.supplierId || "") || null,
        totalPurchased: s._sum.totalAmount || 0,
        purchaseCount: s._count,
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        quantity: p._sum.quantity || 0,
        totalCost: p._sum.totalPrice || 0,
        purchaseCount: p._count,
      })),
      outstanding: {
        count: outstanding._count,
        totalAmount: outstanding._sum.totalAmount || 0,
        paidAmount: outstanding._sum.paidAmount || 0,
        dueAmount: (outstanding._sum.totalAmount || 0) - (outstanding._sum.paidAmount || 0),
      },
    });
  } catch (error) {
    console.error("Purchase stats error:", error);
    return NextResponse.json({ error: "Failed to fetch purchase stats" }, { status: 500 });
  }
}
