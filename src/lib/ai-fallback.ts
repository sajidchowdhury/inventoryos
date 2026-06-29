// ── InventoryOS: AI Fallback System ──
//
// When an AI request cannot be fulfilled — LLM timed out, rate limit hit,
// response couldn't be parsed, etc. — we return a structured FallbackResponse
// to the client instead of a generic 500 error. This lets the UI:
//   1. Show a helpful, bilingual (en/bn) message explaining what happened.
//   2. Optionally surface the last cached/successful response as a fallback.
//   3. Tell the user exactly when it's safe to retry (retryAfterSeconds).
//
// Used by every AI route handler in /api/businesses/[id]/ai/*.

import { db } from "./db";

// ── Types ──
export type FallbackReason =
  | "llm_unavailable"
  | "llm_timeout"
  | "rate_limit_daily"
  | "rate_limit_monthly"
  | "rate_limit_tokens"
  | "rate_limit_burst"
  | "circuit_open"
  | "tier_blocked"
  | "no_cached_data"
  | "parse_error"
  | "unknown";

export interface FallbackResponse<T = unknown> {
  /** Always `true` — lets the client distinguish a fallback from a real AI response. */
  fallback: true;
  fallbackReason: FallbackReason;
  /** English message, safe to show to users. */
  fallbackMessage: string;
  /** Bangla message, safe to show to users. */
  fallbackMessageBn: string;
  /** Whether the client should offer a "retry" button. */
  retryable: boolean;
  /** ISO timestamp of the cached response, if one was attached. */
  cachedAt?: string;
  /** Last successful response payload, if available and the caller attached it. */
  cachedData?: T;
  /** Seconds until the client should retry. Set for rate-limit reasons. */
  retryAfterSeconds?: number;
  /** Original error message (for logs/debugging; not shown to users). */
  errorMessage?: string;
}

// ── Bilingual message table ──
export const MESSAGES: Record<
  FallbackReason,
  { en: string; bn: string; retryable: boolean }
> = {
  llm_unavailable: {
    en: "The AI service is temporarily unavailable. Please try again in a few moments.",
    bn: "এআই পরিষেবা সাময়িকভাবে ব্যবহার করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    retryable: true,
  },
  llm_timeout: {
    en: "The AI request took too long to respond. Please try again.",
    bn: "এআই অনুরোধে অনেক সময় লেগে গেছে। আবার চেষ্টা করুন।",
    retryable: true,
  },
  rate_limit_daily: {
    en: "You have reached today's AI usage limit. Please come back tomorrow.",
    bn: "আজকের এআই ব্যবহারের সীমা পৌঁছে গেছে। অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।",
    retryable: true,
  },
  rate_limit_monthly: {
    en: "You have reached this month's AI usage limit. The limit resets next month.",
    bn: "এই মাসের এআই ব্যবহারের সীমা পৌঁছে গেছে। পরের মাসে সীমা রিসেট হবে।",
    retryable: true,
  },
  rate_limit_tokens: {
    en: "You have exhausted this month's AI token budget. The budget resets next month.",
    bn: "এই মাসের এআই টোকেন বাজেট শেষ হয়ে গেছে। পরের মাসে বাজেট রিসেট হবে।",
    retryable: true,
  },
  rate_limit_burst: {
    en: "You are making AI requests too quickly. Please slow down and try again shortly.",
    bn: "আপনি খুব দ্রুত এআই অনুরোধ করছেন। একটু ধীরে চেষ্টা করুন।",
    retryable: true,
  },
  circuit_open: {
    en: "Daily AI usage limit reached. You have used over 80% of your monthly token budget in the last 24 hours. AI features will be available again soon. Try again tomorrow or upgrade your plan.",
    bn: "দৈনিক এআই ব্যবহারের সীমা পৌঁছে গেছে। আপনি গত ২৪ ঘন্টায় আপনার মাসিক টোকেন বাজেটের ৮০%-এর বেশি ব্যবহার করেছেন। এআই ফিচার শীঘ্রই আবার উপলব্ধ হবে। আগামীকাল আবার চেষ্টা করুন বা আপনার প্ল্যান আপগ্রেড করুন।",
    retryable: true,
  },
  tier_blocked: {
    en: "AI features require the Pro+AI subscription tier. Please upgrade your plan to access AI chat, insights, expiry optimizer, and product assistant.",
    bn: "এআই ফিচারগুলির জন্য Pro+AI সাবস্ক্রিপশন টায়ার প্রয়োজন। এআই চ্যাট, ইনসাইটস, এক্সপায়ারি অপ্টিমাইজার এবং প্রোডাক্ট অ্যাসিস্ট্যান্ট অ্যাক্সেস করতে আপনার প্ল্যান আপগ্রেড করুন।",
    retryable: false,
  },
  no_cached_data: {
    en: "AI is currently unavailable and no cached response exists for this request.",
    bn: "এআই এই মুহূর্তে ব্যবহারযোগ্য নয় এবং এই অনুরোধের জন্য কোনো ক্যাশে করা উত্তর নেই।",
    retryable: true,
  },
  parse_error: {
    en: "The AI returned a malformed response. Please try again.",
    bn: "এআই থেকে ত্রুটিপূর্ণ উত্তর এসেছে। আবার চেষ্টা করুন।",
    retryable: true,
  },
  unknown: {
    en: "An unexpected error occurred while processing the AI request. Please try again.",
    bn: "এআই অনুরোধ প্রসেস করার সময় অপ্রত্যাশিত ত্রুটি দেখা দিয়েছে। আবার চেষ্টা করুন।",
    retryable: true,
  },
};

