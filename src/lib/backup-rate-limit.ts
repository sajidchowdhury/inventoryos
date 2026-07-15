// src/lib/backup-rate-limit.ts
// ═══════════════════════════════════════════════════════════════════════════
// InventoryOS — Backup Rate Limiting (Phase 4: Safety & Hardening)
// ═══════════════════════════════════════════════════════════════════════════
//
// In-memory rate limiter for backup/restore operations. Prevents:
//   - Accidental double-clicks (creating 2 backups in 1 second)
//   - Panic-clicking restore (allowing a second restore before the first completes)
//   - Backup storms (creating backups faster than pg_dump can write to disk)
//
// Limits:
//   - Tenant backup create:    1 per 10 seconds per business
//   - Tenant restore:          1 per 60 seconds per business
//   - System backup create:    1 per 30 seconds (global)
//   - System restore:          1 per 300 seconds (5 min, global — most dangerous)
//
// Why in-memory (not DB-backed)?
//   - Backup/restore is a rare, manual operation (a few times/day at most)
//   - The limits are about preventing accidental rapid-fire, not abuse
//   - In-memory is simpler, has zero DB cost, and resets on server restart
//     (which is acceptable — server restart means the admin lost their flow anyway)
//
// All entries are cleaned up automatically (entries older than the limit window
// are removed on every check).

type RateLimitKey = string; // e.g. "tenant-backup:create:businessId"

interface RateLimitEntry {
  timestamp: number;
}

// Module-level store — persists across requests within the same Node process
const store = new Map<RateLimitKey, RateLimitEntry[]>();

// Cleanup old entries on every check to prevent memory leaks
function cleanupOldEntries(key: RateLimitKey, windowMs: number): void {
  const entries = store.get(key);
  if (!entries) return;
  const cutoff = Date.now() - windowMs;
  const fresh = entries.filter((e) => e.timestamp > cutoff);
  if (fresh.length === 0) {
    store.delete(key);
  } else if (fresh.length !== entries.length) {
    store.set(key, fresh);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number; // 0 if allowed, else seconds until next attempt is allowed
  limit: number; // the limit that was applied
  windowMs: number;
}

/**
 * Check if an action is allowed under the rate limit.
 * If allowed, records the attempt. If not, returns retryAfterSeconds.
 *
 * @param key      Unique identifier for the action (e.g. "system-restore:global")
 * @param windowMs Time window in milliseconds
 * @param maxAttempts  Maximum attempts allowed in the window
 */
export function checkRateLimit(
  key: RateLimitKey,
  windowMs: number,
  maxAttempts: number = 1
): RateLimitResult {
  cleanupOldEntries(key, windowMs);

  const entries = store.get(key) || [];

  if (entries.length >= maxAttempts) {
    // Rate limited — calculate when the oldest entry will expire
    const oldest = Math.min(...entries.map((e) => e.timestamp));
    const retryAfterMs = (oldest + windowMs) - Date.now();
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit: maxAttempts,
      windowMs,
    };
  }

  // Allowed — record this attempt
  entries.push({ timestamp: Date.now() });
  store.set(key, entries);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    limit: maxAttempts,
    windowMs,
  };
}

// ─── Pre-configured limit helpers ────────────────────────────────────────────

/** Tenant backup create — max 1 per 10 seconds per business */
export function checkTenantBackupCreate(businessId: string): RateLimitResult {
  return checkRateLimit(`tenant-backup:create:${businessId}`, 10_000, 1);
}

/** Tenant restore — max 1 per 60 seconds per business */
export function checkTenantRestore(businessId: string): RateLimitResult {
  return checkRateLimit(`tenant-restore:${businessId}`, 60_000, 1);
}

/** System backup create — max 1 per 30 seconds (global) */
export function checkSystemBackupCreate(): RateLimitResult {
  return checkRateLimit(`system-backup:create:global`, 30_000, 1);
}

/** System restore — max 1 per 5 minutes (global, most dangerous) */
export function checkSystemRestore(): RateLimitResult {
  return checkRateLimit(`system-restore:global`, 300_000, 1);
}
