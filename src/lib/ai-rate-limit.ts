// ── InventoryOS: AI Rate Limiter ──
//
// Per-business rate limiting for all AI features.
// Enforces five tiers of protection, in order of precedence:
//   1. Subscription status  — must be "trial" or "active" (not suspended/cancelled)
//   2. AI enabled flag      — Business.aiEnabled must be true
//   3. Burst                — max 5 calls per rolling 60-second window
//   4. Daily                — max 50 calls per calendar day
//   5. Monthly              — max 1000 calls per calendar month
//   6. Token budget         — max 500K tokens per calendar month
//
// Every AI route handler MUST call checkAILimit() *before* calling the LLM,
// and MUST call logAIUsage() *afterwards* (whether the call succeeded or failed)
// so usage counts stay accurate and cost can be reported in /admin.
//
// All limits can be overridden per-business via the Business model fields:
//   aiDailyLimit, aiMonthlyLimit, aiTokenBudget (a value of 0 falls back to the
//   default, so legacy rows that predate the column never block paid traffic).

import { db } from "./db";
import { getTierConfig } from "./feature-gate";
import { checkCircuitBreaker } from "./ai-circuit-breaker";
import { checkKillSwitch } from "./ai-kill-switch";

// ── Constants ──
export const BURST_WINDOW_SECONDS = 60;
export const BURST_MAX_CALLS = 5;

export const DEFAULT_DAILY_LIMIT = 50;
export const DEFAULT_MONTHLY_LIMIT = 1000;
export const DEFAULT_TOKEN_BUDGET = 500_000;

// Cost estimate: 0.03 BDT per 1K tokens (input + output combined).
// Used by logAIUsage() to populate AIUsageLog.costEstimate.
export const COST_PER_1K_TOKENS_BDT = 0.03;

// ── Types ──
export type AILimitType =
  | "burst"
  | "daily"
  | "monthly"
  | "tokens"
  | "ai_disabled"
  | "tier_blocked"
  | "circuit_open"
  | "kill_switch_open"
  | "subscription"
  | "not_found";

export interface AILimitResult {
  allowed: boolean;
  reason?: string;
  limitType?: AILimitType;
  /** Seconds until the caller may retry. Only set when allowed=false. */
  retryAfterSeconds?: number;
  remaining: {
    daily: number;
    monthly: number;
    tokens: number;
  };
}

export interface AIUsageStats {
  callsToday: number;
  callsThisMonth: number;
  tokensThisMonth: number;
  costThisMonth: number;
}

// ── Date helpers ──
function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Rough token-count estimate.
 * Heuristic: ~1 token ≈ 3.5 characters for typical English/Bangla mixed text.
 * Used for pre-flight budget checks and for logging when the LLM SDK doesn't
 * report actual token usage.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/**
 * Check whether the given business is allowed to make another AI call right now.
 *
 * Returns { allowed: true, remaining } if the call may proceed, or
 * { allowed: false, limitType, reason, retryAfterSeconds, remaining } if blocked.
 *
 * `remaining` is always populated so the UI can show live quota meters.
 */
