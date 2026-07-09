// ── GET /api/super-admin/businesses ──
// Lists every business on the platform with related counts and current-month
// AI usage, plus platform-wide summary stats.
//
// Auth: callers must authenticate via `Authorization: Bearer <superAdminToken>`.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Verify the Bearer token belongs to an active, non-expired super-admin session.
 * Returns the session row (with superAdmin relation) on success, null otherwise.
 */
async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true,
        superAdminId: true,
        expiresAt: true,
        superAdmin: { select: { id: true, isActive: true } },
      },
    });

    if (
      !session ||
      !session.superAdmin.isActive ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch (err) {
    console.error("[super-admin/businesses] session lookup failed:", err);
    return null;
  }
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ── GET: list businesses + summary ──
export async function GET(req: NextRequest) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const monthStart = startOfMonth(now);

    // ── Fetch all businesses with related counts ──
    const businesses = await db.business.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            products: true,
            sales: true,
            customers: true,
            businessUsers: true,
          },
        },
        businessType: { select: { name: true, slug: true } },
        user: { select: { phone: true, name: true } },
      },
    });

    // ── Per-business AI usage this month ──
    // We aggregate in one groupBy pass and build a lookup map so we don't fire
    // one extra query per business.
    const aiUsageByBusiness = await db.aIUsageLog.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true, costEstimate: true },
      _count: true,
    });
    const aiUsageMap = new Map(
      aiUsageByBusiness.map((row) => [
        row.businessId,
        {
          calls: row._count,
          tokens: row._sum.tokensUsed || 0,
          cost: row._sum.costEstimate || 0,
        },
      ])
    );

    // ── Assemble per-business payload ──
    const enriched = businesses.map((biz) => {
      const ai = aiUsageMap.get(biz.id) ?? { calls: 0, tokens: 0, cost: 0 };
      return {
        id: biz.id,
        name: biz.name,
        phone: biz.phone,
        address: biz.address,
        isActive: biz.isActive,
        businessType: biz.businessType
          ? { name: biz.businessType.name, slug: biz.businessType.slug }
          : null,
        owner: biz.user
          ? { phone: biz.user.phone, name: biz.user.name }
          : null,
        subscription: {
          tier: biz.subscriptionTier,
          status: biz.subscriptionStatus,
          start: biz.subscriptionStart,
          end: biz.subscriptionEnd,
        },
        ai: {
          enabled: biz.aiEnabled,
          dailyLimit: biz.aiDailyLimit,
          monthlyLimit: biz.aiMonthlyLimit,
          tokenBudget: biz.aiTokenBudget,
        },
        usage: {
          products: biz._count.products,
          sales: biz._count.sales,
          customers: biz._count.customers,
          businessUsers: biz._count.businessUsers,
          aiUsageThisMonth: ai,
        },
        createdAt: biz.createdAt,
        updatedAt: biz.updatedAt,
      };
    });

    // ── Platform summary ──
    const totalBusinesses = businesses.length;
    const aiEnabledCount = businesses.filter((b) => b.aiEnabled).length;

    // totalAICallsThisMonth / totalAICostThisMonth derived from the same
    // groupBy above so we don't pay for a second aggregation.
    const totalAICallsThisMonth = aiUsageByBusiness.reduce(
      (sum, r) => sum + r._count,
      0
    );
    const totalAICostThisMonth = aiUsageByBusiness.reduce(
      (sum, r) => sum + (r._sum.costEstimate || 0),
      0
    );

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      businesses: enriched,
      summary: {
        totalBusinesses,
        aiEnabledCount,
        totalAICallsThisMonth,
        totalAICostThisMonth,
        monthStart: monthStart.toISOString(),
      },
    });
  } catch (error) {
    console.error("[super-admin/businesses] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}
