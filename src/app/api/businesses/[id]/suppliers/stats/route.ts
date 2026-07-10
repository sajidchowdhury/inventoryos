// GET /api/businesses/[id]/suppliers/stats
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const now = new Date();
    const monthStart = new Date(now); monthStart.setMonth(monthStart.getMonth() - 1);

    // Overall totals
    const totals = await db.supplier.aggregate({
      where: { businessId, isActive: true },
      _sum: { balance: true, totalPurchased: true, totalPaid: true },
      _count: true,
    });

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
      select: { id: true, name: true, code: true, balance: true },
    });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

    // Suppliers with outstanding balance (top 5 by balance)
    const topOutstanding = await db.supplier.findMany({
      where: { businessId, isActive: true, balance: { gt: 0 } },
      orderBy: { balance: "desc" },
      take: 5,
      select: { id: true, name: true, code: true, balance: true, totalPurchased: true },
    });

    // Total outstanding payables
    const outstandingSuppliers = await db.supplier.count({
      where: { businessId, isActive: true, balance: { gt: 0 } },
    });

    // Monthly trend (last 7 days of purchases)
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

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      totals: {
        supplierCount: totals._count,
        totalPurchased: totals._sum.totalPurchased || 0,
        totalPaid: totals._sum.totalPaid || 0,
        totalOutstanding: totals._sum.balance || 0,
        outstandingSuppliers,
      },
      topSuppliers: topSuppliers.map((s) => ({
        supplier: supplierMap.get(s.supplierId || "") || null,
        totalPurchased: s._sum.totalAmount || 0,
        purchaseCount: s._count,
      })),
      topOutstanding,
      last7Days,
    });
  } catch (error) {
    console.error("Supplier stats error:", error);
    return NextResponse.json({ error: "Failed to fetch supplier stats" }, { status: 500 });
  }
}
