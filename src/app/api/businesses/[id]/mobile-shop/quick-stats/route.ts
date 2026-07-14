import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/businesses/[id]/mobile-shop/quick-stats
// Lightweight KPIs for the MoreHub quick-stats row
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: businessId } = await params;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todaySalesResult, pendingJobs, activeAmc] = await Promise.all([
      // Today's sales revenue (sum of totalDue for sales created today)
      db.mSSale.aggregate({
        where: { businessId, isActive: true, createdAt: { gte: todayStart } },
        _sum: { totalDue: true },
        _count: true,
      }),
      // Pending job cards (non-terminal statuses)
      db.mSJobCard.count({
        where: {
          businessId,
          isActive: true,
          status: {
            in: [
              'RECEIVED',
              'DIAGNOSING',
              'AWAITING_PARTS',
              'IN_PROGRESS',
              'TESTING',
              'OUTSOURCED',
            ],
          },
        },
      }),
      // Active AMC contracts
      db.mSAmcContract.count({
        where: { businessId, isActive: true, status: 'ACTIVE' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      todaySalesRevenue: todaySalesResult._sum.totalDue || 0,
      todaySalesCount: todaySalesResult._count,
      pendingJobs,
      activeAmc,
    });
  } catch (error) {
    console.error('Quick stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load stats' },
      { status: 500 },
    );
  }
}