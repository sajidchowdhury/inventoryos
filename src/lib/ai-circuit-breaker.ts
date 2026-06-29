// src/lib/ai-circuit-breaker.ts
// Phase 2 P1 fix: Global circuit breaker for AI cost protection.
//
// Purpose: prevents a single business from burning more than 80% of their
// monthly token budget in any 24-hour window. When the breaker trips, all
// subsequent AI calls for that business return a fallback response instead
// of hitting the LLM — until the next calendar day (UTC) resets the window.
//
// This is the single most important defense against runaway cost. Even if
// every other safeguard fails (max_tokens, rate limits, tier checks), the
// circuit breaker caps the worst-case per-pharmacy daily AI spend at 80%
// of the monthly token budget — i.e., 400,000 tokens = ~12 BDT in one day.
//
// The breaker is stateless on the application side — it queries AIUsageLog
// on every check. This means:
//   - No in-memory state to lose on restart
//   - No cache invalidation problems
//   - Slight DB cost (one aggregate query per AI call) — acceptable given
//     AI calls themselves cost money
//
// Trip condition: tokensUsed in the last 24 hours > 80% of aiTokenBudget.
// Recovery: automatic at the next UTC midnight (the 24h window slides).

import { db } from "./db";

// ── Constants ──
/** Trip when 24h token usage exceeds this fraction of the monthly budget. */
export const CIRCUIT_BREAKER_THRESHOLD = 0.8; // 80%

/** Window size in hours. 24 = sliding day window. */
export const CIRCUIT_BREAKER_WINDOW_HOURS = 24;

export interface CircuitBreakerResult {
  /** True = breaker is tripped; AI calls should be blocked. */
  open: boolean;
  /** Tokens used in the last 24h (always populated, even when open=false). */
  tokensUsed24h: number;
  /** The business's monthly token budget. */
  tokensBudget: number;
  /** The threshold at which the breaker trips (80% of budget). */
  tokensThreshold: number;
  /** Percentage of budget used in 24h (0-100). */
  percentUsed: number;
  /** Reason string for logging/UI. */
  reason?: string;
}

/**
 * Check whether the circuit breaker is tripped for the given business.
 *
 * Returns { open: true, ... } if the business has used more than 80% of their
 * monthly token budget in the last 24 hours. In that case, the AI route should
 * return a fallback response instead of calling the LLM.
 *
 * Returns { open: false, ... } otherwise. The usage stats are still populated
 * so the route can include them in the response for monitoring/debugging.
 *
 * Never throws — on DB error, returns open:false so AI calls proceed (fail-open
 * for availability; the rate limiter and token budget cap still protect cost).
 */
export async function checkCircuitBreaker(
  businessId: string
): Promise<CircuitBreakerResult> {
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - CIRCUIT_BREAKER_WINDOW_HOURS * 60 * 60 * 1000
  );

  try {
    // Fetch the business's token budget and 24h usage in parallel
    const [business, usageAgg] = await Promise.all([
      db.business.findUnique({
        where: { id: businessId },
        select: {
          aiTokenBudget: true,
          subscriptionTier: true,
        },
      }),
      db.aIUsageLog.aggregate({
        where: {
          businessId,
          createdAt: { gte: windowStart },
        },
        _sum: { tokensUsed: true },
      }),
    ]);

    if (!business) {
      // Business not found — let the rate limiter handle this case.
      return {
        open: false,
        tokensUsed24h: 0,
        tokensBudget: 0,
        tokensThreshold: 0,
        percentUsed: 0,
      };
    }

    // aiTokenBudget = 0 means "use platform default" (500K). Same convention
    // as the rate limiter — never let a legacy 0 value block traffic.
    const DEFAULT_BUDGET = 500_000;
    const tokensBudget = business.aiTokenBudget || DEFAULT_BUDGET;
    const tokensThreshold = Math.floor(tokensBudget * CIRCUIT_BREAKER_THRESHOLD);
    const tokensUsed24h = usageAgg._sum.tokensUsed || 0;
    const percentUsed =
      tokensBudget > 0 ? Math.round((tokensUsed24h / tokensBudget) * 100) : 0;

    if (tokensUsed24h > tokensThreshold) {
      return {
        open: true,
        tokensUsed24h,
        tokensBudget,
        tokensThreshold,
        percentUsed,
        reason: `Circuit breaker tripped: used ${tokensUsed24h.toLocaleString()} tokens in the last 24h (${percentUsed}% of monthly budget). Threshold is ${tokensThreshold.toLocaleString()} tokens (80%). AI calls are blocked until the 24h window slides.`,
      };
    }

    return {
      open: false,
      tokensUsed24h,
      tokensBudget,
      tokensThreshold,
      percentUsed,
    };
  } catch (err) {
    // Fail-open: log and allow the call. The rate limiter's monthly token
    // cap is the backstop — worst case we burn the full monthly budget,
    // not more.
    console.error("[ai-circuit-breaker] check failed, failing open:", err);
    return {
      open: false,
      tokensUsed24h: 0,
      tokensBudget: 0,
      tokensThreshold: 0,
      percentUsed: 0,
      reason: "Circuit breaker check failed (DB error); failing open.",
    };
  }
}

/**
 * Convenience helper: returns true if the breaker is tripped.
 * Use this in route handlers that only need the boolean.
 */
export async function isCircuitOpen(businessId: string): Promise<boolean> {
  const result = await checkCircuitBreaker(businessId);
  return result.open;
}
