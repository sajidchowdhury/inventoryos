// ── InventoryOS: AI Response Cache ──
//
// Caches LLM responses keyed by (businessId, feature, normalizedQuery, dataHash).
// Same question + same underlying data → return cached response instead of
// re-calling the (expensive, rate-limited) LLM.
//
// TTL: 24 hours (CACHE_TTL_HOURS).
// Storage: Prisma `AIResponseCache` table (compound unique on the four key cols).
//
// Lifecycle used by every AI route handler:
//   1. Gather context data → computeDataHash(summary)   // stable hash of inputs
//   2. normalizeQuery(userMessage)                       // case/punctuation-insensitive
//   3. const hit = await getCachedResponse(businessId, feature, nq, hash)
//      → if hit, return cached response (free, no LLM call, no rate-limit charge)
//   4. If miss, call LLM → setCachedResponse(...) for next time
//
// All write paths are best-effort: a cache failure must never break the
// user's request, only degrade performance/cost.

import crypto from "crypto";
import { db } from "./db";

// ── Constants ──
export const CACHE_TTL_HOURS = 24;

// ── normalizeQuery ──
// Lowercase → strip punctuation → collapse whitespace → cap at 500 chars.
// Two messages that differ only in punctuation/case/whitespace map to the
// same cache key, maximizing hit rate without changing semantics.
//
// Uses Unicode property escapes so Bengali (and any other script) letters
// are preserved as-is — only punctuation/symbols are stripped.
export function normalizeQuery(message: string): string {
  if (!message) return "";
  const lower = message.toLowerCase();
  // Keep letters (any script), numbers, and whitespace. Replace everything
  // else (punctuation, symbols, emoji) with a single space.
  const stripped = lower.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, 500);
}

// ── computeDataHash ──
// Stable SHA-256 hash of the context data summary.
// If the underlying data changes (new sale, new stock level, new batch, etc.),
// the hash changes → cache miss → fresh LLM call. This is what makes the cache
// safe: stale data never silently leaks to the user.
//
// Returns the first 32 hex characters of the digest (128 bits — collision-safe
// for any realistic cache size, and short enough to fit comfortably in an index).
export function computeDataHash(dataSummary: unknown): string {
  const json = JSON.stringify(dataSummary ?? null);
  return crypto
    .createHash("sha256")
    .update(json, "utf8")
    .digest("hex")
    .slice(0, 32);
}

// Shape returned by getCachedResponse on a hit.
export interface CachedAIResponse {
  response: string;
  tokensUsed: number;
  cachedAt: string; // ISO timestamp
}

// ── getCachedResponse ──
// Look up a cached AI response by its compound key. If the row exists but has
// expired, auto-delete it (lazy expiry) and return null.
//
// Returns null on miss, expiry, or any query error — callers must treat null
// as "no cache, proceed to LLM".
export async function getCachedResponse(
  businessId: string,
  feature: string,
  normalizedQuery: string,
  dataHash: string
): Promise<CachedAIResponse | null> {
  // Empty normalizedQuery can't match a real cache row (we never store empty
  // keys), so short-circuit to avoid a pointless DB round-trip.
  if (!normalizedQuery) return null;

  const compoundKey = {
    businessId_feature_normalizedQuery_dataHash: {
      businessId,
      feature,
      normalizedQuery,
      dataHash,
    },
  };

  try {
    const entry = await db.aIResponseCache.findUnique({
      where: compoundKey,
      select: { response: true, tokensUsed: true, createdAt: true, expiresAt: true },
    });

    if (!entry) return null;

    // Lazy expiry: if this row is past its TTL, delete it and report a miss.
    // The delete is wrapped in its own try/catch because another concurrent
    // request may have already deleted it (race) — that's fine.
    if (entry.expiresAt.getTime() < Date.now()) {
      try {
        await db.aIResponseCache.delete({ where: compoundKey });
      } catch {
        // Already gone — nothing to do
      }
      return null;
    }

    return {
      response: entry.response,
      tokensUsed: entry.tokensUsed,
      cachedAt: entry.createdAt.toISOString(),
    };
  } catch (err) {
    console.error("[ai-cache] getCachedResponse failed:", err);
    return null;
  }
}

// ── setCachedResponse ──
// Upsert a cached AI response. If a row already exists for this compound key
// (same question + same data hash), overwrite it with the fresh response and
// reset the TTL clock.
//
// tokensUsed is clamped to a non-negative integer to guard against LLM SDKs
// that report -1 or NaN when usage stats aren't available.
export async function setCachedResponse(
  businessId: string,
  feature: string,
  normalizedQuery: string,
  dataHash: string,
  response: string,
  tokensUsed: number,
  ttlHours: number = CACHE_TTL_HOURS
): Promise<void> {
  // Don't cache empty queries or empty responses — they're either bugs or
  // LLM failures that we don't want to replay.
  if (!normalizedQuery || !response) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const safeTokens = Math.max(0, Math.floor(tokensUsed));

  const compoundKey = {
    businessId_feature_normalizedQuery_dataHash: {
      businessId,
      feature,
      normalizedQuery,
      dataHash,
    },
  };

  try {
    await db.aIResponseCache.upsert({
      where: compoundKey,
      create: {
        businessId,
        feature,
        normalizedQuery,
        dataHash,
        response,
        tokensUsed: safeTokens,
        createdAt: now,
        expiresAt,
      },
      update: {
        response,
        tokensUsed: safeTokens,
        createdAt: now,
        expiresAt,
      },
    });
  } catch (err) {
    // Caching is best-effort — never break the request over a cache write.
    console.error("[ai-cache] setCachedResponse failed:", err);
  }
}

// ── pruneExpiredCacheEntries ──
// Bulk-delete every cache row whose expiresAt < now.
// Designed to be called by a daily cron job, but safe to call from anywhere.
// Returns the number of deleted rows (0 on error).
export async function pruneExpiredCacheEntries(): Promise<number> {
  try {
    const result = await db.aIResponseCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  } catch (err) {
    console.error("[ai-cache] pruneExpiredCacheEntries failed:", err);
    return 0;
  }
}

// ── clearBusinessCache ──
// Wipe all cached AI responses for a single business. Used when:
//   - A business downgrades from pro_ai → pro (no point keeping AI cache)
//   - An admin requests a manual cache flush
//   - A business is deleted (cascade handles this, but this is the manual knob)
// Returns the number of deleted rows (0 on error).
export async function clearBusinessCache(businessId: string): Promise<number> {
  try {
    const result = await db.aIResponseCache.deleteMany({ where: { businessId } });
    return result.count;
  } catch (err) {
    console.error("[ai-cache] clearBusinessCache failed:", err);
    return 0;
  }
}
