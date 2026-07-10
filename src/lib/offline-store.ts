// ── Offline-First: Client-Side IndexedDB Store ──
//
// Two stores backed by IndexedDB (via `idb`):
//   1. Response Cache  – caches GET responses with TTL
//   2. Mutation Queue  – stores pending POST/PUT/DELETE for sync on reconnect
//
// Falls back to localStorage if IndexedDB is unavailable (rare).

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'inventoryos-offline';
const DB_VERSION = 1;

interface CacheEntry {
  key: string;
  url: string;
  response: string;       // JSON-stringified response body
  status: number;
  headers: Record<string, string>;
  cachedAt: number;       // epoch ms
  ttlMs: number;          // time-to-live in ms
}

interface MutationEntry {
  id: string;             // unique id (cuid-like)
  url: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body: string;           // JSON-stringified request body
  headers: Record<string, string>;
  createdAt: number;
  retries: number;
  lastError?: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Response cache store
        if (!db.objectStoreNames.contains('response-cache')) {
          const cacheStore = db.createObjectStore('response-cache', { keyPath: 'key' });
          cacheStore.createIndex('url', 'url', { unique: false });
          cacheStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
        // Mutation queue store
        if (!db.objectStoreNames.contains('mutation-queue')) {
          const queueStore = db.createObjectStore('mutation-queue', { keyPath: 'id' });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          queueStore.createIndex('url', 'url', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ── Response Cache ──

/** Cache a GET response. Key defaults to url. */
export async function cacheResponse(
  url: string,
  responseJson: unknown,
  options?: {
    key?: string;
    ttlMs?: number;
    status?: number;
    headers?: Record<string, string>;
  }
): Promise<void> {
  try {
    const db = await getDB();
    const ttlMs = options?.ttlMs ?? 5 * 60 * 1000; // default 5 min
    const entry: CacheEntry = {
      key: options?.key ?? url,
      url,
      response: JSON.stringify(responseJson),
      status: options?.status ?? 200,
      headers: options?.headers ?? {},
      cachedAt: Date.now(),
      ttlMs,
    };
    await db.put('response-cache', entry);
  } catch (err) {
    // Fallback: localStorage
    try {
      const key = `oc:${options?.key ?? url}`;
      const data = { responseJson, cachedAt: Date.now(), ttlMs: options?.ttlMs ?? 5 * 60 * 1000 };
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* storage full */ }
  }
}

/** Get a cached response. Returns null if expired or not found. */
export async function getCachedResponse<T = unknown>(
  url: string,
  options?: { key?: string }
): Promise<{ data: T; stale: boolean } | null> {
  try {
    const db = await getDB();
    const key = options?.key ?? url;
    const entry = await db.get('response-cache', key) as CacheEntry | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.cachedAt;
    const stale = age > entry.ttlMs;

    // Auto-delete if > 10x TTL
    if (age > entry.ttlMs * 10) {
      await db.delete('response-cache', key);
      return null;
    }

    return { data: JSON.parse(entry.response) as T, stale };
  } catch {
    // Fallback: localStorage
    try {
      const key = `oc:${options?.key ?? url}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { responseJson, cachedAt, ttlMs } = JSON.parse(raw);
      const age = Date.now() - cachedAt;
      const stale = age > ttlMs;
      if (age > ttlMs * 10) { localStorage.removeItem(key); return null; }
      return { data: responseJson as T, stale };
    } catch { return null; }
  }
}

/** Invalidate a specific cached URL or all entries matching a prefix. */
export async function invalidateCache(urlOrPrefix: string, isPrefix = false): Promise<void> {
  try {
    const db = await getDB();
    if (isPrefix) {
      const tx = db.transaction('response-cache', 'readwrite');
      const store = tx.objectStore('response-cache');
      const index = store.index('url');
      let cursor = await index.openCursor(IDBKeyRange.bound(urlOrPrefix, urlOrPrefix + '\uffff'));
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    } else {
      await db.delete('response-cache', urlOrPrefix);
    }
  } catch { /* ignore */ }
}

/** Clear all cached responses. */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('response-cache');
  } catch { /* ignore */ }
}

// ── Mutation Queue ──

/** Enqueue a mutation for later sync. Returns the queue entry ID. */
export async function enqueueMutation(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  body: unknown,
  headers?: Record<string, string>
): Promise<string> {
  const id = `mq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: MutationEntry = {
    id,
    url,
    method,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: headers ?? { 'Content-Type': 'application/json' },
    createdAt: Date.now(),
    retries: 0,
  };

  try {
    const db = await getDB();
    await db.put('mutation-queue', entry);
  } catch {
    // Fallback: localStorage
    try {
      const queue = JSON.parse(localStorage.getItem('oc:mutation-queue') || '[]') as MutationEntry[];
      queue.push(entry);
      localStorage.setItem('oc:mutation-queue', JSON.stringify(queue));
    } catch { /* storage full */ }
  }

  return id;
}

/** Get all pending mutations, oldest first. */
export async function getPendingMutations(): Promise<MutationEntry[]> {
  try {
    const db = await getDB();
    const tx = db.transaction('mutation-queue', 'readonly');
    const store = tx.objectStore('mutation-queue');
    const index = store.index('createdAt');
    const entries = await index.getAll() as MutationEntry[];
    return entries.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem('oc:mutation-queue');
      return raw ? (JSON.parse(raw) as MutationEntry[]) : [];
    } catch { return []; }
  }
}

/** Remove a completed mutation from the queue. */
export async function removeMutation(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('mutation-queue', id);
  } catch {
    try {
      const queue = JSON.parse(localStorage.getItem('oc:mutation-queue') || '[]') as MutationEntry[];
      localStorage.setItem('oc:mutation-queue', JSON.stringify(queue.filter((e) => e.id !== id)));
    } catch { /* ignore */ }
  }
}

/** Update mutation retry count and error. */
export async function updateMutationError(id: string, error: string): Promise<void> {
  try {
    const db = await getDB();
    const entry = await db.get('mutation-queue', id) as MutationEntry | undefined;
    if (entry) {
      entry.retries += 1;
      entry.lastError = error;
      await db.put('mutation-queue', entry);
    }
  } catch { /* ignore */ }
}

/** Get count of pending mutations. */
export async function getPendingMutationCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count('mutation-queue');
  } catch {
    try {
      const raw = localStorage.getItem('oc:mutation-queue');
      return raw ? (JSON.parse(raw) as MutationEntry[]).length : 0;
    } catch { return 0; }
  }
}

/** Clear all pending mutations. */
export async function clearMutationQueue(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('mutation-queue');
  } catch {
    try { localStorage.removeItem('oc:mutation-queue'); } catch { /* ignore */ }
  }
}