// ── buildFallback ──
// Assemble a FallbackResponse from a reason + optional extras.
// `cachedData`/`cachedAt` should be attached by the caller after fetching
// the last successful response via getLastSuccessfulCall() or the AIResponseCache.
export function buildFallback<T = unknown>(
  reason: FallbackReason,
  options: {
    cachedAt?: string;
    cachedData?: T;
    retryAfterSeconds?: number;
    errorMessage?: string;
  } = {}
): FallbackResponse<T> {
  const meta = MESSAGES[reason];
  return {
    fallback: true,
    fallbackReason: reason,
    fallbackMessage: meta.en,
    fallbackMessageBn: meta.bn,
    retryable: meta.retryable,
    cachedAt: options.cachedAt,
    cachedData: options.cachedData,
    retryAfterSeconds: options.retryAfterSeconds,
    errorMessage: options.errorMessage,
  };
}

// ── classifyError ──
// Inspect a thrown value and classify it into a FallbackReason by matching
// common substrings in the error message / name. Handles Error instances,
// strings, and unknown values.
export function classifyError(error: unknown): FallbackReason {
  const message =
    error instanceof Error
      ? `${error.message} ${error.name || ""}`.toLowerCase()
      : typeof error === "string"
        ? error.toLowerCase()
        : "";

  if (!message) return "unknown";

  // 1. Timeout — LLM was reachable but didn't respond in time
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout") ||
    message.includes("esockettimedout") ||
    message.includes("aborted") ||
    message.includes("deadline exceeded") ||
    message.includes("request timeout")
  ) {
    return "llm_timeout";
  }

  // 2. Network / unavailable — couldn't reach the LLM at all
  if (
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("enetunreach") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("socket hang up") ||
    message.includes("service unavailable") ||
    message.includes("bad gateway") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("connection refused") ||
    message.includes("connect econnrefused") ||
    message.includes("ai service is down")
  ) {
    return "llm_unavailable";
  }

  // 3. Parse error — LLM responded but we couldn't parse the output
  if (
    message.includes("json") ||
    message.includes("unexpected token") ||
    message.includes("unexpected end") ||
    message.includes("parse") ||
    message.includes("not valid json") ||
    message.includes("syntaxerror") ||
    message.includes("is not valid json")
  ) {
    return "parse_error";
  }

  return "unknown";
}

