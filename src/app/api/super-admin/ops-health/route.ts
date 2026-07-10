// ── GET /api/super-admin/ops-health ──
// Phase 5: Operations health dashboard. Returns all the metrics the founder
// needs for the weekly + monthly + quarterly review rhythm described in the
// AI Features Report Section 7.5 (Table 7.5).
//
// Auth: super-admin Bearer token.
//
// Returns:
//   - weeklyReview: metrics to check every Monday
//   - monthlyComparison: actual vs estimated cost per feature for last month
//   - quarterlyReminders: Z.ai pricing re-eval + report re-run flags
//   - tierMix: subscriber count by tier
//   - healthStatus: overall platform AI health (healthy / watch / action_needed)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COST_PER_1K_TOKENS_BDT } from "@/lib/ai-rate-limit";
import { getActiveKillSwitches } from "@/lib/ai-kill-switch";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        superAdminId: true, expiresAt: true,
        superAdmin: { select: { id: true, isActive: true, username: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ── Cost model estimates from the AI Features Report Section 3.2 (Table 3.1) ──
// Used for the monthly comparison "actual vs estimated" check.
const COST_ESTIMATES_PER_CALL_BDT: Record<string, number> = {
  chat: 0.08,
  insights: 0.10,
  "expiry-optimizer": 0.12,
  "product-assistant": 0.04,
  "product-assistant-cache": 0, // cache hit = 0 tokens
  "product-assistant:generate_description": 0.01,
  "product-assistant:check_interactions": 0.04,
  "product-assistant:suggest_category": 0.02,
  "product-assistant:suggest_dosage": 0.03,
  forecast: 0, // deterministic, no LLM
  reorder: 0, // deterministic, no LLM
};

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // ── Parallel aggregations for weekly review ──
    const [
      thisWeekCost,
      lastWeekCost,
      thisWeekCalls,
      lastWeekCalls,
      todayCost,
      todayCalls,
      yesterdayCost,
      topSpendersThisWeek,
      thisWeekErrors,
      thisWeekKillSwitchTriggers,
      thisWeekCircuitOpen,
      activeKillSwitches,
    ] = await Promise.all([
      // This week's total cost
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: weekAgo } },
        _sum: { costEstimate: true },
      }),
      // Last week's total cost (for comparison)
      db.aIUsageLog.aggregate({
        where: {
          createdAt: {
            gte: new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: weekAgo,
          },
        },
        _sum: { costEstimate: true },
      }),
      // This week's call count
      db.aIUsageLog.count({ where: { createdAt: { gte: weekAgo } } }),
      // Last week's call count
      db.aIUsageLog.count({
        where: {
          createdAt: {
            gte: new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
            lt: weekAgo,
          },
        },
      }),
      // Today's cost
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
        _sum: { costEstimate: true },
      }),
      // Today's call count
      db.aIUsageLog.count({
        where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
      }),
      // Yesterday's cost
      db.aIUsageLog.aggregate({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
            lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
        _sum: { costEstimate: true },
      }),
      // Top 5 spenders this week (by business)
      db.aIUsageLog.groupBy({
        by: ["businessId"],
        where: { createdAt: { gte: weekAgo } },
        _sum: { costEstimate: true, tokensUsed: true },
        _count: true,
        orderBy: { _sum: { costEstimate: "desc" } },
        take: 5,
      }),
      // Error count this week
      db.aIUsageLog.count({
        where: { createdAt: { gte: weekAgo }, success: false },
      }),
      // Kill-switch triggers this week
      db.killSwitch.count({
        where: { triggeredAt: { gte: weekAgo } },
      }),
      // Circuit breaker triggers this week (feature contains 'circuit')
      db.aIUsageLog.count({
        where: {
          createdAt: { gte: weekAgo },
          errorMessage: { contains: "circuit" },
        },
      }),
      // Currently active kill-switches
      getActiveKillSwitches(),
    ]);

    // Fetch business names for top spenders
    const topSpenderIds = topSpendersThisWeek.map((s) => s.businessId);
    const topSpenderBusinesses = await db.business.findMany({
      where: { id: { in: topSpenderIds } },
      select: { id: true, name: true, subscriptionTier: true },
    });
    const businessMap = new Map(topSpenderBusinesses.map((b) => [b.id, b]));

    const topSpenders = topSpendersThisWeek.map((s) => {
      const biz = businessMap.get(s.businessId);
      return {
        businessId: s.businessId,
        businessName: biz?.name || "Unknown",
        tier: biz?.subscriptionTier || "unknown",
        cost: s._sum.costEstimate || 0,
        tokens: s._sum.tokensUsed || 0,
        calls: s._count,
      };
    });

    // ── Monthly comparison: actual vs estimated ──
    const lastMonthUsage = await db.aIUsageLog.groupBy({
      by: ["feature"],
      where: {
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { costEstimate: true, tokensUsed: true },
      _count: true,
    });

    const monthlyComparison = lastMonthUsage.map((u) => {
      const estimatedPerCall = COST_ESTIMATES_PER_CALL_BDT[u.feature] ?? 0.05;
      const estimatedTotal = u._count * estimatedPerCall;
      const actualTotal = u._sum.costEstimate || 0;
      const ratio = estimatedTotal > 0 ? actualTotal / estimatedTotal : 0;
      return {
        feature: u.feature,
        calls: u._count,
        tokensUsed: u._sum.tokensUsed || 0,
        actualCost: actualTotal,
        estimatedCost: estimatedTotal,
        varianceRatio: ratio, // 1.0 = matches estimate, 2.0 = 2x estimate
        status: ratio > 2 ? "investigate" : ratio > 1.5 ? "watch" : "ok",
      };
    });

    // ── Tier mix ──
    const tierMix = await db.business.groupBy({
      by: ["subscriptionTier"],
      _count: true,
    });
    const tierMixFormatted = tierMix.map((t) => ({
      tier: t.subscriptionTier,
      count: t._count,
    }));

    // ── This month's cost so far ──
    const thisMonthCost = await db.aIUsageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costEstimate: true },
    });

    // ── Quarterly reminders (deterministic — check if quarter just started) ──
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);
    const daysIntoQuarter = Math.floor((now.getTime() - quarterStart.getTime()) / (24 * 60 * 60 * 1000));
    const quarterlyReminders = {
      zaiPricingReeval: daysIntoQuarter <= 7, // show reminder in first week of quarter
      reportRerun: daysIntoQuarter <= 7,
      lastZaiCostPer1K: COST_PER_1K_TOKENS_BDT,
      daysIntoQuarter,
    };

    // ── Overall health status ──
    const thisWeekCostVal = thisWeekCost._sum.costEstimate || 0;
    const lastWeekCostVal = lastWeekCost._sum.costEstimate || 0;
    const costGrowthRate = lastWeekCostVal > 0
      ? ((thisWeekCostVal - lastWeekCostVal) / lastWeekCostVal) * 100
      : 0;

    let healthStatus: "healthy" | "watch" | "action_needed" = "healthy";
    const healthIssues: string[] = [];

    if (activeKillSwitches.length > 0) {
      healthStatus = "action_needed";
      healthIssues.push(`${activeKillSwitches.length} active kill-switch(es) — reset or investigate immediately`);
    }
    if (thisWeekErrors > thisWeekCalls * 0.05 && thisWeekCalls > 10) {
      healthStatus = "action_needed";
      healthIssues.push(`Error rate this week is ${((thisWeekErrors / thisWeekCalls) * 100).toFixed(1)}% (threshold: 5%) — investigate Sentry`);
    }
    if (costGrowthRate > 100 && thisWeekCalls > 20) {
      if (healthStatus === "healthy") healthStatus = "watch";
      healthIssues.push(`Cost grew ${costGrowthRate.toFixed(0)}% vs last week — check for new abusers or pricing changes`);
    }
    if (topSpenders.length > 0 && topSpenders[0].cost > thisWeekCostVal * 0.3 && thisWeekCostVal > 10) {
      if (healthStatus === "healthy") healthStatus = "watch";
      healthIssues.push(`Top spender (${topSpenders[0].businessName}) accounts for ${((topSpenders[0].cost / thisWeekCostVal) * 100).toFixed(0)}% of weekly cost — investigate`);
    }
    const investigateCount = monthlyComparison.filter((m) => m.status === "investigate").length;
    if (investigateCount > 0) {
      if (healthStatus === "healthy") healthStatus = "watch";
      healthIssues.push(`${investigateCount} feature(s) exceeded 2x cost estimate last month — review monthly comparison below`);
    }
    if (healthIssues.length === 0) {
      healthIssues.push("All metrics within expected ranges. No action needed this week.");
    }

    // ── Sentry error count (if configured) — best effort, don't fail if Sentry is down ──
    let sentryErrorCount: number | null = null;
    try {
      // We can't query Sentry from here without the API key, so we leave this
      // as a manual check item. The founder should click the Sentry link in the UI.
      sentryErrorCount = null;
    } catch {
      sentryErrorCount = null;
    }

    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      healthStatus,
      healthIssues,
      weeklyReview: {
        thisWeekCost: thisWeekCostVal,
        lastWeekCost: lastWeekCostVal,
        costGrowthRate,
        thisWeekCalls,
        lastWeekCalls,
        todayCost: todayCost._sum.costEstimate || 0,
        todayCalls,
        yesterdayCost: yesterdayCost._sum.costEstimate || 0,
        topSpenders,
        thisWeekErrors,
        thisWeekErrorRate: thisWeekCalls > 0 ? (thisWeekErrors / thisWeekCalls) * 100 : 0,
        thisWeekKillSwitchTriggers,
        thisWeekCircuitOpen,
        sentryErrorCount,
      },
      monthlyComparison: {
        lastMonthStart: lastMonthStart.toISOString(),
        lastMonthEnd: lastMonthEnd.toISOString(),
        thisMonthCostSoFar: thisMonthCost._sum.costEstimate || 0,
        features: monthlyComparison,
      },
      tierMix: tierMixFormatted,
      quarterlyReminders,
      activeKillSwitchCount: activeKillSwitches.length,
    });
  } catch (error) {
    console.error("[ops-health] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load operations health data" },
      { status: 500 }
    );
  }
}
