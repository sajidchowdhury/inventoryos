import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/businesses/[id]/cctv/cloud-dashboard
// Aggregates KPIs for the desktop cloud dashboard (7C)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const thirtyDays = new Date(Date.now() + 30 * 86400000);

  // ── Parallel queries ──
  const [
    totalProducts,
    totalStock,
    lowStockCount,
    salesThisMonth,
    salesLastMonth,
    pendingJobs,
    overdueJobs,
    activeEmi,
    emiCollectedThisMonth,
    activeAmc,
    expiringAmc,
    totalCustomers,
    mushakInvoicesThisMonth,
    salesThisMonthRev,
    salesLastMonthRev,
    categories,
  ] = await Promise.all([
    db.cCTVProduct.count({ where: { businessId, isActive: true } }),
    db.cCTVSerialItem.count({ where: { businessId, isActive: true, status: 'IN_STOCK' } }),
    db.cCTVProduct.count({ where: { businessId, isActive: true, stock: { lt: 3 } } }),
    db.cCTVSale.count({ where: { businessId, isActive: true, createdAt: { gte: monthStart } } }),
    db.cCTVSale.count({ where: { businessId, isActive: true, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    db.cCTVJobCard.count({
      where: { businessId, isActive: true, status: { in: ['RECEIVED', 'DIAGNOSING', 'AWAITING_PARTS', 'IN_PROGRESS', 'TESTING'] } },
    }),
    db.cCTVJobCard.count({ where: { businessId, isActive: true, status: 'OUTSOURCED', expectedReturn: { lt: now } } }),
    db.cCTVEmiPlan.count({ where: { businessId, isActive: true, status: 'ACTIVE' } }),
    db.cCTVEmiInstallment.aggregate({
      where: { businessId, isActive: true, status: 'PAID', paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.cCTVAmcContract.count({ where: { businessId, isActive: true, status: 'ACTIVE' } }),
    db.cCTVAmcContract.count({ where: { businessId, isActive: true, status: 'ACTIVE', endDate: { lte: thirtyDays } } }),
    db.customer.count({ where: { businessId } }),
    db.cCTVMushakInvoice.count({ where: { businessId, isActive: true, issueDate: { gte: monthStart } } }),
    db.cCTVSale.aggregate({
      where: { businessId, isActive: true, createdAt: { gte: monthStart } },
      _sum: { totalDue: true },
    }),
    db.cCTVSale.aggregate({
      where: { businessId, isActive: true, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { totalDue: true },
    }),
    db.cCTVCategory.findMany({
      where: { businessId, isActive: true },
      include: { _count: { select: { cctvProducts: { where: { isActive: true } } } } },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Sales trend: last 6 months
  const salesTrend: { month: string; sales: number; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const mLabel = mStart.toLocaleString('en', { month: 'short' });
    const [count, rev] = await Promise.all([
      db.cCTVSale.count({ where: { businessId, isActive: true, createdAt: { gte: mStart, lte: mEnd } } }),
      db.cCTVSale.aggregate({
        where: { businessId, isActive: true, createdAt: { gte: mStart, lte: mEnd } },
        _sum: { totalDue: true },
      }),
    ]);
    salesTrend.push({ month: mLabel, sales: count, revenue: rev._sum.totalDue || 0 });
  }

  const categoryBreakdown = categories.map((c) => ({
    name: c.name,
    color: c.color,
    productCount: c._count.cctvProducts,
  }));

  return NextResponse.json({
    success: true,
    data: {
      totalProducts, totalStock, lowStockCount, categoryBreakdown,
      salesThisMonth, salesLastMonth,
      revenueThisMonth: salesThisMonthRev._sum.totalDue || 0,
      revenueLastMonth: salesLastMonthRev._sum.totalDue || 0,
      mushakInvoicesThisMonth, salesTrend,
      pendingJobs, overdueJobs,
      activeEmiPlans: activeEmi,
      emiCollectedThisMonth: emiCollectedThisMonth._sum.amount || 0,
      activeAmcContracts: activeAmc,
      expiringAmcContracts: expiringAmc,
      totalCustomers,
    },
  });
}