// ── classifyRateLimitByType ──
// Map a structured `limitType` (returned by checkAILimit()) to a FallbackReason.
// For non-rate-limit limitTypes (ai_disabled / subscription / not_found) we
// delegate to classifyRateLimitReason(reason), or fall back to "unknown".
export function classifyRateLimitByType(
  limitType: string | undefined,
  reason?: string
): FallbackReason {
  switch (limitType) {
    case "burst":
      return "rate_limit_burst";
    case "daily":
      return "rate_limit_daily";
    case "monthly":
      return "rate_limit_monthly";
    case "tokens":
      return "rate_limit_tokens";
    case "tier_blocked":
      return "tier_blocked";
    case "circuit_open":
      return "circuit_open";
    case "ai_disabled":
    case "subscription":
    case "not_found":
      // These are access-control failures, not transient rate limits.
      // Try string-based classification; otherwise unknown.
      return reason ? classifyRateLimitReason(reason) : "unknown";
    default:
      return reason ? classifyRateLimitReason(reason) : "unknown";
  }
}

// ── classifyRateLimitReason ──
// String-based classifier — used when only a human-readable reason is available
// (e.g., from checkAILimit().reason or an upstream error message).
export function classifyRateLimitReason(reason: string | undefined): FallbackReason {
  if (!reason) return "unknown";
  const r = reason.toLowerCase();

  if (
    r.includes("burst") ||
    r.includes("too quickly") ||
    r.includes("too many requests") ||
    r.includes("rate limit")
  ) {
    return "rate_limit_burst";
  }
  if (
    r.includes("daily") ||
    r.includes("per day") ||
    r.includes("per/day") ||
    r.includes("today's") ||
    r.includes("today")
  ) {
    return "rate_limit_daily";
  }
  if (
    r.includes("monthly") ||
    r.includes("per month") ||
    r.includes("per/month") ||
    r.includes("this month")
  ) {
    return "rate_limit_monthly";
  }
  if (r.includes("token") || r.includes("budget")) {
    return "rate_limit_tokens";
  }
  if (r.includes("disabled") || r.includes("not enabled")) {
    return "no_cached_data";
  }
  if (r.includes("subscription") || r.includes("suspended") || r.includes("cancelled")) {
    return "no_cached_data";
  }
  return "unknown";
}

// ── getLastSuccessfulCall ──
// Find the most recent successful AIUsageLog row for this business+feature
// within the last `maxAgeHours` hours. Used to surface a stale-but-safe
// fallback response when a fresh AI call fails.
//
// Returns a slim projection (id, feature, tokensUsed, costEstimate, createdAt)
// or null if no success was found (or on query error).
export async function getLastSuccessfulCall(
  businessId: string,
  feature: string,
  maxAgeHours = 24
) {
  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  try {
    const last = await db.aIUsageLog.findFirst({
      where: {
        businessId,
        feature,
        success: true,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        feature: true,
        tokensUsed: true,
        costEstimate: true,
        createdAt: true,
      },
    });
    return last;
  } catch (err) {
    // Never let a fallback-query failure cascade into the main request
    console.error("[ai-fallback] getLastSuccessfulCall failed:", err);
    return null;
  }
}

// ── formatCachedAt ──
// Human-friendly relative time formatter for cached-response timestamps.
// Output ladder:
//   < 60s        → "just now"
//   < 60 min     → "5 min ago"
//   < 24 hr      → "2 hr ago"
//   < 7 days     → "3 days ago"
//   else         → "Jan 5, 2025"
export function formatCachedAt(isoString: string): string {
  const then = new Date(isoString);
  const diffMs = Date.now() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  // Beyond a week, show the absolute date
  return then.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
