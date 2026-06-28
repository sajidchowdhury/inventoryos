// ── GET /api/super-admin/ai-usage ──
// Platform-wide AI usage analytics: summary, by-feature, by-business, 7-day
// trend, top spenders today, abuse flags, plus SQL-router and cache hit rates.
//
// Auth: callers must authenticate via `Authorization: Bearer <superAdminToken>`.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Verify the Bearer token belongs to an active, non-expired super-admin session.
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
    console.error("[super-admin/ai-usage] session lookup failed:", err);
    return null;
  }
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ── GET: platform-wide AI usage ──
export async function GET(req: NextRequest) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = startOfToday(now);
    const monthStart = startOfMonth(now);

    // ── Summary: today + this month calls/tokens/cost ──
    const [todayAgg, monthAgg] = await Promise.all([
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { tokensUsed: true, costEstimate: true },
        _count: true,
      }),
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { tokensUsed: true, costEstimate: true },
        _count: true,
      }),
    ]);

    const summary = {
      today: {
        calls: todayAgg._count,
        tokens: todayAgg._sum.tokensUsed || 0,
        cost: todayAgg._sum.costEstimate || 0,
      },
      thisMonth: {
        calls: monthAgg._count,
        tokens: monthAgg._sum.tokensUsed || 0,
        cost: monthAgg._sum.costEstimate || 0,
      },
    };

    // ── byFeature (this month, groupBy feature) ──
    const byFeatureRows = await db.aIUsageLog.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true, costEstimate: true },
      _count: true,
      orderBy: { _count: { feature: "desc" } },
    });
    const byFeature = byFeatureRows.map((r) => ({
      feature: r.feature,
      calls: r._count,
      tokens: r._sum.tokensUsed || 0,
      cost: r._sum.costEstimate || 0,
    }));

    // ── byBusiness (this month, top 10 by calls) ──
    const byBusinessRows = await db.aIUsageLog.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true, costEstimate: true },
      _count: true,
      orderBy: { _count: { businessId: "desc" } },
      take: 10,
    });

    // Hydrate business names in a single findMany
    const businessIds = byBusinessRows.map((r) => r.businessId);
    const businessLookup = businessIds.length
      ? await db.business.findMany({
          where: { id: { in: businessIds } },
          select: { id: true, name: true, subscriptionTier: true },
        })
      : [];
    const businessMap = new Map(businessLookup.map((b) => [b.id, b]));

    const byBusiness = byBusinessRows.map((r) => {
      const biz = businessMap.get(r.businessId);
      return {
        businessId: r.businessId,
        businessName: biz?.name ?? null,
        subscriptionTier: biz?.subscriptionTier ?? null,
        calls: r._count,
        tokens: r._sum.tokensUsed || 0,
        cost: r._sum.costEstimate || 0,
      };
    });

    // ── last7Days (daily trend) ──
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7DaysRows = await db.aIUsageLog.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _sum: { tokensUsed: true, costEstimate: true },
      _count: true,
    });
    // We want a per-day trend, so we have to fetch raw rows and bucket locally
    // (Prisma groupBy can't bucket by date with SQLite without raw SQL).
    const recentRows = await db.aIUsageLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, tokensUsed: true, costEstimate: true, success: true },
    });

    // Build the 7-day window: 7 buckets ending today
    const last7Days: Array<{
      date: string;
      calls: number;
      tokens: number;
      cost: number;
      successes: number;
      failures: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRows = recentRows.filter(
        (r) => r.createdAt >= dayStart && r.createdAt <= dayEnd
      );
      last7Days.push({
        date: dayStart.toISOString().split("T")[0],
        calls: dayRows.length,
        tokens: dayRows.reduce((s, r) => s + (r.tokensUsed || 0), 0),
        cost: dayRows.reduce((s, r) => s + (r.costEstimate || 0), 0),
        successes: dayRows.filter((r) => r.success).length,
        failures: dayRows.filter((r) => !r.success).length,
      });
    }
    // Note: last7DaysRows was only fetched as a sanity groupBy — we rely on
    // recentRows for the actual per-day buckets above. Suppress unused var.
    void last7DaysRows;

    // ── topSpendersToday (top 5 businesses by calls today) ──
    const topTodayRows = await db.aIUsageLog.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: todayStart } },
      _sum: { tokensUsed: true, costEstimate: true },
      _count: true,
      orderBy: { _count: { businessId: "desc" } },
      take: 5,
    });
    const topTodayIds = topTodayRows.map((r) => r.businessId);
    const topTodayLookup = topTodayIds.length
      ? await db.business.findMany({
          where: { id: { in: topTodayIds } },
          select: { id: true, name: true, subscriptionTier: true, aiEnabled: true },
        })
      : [];
    const topTodayMap = new Map(topTodayLookup.map((b) => [b.id, b]));
    const topSpendersToday = topTodayRows.map((r) => {
      const biz = topTodayMap.get(r.businessId);
      return {
        businessId: r.businessId,
        businessName: biz?.name ?? null,
        subscriptionTier: biz?.subscriptionTier ?? null,
        aiEnabled: biz?.aiEnabled ?? null,
        callsToday: r._count,
        tokensToday: r._sum.tokensUsed || 0,
        costToday: r._sum.costEstimate || 0,
      };
    });

    // ── abuseFlags (businesses > 20 calls today = high_usage, > 40 = possible_abuse) ──
    const allTodayByBusiness = await db.aIUsageLog.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: todayStart } },
      _count: true,
      orderBy: { _count: { businessId: "desc" } },
    });
    const abuseBusinessIds = allTodayByBusiness
      .filter((r) => r._count > 20)
      .map((r) => r.businessId);
    const abuseLookup = abuseBusinessIds.length
      ? await db.business.findMany({
          where: { id: { in: abuseBusinessIds } },
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            aiEnabled: true,
            aiDailyLimit: true,
          },
        })
      : [];
    const abuseMap = new Map(abuseLookup.map((b) => [b.id, b]));
    const abuseFlags = allTodayByBusiness
      .filter((r) => r._count > 20)
      .map((r) => {
        const biz = abuseMap.get(r.businessId);
        return {
          businessId: r.businessId,
          businessName: biz?.name ?? null,
          subscriptionTier: biz?.subscriptionTier ?? null,
          aiEnabled: biz?.aiEnabled ?? null,
          aiDailyLimit: biz?.aiDailyLimit ?? null,
          callsToday: r._count,
          flag: r._count > 40 ? "possible_abuse" : "high_usage",
        };
      });

    // ── SQL-router metrics ──
    // hitRate = sql-router:* calls / total chat calls
    // "total chat calls" = feature = "chat" OR feature starts with "sql-router:"
    // (sql-router intercepts chat attempts — both are user-initiated chats)
    const todaySqlRouterAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: todayStart },
        feature: { startsWith: "sql-router:" },
      },
      _count: true,
    });
    const todayChatAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: todayStart },
        feature: "chat",
      },
      _count: true,
    });
    const monthSqlRouterAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: monthStart },
        feature: { startsWith: "sql-router:" },
      },
      _count: true,
    });
    const monthChatAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: monthStart },
        feature: "chat",
      },
      _count: true,
    });

    const todayChatTotal = todaySqlRouterAgg._count + todayChatAgg._count;
    const monthChatTotal = monthSqlRouterAgg._count + monthChatAgg._count;
    const sqlRouter = {
      today: {
        routerHits: todaySqlRouterAgg._count,
        llmCalls: todayChatAgg._count,
        total: todayChatTotal,
        hitRate: todayChatTotal > 0 ? todaySqlRouterAgg._count / todayChatTotal : 0,
      },
      thisMonth: {
        routerHits: monthSqlRouterAgg._count,
        llmCalls: monthChatAgg._count,
        total: monthChatTotal,
        hitRate: monthChatTotal > 0 ? monthSqlRouterAgg._count / monthChatTotal : 0,
      },
    };

    // ── Cache metrics ──
    // hitRate = *-cache calls / (LLM calls + cache calls)
    // i.e., of every AI request served, what fraction came from cache.
    const todayCacheAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: todayStart },
        feature: { endsWith: "-cache" },
      },
      _count: true,
    });
    const todayLlmAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: todayStart },
        NOT: { feature: { endsWith: "-cache" } },
      },
      _count: true,
    });
    const monthCacheAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: monthStart },
        feature: { endsWith: "-cache" },
      },
      _count: true,
    });
    const monthLlmAgg = await db.aIUsageLog.aggregate({
      where: {
        createdAt: { gte: monthStart },
        NOT: { feature: { endsWith: "-cache" } },
      },
      _count: true,
    });

    const todayAiTotal = todayCacheAgg._count + todayLlmAgg._count;
    const monthAiTotal = monthCacheAgg._count + monthLlmAgg._count;
    const cache = {
      today: {
        cacheHits: todayCacheAgg._count,
        llmCalls: todayLlmAgg._count,
        total: todayAiTotal,
        hitRate: todayAiTotal > 0 ? todayCacheAgg._count / todayAiTotal : 0,
      },
      thisMonth: {
        cacheHits: monthCacheAgg._count,
        llmCalls: monthLlmAgg._count,
        total: monthAiTotal,
        hitRate: monthAiTotal > 0 ? monthCacheAgg._count / monthAiTotal : 0,
      },
    };

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      summary,
      byFeature,
      byBusiness,
      last7Days,
      topSpendersToday,
      abuseFlags,
      sqlRouter,
      cache,
    });
  } catch (error) {
    console.error("[super-admin/ai-usage] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI usage stats" },
      { status: 500 }
    );
  }
}