export async function checkAILimit(businessId: string): Promise<AILimitResult> {
  const now = new Date();
  const todayStart = startOfToday(now);
  const monthStart = startOfMonth(now);
  const burstWindowStart = new Date(now.getTime() - BURST_WINDOW_SECONDS * 1000);

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      aiEnabled: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      aiDailyLimit: true,
      aiMonthlyLimit: true,
      aiTokenBudget: true,
    },
  });

  if (!business) {
    return {
      allowed: false,
      reason: "Business not found",
      limitType: "not_found",
      remaining: { daily: 0, monthly: 0, tokens: 0 },
    };
  }

  // 0. Kill-switch check — Phase 4. The master breaker. Runs FIRST, before
  // all other checks. If any of the 4 triggers is active for this business
  // (or platform-wide), block immediately. This is the only check that can
  // block a paying pro_ai customer with full quota remaining.
  const killSwitch = await checkKillSwitch(businessId);
  if (killSwitch.open) {
    return {
      allowed: false,
      reason: killSwitch.reason || "Kill-switch is active",
      limitType: "kill_switch_open",
      remaining: { daily: 0, monthly: 0, tokens: 0 },
    };
  }

  // Per-business overrides (0 → fall back to platform default)
  const dailyLimit = business.aiDailyLimit || DEFAULT_DAILY_LIMIT;
  const monthlyLimit = business.aiMonthlyLimit || DEFAULT_MONTHLY_LIMIT;
  const tokenBudget = business.aiTokenBudget || DEFAULT_TOKEN_BUDGET;

  // When we early-return before computing usage, "remaining" is the full quota
  // (so the UI doesn't show misleading zeros for an AI-disabled business).
  const fullRemaining = { daily: dailyLimit, monthly: monthlyLimit, tokens: tokenBudget };

  // 1. Subscription status check
  if (business.subscriptionStatus === "suspended" || business.subscriptionStatus === "cancelled") {
    return {
      allowed: false,
      reason: `Subscription is ${business.subscriptionStatus}`,
      limitType: "subscription",
      remaining: fullRemaining,
    };
  }

  // 2. Tier check — Phase 2 P1 fix (Risk #3 in AI Features Report).
  // The Business.aiEnabled boolean is a manual founder override (set from /admin).
  // The tier check is the structural gate: only pro_ai tier should reach the LLM.
  // This closes the "free-tier user can hit AI" gap identified in Section 4.2.
  const tierConfig = getTierConfig(business.subscriptionTier);
  if (!tierConfig.limits.aiEnabled) {
    return {
      allowed: false,
      reason: `AI features require the Pro+AI tier. Your current tier is "${business.subscriptionTier || "free"}". Please upgrade at /subscription.`,
      limitType: "tier_blocked",
      remaining: fullRemaining,
    };
  }

  // 3. AI enabled flag check (manual founder override — separate from tier gate)
  if (!business.aiEnabled) {
    return {
      allowed: false,
      reason: "AI features are not enabled for this business",
      limitType: "ai_disabled",
      remaining: fullRemaining,
    };
  }

  // 4. Circuit breaker check — Phase 2 P1 fix.
  // Trips when 24h token usage exceeds 80% of monthly budget. Blocks the call
  // with a fallback response so a runaway script or chatty user can't burn the
  // entire monthly budget in a single day. Auto-recovers as the 24h window slides.
  const breaker = await checkCircuitBreaker(businessId);
  if (breaker.open) {
    return {
      allowed: false,
      reason: breaker.reason || "Circuit breaker tripped — daily AI usage limit reached",
      limitType: "circuit_open",
      remaining: {
        daily: dailyLimit,
        monthly: monthlyLimit,
        tokens: Math.max(0, breaker.tokensBudget - breaker.tokensUsed24h),
      },
    };
  }

  // Aggregate current usage in parallel
  const [burstCount, callsToday, callsThisMonth, tokensAgg] = await Promise.all([
    // Burst: every call (success OR failure) within the rolling 60s window.
    // Counting failures too prevents tight retry loops from punching through.
    db.aIUsageLog.count({
      where: { businessId, createdAt: { gte: burstWindowStart } },
    }),
    db.aIUsageLog.count({
      where: { businessId, createdAt: { gte: todayStart } },
    }),
    db.aIUsageLog.count({
      where: { businessId, createdAt: { gte: monthStart } },
    }),
    db.aIUsageLog.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true },
    }),
  ]);

  const tokensThisMonth = tokensAgg._sum.tokensUsed || 0;

  const remaining = {
    daily: Math.max(0, dailyLimit - callsToday),
    monthly: Math.max(0, monthlyLimit - callsThisMonth),
    tokens: Math.max(0, tokenBudget - tokensThisMonth),
  };

  // 3. Burst check
  if (burstCount >= BURST_MAX_CALLS) {
    // Find the oldest call still inside the 60s window — once it ages out,
    // a slot opens up. retryAfter = seconds until that happens.
    const oldestInWindow = await db.aIUsageLog.findFirst({
      where: { businessId, createdAt: { gte: burstWindowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    let retryAfterSeconds = BURST_WINDOW_SECONDS;
    if (oldestInWindow) {
      const elapsedSeconds = Math.floor(
        (now.getTime() - oldestInWindow.createdAt.getTime()) / 1000
      );
      retryAfterSeconds = Math.max(1, BURST_WINDOW_SECONDS - elapsedSeconds);
    }

    return {
      allowed: false,
      reason: `Burst limit exceeded (${BURST_MAX_CALLS} calls per ${BURST_WINDOW_SECONDS}s)`,
      limitType: "burst",
      retryAfterSeconds,
      remaining,
    };
  }

  // 4. Daily check
  if (callsToday >= dailyLimit) {
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((tomorrow.getTime() - now.getTime()) / 1000)
    );
    return {
      allowed: false,
      reason: `Daily limit exceeded (${dailyLimit} calls/day)`,
      limitType: "daily",
      retryAfterSeconds,
      remaining,
    };
  }

  // 5. Monthly check
  if (callsThisMonth >= monthlyLimit) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((nextMonth.getTime() - now.getTime()) / 1000)
    );
    return {
      allowed: false,
      reason: `Monthly limit exceeded (${monthlyLimit} calls/month)`,
      limitType: "monthly",
      retryAfterSeconds,
      remaining,
    };
  }

  // 6. Token budget check
  if (tokensThisMonth >= tokenBudget) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((nextMonth.getTime() - now.getTime()) / 1000)
    );
    return {
      allowed: false,
      reason: `Monthly token budget exceeded (${tokenBudget} tokens/month)`,
      limitType: "tokens",
      retryAfterSeconds,
      remaining,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Log an AI call outcome. Creates an AIUsageLog row with an estimated cost
 * (0.03 BDT per 1K tokens). Safe to call from any route handler — never throws
 * (failures are logged to console but do not break the request).
 */
export async function logAIUsage(
  businessId: string,
  feature: string,
  tokensUsed: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const safeTokens = Math.max(0, Math.floor(tokensUsed));
  const costEstimate = (safeTokens / 1000) * COST_PER_1K_TOKENS_BDT;

  try {
    await db.aIUsageLog.create({
      data: {
        businessId,
        feature,
        tokensUsed: safeTokens,
        costEstimate,
        success,
        errorMessage: errorMessage || null,
      },
    });
  } catch (err) {
    // Logging must never break the request flow — the user already got (or is
    // about to get) their response. Just record the failure for ops.
    console.error("[ai-rate-limit] logAIUsage failed:", err);
  }
}

/**
 * Return a snapshot of this business's AI usage for the current day and month.
 * Used by the /admin AI usage dashboard and the in-app quota meter.
 */
export async function getAIUsageStats(businessId: string): Promise<AIUsageStats> {
  const now = new Date();
  const todayStart = startOfToday(now);
  const monthStart = startOfMonth(now);

  const [callsToday, callsThisMonth, monthAgg] = await Promise.all([
    db.aIUsageLog.count({
      where: { businessId, createdAt: { gte: todayStart } },
    }),
    db.aIUsageLog.count({
      where: { businessId, createdAt: { gte: monthStart } },
    }),
    db.aIUsageLog.aggregate({
      where: { businessId, createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true, costEstimate: true },
    }),
  ]);

  return {
    callsToday,
    callsThisMonth,
    tokensThisMonth: monthAgg._sum.tokensUsed || 0,
    costThisMonth: monthAgg._sum.costEstimate || 0,
  };
}
