// ── GET /api/businesses/[id]/subscription ──
// Returns a unified view of the business's subscription state: tier info,
// tier limits & features, and current usage (products, users, AI).
//
// Used by the in-app "Subscription" page and the upgrade-flow UI.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTierConfig } from "@/lib/feature-gate";
import { getAIUsageStats } from "@/lib/ai-rate-limit";

// ── GET: subscription + limits + features + usage ──
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    // ── Load business ──
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        aiEnabled: true,
        aiDailyLimit: true,
        aiMonthlyLimit: true,
        aiTokenBudget: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // ── Tier config (limits + features + price + label) ──
    const tierConfig = getTierConfig(business.subscriptionTier);

    // ── Usage: products ──
    const productCount = await db.product.count({
      where: { businessId, isActive: true },
    });
    const maxProducts = tierConfig.limits.maxProducts; // null = unlimited

    // ── Usage: business users ──
    const userCount = await db.businessUser.count({
      where: { businessId },
    });
    // Free tier = single user only (the owner). Paid tiers = unlimited.
    const maxUsers = tierConfig.limits.multiUserEnabled ? null : 1;

    // ── Usage: AI ──
    // Base stats (today + this month calls/tokens/cost)
    const aiUsageStats = await getAIUsageStats(businessId);

    // Per-feature breakdown (this month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const perFeatureRows = await db.aIUsageLog.groupBy({
      by: ["feature"],
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true, costEstimate: true },
      _count: true,
      orderBy: { _count: { feature: "desc" } },
    });
    const perFeature = perFeatureRows.map((r) => ({
      feature: r.feature,
      calls: r._count,
      tokens: r._sum.tokensUsed || 0,
      cost: r._sum.costEstimate || 0,
    }));

    // 7-day trend (per-day totals across all features)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentRows = await db.aIUsageLog.findMany({
      where: { businessId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, tokensUsed: true, costEstimate: true, success: true },
    });
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

    // Success/failure split (this month)
    const [successCount, failureCount] = await Promise.all([
      db.aIUsageLog.count({
        where: { businessId, createdAt: { gte: monthStart }, success: true },
      }),
      db.aIUsageLog.count({
        where: { businessId, createdAt: { gte: monthStart }, success: false },
      }),
    ]);

    // ── Assemble response ──
    return NextResponse.json({
      success: true,
      generatedAt: now.toISOString(),
      subscription: {
        tier: business.subscriptionTier,
        tierLabel: tierConfig.label,
        tierPrice: tierConfig.price,
        status: business.subscriptionStatus,
        startDate: business.subscriptionStart,
        endDate: business.subscriptionEnd,
      },
      limits: {
        // From tier config
        maxProducts: tierConfig.limits.maxProducts,
        multiUserEnabled: tierConfig.limits.multiUserEnabled,
        aiEnabled: tierConfig.limits.aiEnabled,
        aiDailyLimit: tierConfig.limits.aiDailyLimit,
        aiMonthlyLimit: tierConfig.limits.aiMonthlyLimit,
        aiTokenBudget: tierConfig.limits.aiTokenBudget,
        // Per-business overrides (0 = fall back to platform default)
        businessOverrides: {
          aiEnabled: business.aiEnabled,
          aiDailyLimit: business.aiDailyLimit,
          aiMonthlyLimit: business.aiMonthlyLimit,
          aiTokenBudget: business.aiTokenBudget,
        },
      },
      features: tierConfig.features,
      usage: {
        products: {
          current: productCount,
          max: maxProducts,
          unlimited: maxProducts === null,
        },
        users: {
          current: userCount,
          max: maxUsers,
          unlimited: maxUsers === null,
        },
        ai: {
          ...aiUsageStats,
          perFeature,
          last7Days,
          successFailure: {
            success: successCount,
            failure: failureCount,
            successRate:
              successCount + failureCount > 0
                ? successCount / (successCount + failureCount)
                : null,
          },
        },
      },
    });
  } catch (error) {
    console.error("[businesses/[id]/subscription] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription details" },
      { status: 500 }
    );
  }
}
