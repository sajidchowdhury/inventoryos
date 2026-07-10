// ── InventoryOS: Cache Layer (Gap 10 — Redis Support) ──
//
// Auto-detects REDIS_URL at startup:
//   - If REDIS_URL is set → uses Redis (multi-instance safe)
//   - If REDIS_URL is NOT set → falls back to in-memory Map (single-instance only)
//
// Both implementations share the same interface, so the rest of the app
// doesn't need to know which backend is active.
//
// Why Redis matters: with 2+ Next.js instances behind a load balancer,
// in-memory cache is per-instance — cache invalidation on instance A
// doesn't propagate to instance B. Redis provides a shared cache that
// all instances read from and write to.

// ── Cache Interface ──
interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidatePrefix(prefix: string): Promise<void>;
  clear(): Promise<void>;
  getOrCompute<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
  isRedis(): boolean;
}

// ── In-Memory Cache (fallback when REDIS_URL is not set) ──
class MemoryCache implements CacheBackend {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();
  private timers = new Map<string, NodeJS.Timeout>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    const existingTimer = this.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    this.cache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
    const timer = setTimeout(() => this.delete(key), ttlSeconds * 1000);
    this.timers.set(key, timer);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    const timer = this.timers.get(key);
    if (timer) { clearTimeout(timer); this.timers.delete(key); }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.delete(key);
    }
  }

  async clear(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.cache.clear();
  }

  async getOrCompute<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const data = await factory();
    await this.set(key, data, ttlSeconds);
    return data;
  }

  isRedis(): boolean { return false; }
}

// ── Redis Cache (used when REDIS_URL is set) ──
// Redis provides a shared cache across multiple Next.js instances.
// This is critical for multi-instance scaling (Gap 10).
class RedisCache implements CacheBackend {
  private client: import("ioredis").default | null = null;
  private connected = false;

  constructor(redisUrl: string) {
    // Dynamic import so ioredis is only loaded when Redis is actually used
    // This avoids a hard dependency on ioredis for single-instance deployments
    import("ioredis").then(({ default: Redis }) => {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 500, 5000),
        enableOfflineQueue: true,
        lazyConnect: false,
      });
      this.client.on("connect", () => {
        console.log("[cache] Redis connected");
        this.connected = true;
      });
      this.client.on("error", (err) => {
        console.error("[cache] Redis error:", err.message);
        this.connected = false;
      });
      this.client.on("reconnecting", () => {
        console.log("[cache] Redis reconnecting...");
      });
    }).catch((err) => {
      console.error("[cache] Failed to load ioredis — falling back to memory cache. Install with: npm install ioredis");
      console.error("[cache] Error:", err.message);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error("[cache] Redis get error:", err);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch (err) {
      console.error("[cache] Redis set error:", err);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    try { await this.client.del(key); } catch (err) { console.error("[cache] Redis del error:", err); }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    if (!this.client) return;
    try {
      // Use SCAN to find keys matching the prefix (non-blocking, unlike KEYS)
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      console.error("[cache] Redis invalidatePrefix error:", err);
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return;
    try { await this.client.flushdb(); } catch (err) { console.error("[cache] Redis clear error:", err); }
  }

  async getOrCompute<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const data = await factory();
    await this.set(key, data, ttlSeconds);
    return data;
  }

  isRedis(): boolean { return this.connected; }
}

// ── Cache Factory: auto-select backend based on REDIS_URL ──
let _instance: CacheBackend | null = null;

function getInstance(): CacheBackend {
  if (_instance) return _instance;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    console.log("[cache] Using Redis backend (REDIS_URL detected)");
    _instance = new RedisCache(redisUrl);
  } else {
    console.log("[cache] Using in-memory backend (no REDIS_URL set)");
    _instance = new MemoryCache();
  }
  return _instance;
}

// ── Exported singleton ──
export const cache: CacheBackend = new Proxy({} as CacheBackend, {
  get(_target, prop) {
    return (getInstance() as Record<string | symbol, unknown>)[prop];
  },
});

// ── Cache Key Helpers ──
export function cacheKey(businessId: string, feature: string, ...params: string[]): string {
  return `biz:${businessId}:${feature}:${params.join(":")}`;
}

// ── Cache Durations (in seconds) ──
export const CACHE_TTL = {
  DASHBOARD: 300,
  VALUATION: 3600,
  EXPIRY_STATS: 3600,
  ANALYTICS: 900,
  BUSINESS_DASH: 600,
  PRODUCT_LIST: 120,
  CATEGORIES: 600,
  SALES_LIST: 120,
  BATCH_LIST: 120,
  STATS: 300,
} as const;

// ── Invalidation Helpers ──
export function invalidateOnSale(businessId: string): Promise<void> {
  return cache.invalidatePrefix(`biz:${businessId}:dashboard`);
}
export function invalidateOnPurchase(businessId: string): Promise<void> {
  return cache.invalidatePrefix(`biz:${businessId}:dashboard`);
}
export function invalidateOnProductChange(businessId: string): Promise<void> {
  return cache.invalidatePrefix(`biz:${businessId}:product-list`);
}
export function invalidateOnBatchChange(businessId: string): Promise<void> {
  return cache.invalidatePrefix(`biz:${businessId}:expiry-stats`);
}
export function invalidateOnPayment(businessId: string): Promise<void> {
  return cache.invalidatePrefix(`biz:${businessId}:dashboard`);
}

// ── Health check helper (used by /api/health) ──
export function isRedisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

export function isRedisConnected(): boolean {
  if (!isRedisEnabled()) return false;
  const inst = getInstance();
  return inst.isRedis();
}
