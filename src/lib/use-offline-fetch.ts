// ── Offline-First: useOfflineFetch Hook ──
//
// A drop-in replacement for fetch that:
//   - GET:  Returns cached data when offline, refreshes cache when online
//   - POST/PUT/DELETE: Queues mutation when offline, executes immediately when online
//
// Usage:
//   const { data, loading, error, refetch } = useOfflineFetch('/api/...', { method: 'GET' });
//   const { execute } = useOfflineFetch('/api/...', { method: 'POST', body: {...} }, { auto: false });

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineStore } from '@/stores/offline-store';
import {
  cacheResponse,
  getCachedResponse,
  enqueueMutation,
  invalidateCache,
  getPendingMutationCount,
} from '@/lib/offline-store';
import { syncPendingMutations } from '@/lib/offline-sync';

interface OfflineFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  cacheTtlMs?: number;
  cacheKey?: string;
  auto?: boolean;        // auto-execute on mount (default true for GET)
  invalidateOnSuccess?: string;  // URL prefix to invalidate after mutation
}

interface OfflineFetchResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  execute: (overrideBody?: unknown) => Promise<{ success: boolean; queued: boolean }>;
  queued: boolean;       // was this mutation queued (offline)?
  fromCache: boolean;    // was this data served from cache?
  stale: boolean;        // is the cached data stale?
}

export function useOfflineFetch<T = unknown>(
  url: string,
  options: OfflineFetchOptions = {}
): OfflineFetchResult<T> {
  const {
    method = 'GET',
    body: initialBody,
    headers,
    cacheTtlMs,
    cacheKey,
    auto = true,
    invalidateOnSuccess,
  } = options;

  const { isOnline, setPendingCount } = useOfflineStore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(auto && method === 'GET');
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [stale, setStale] = useState(false);
  const [queued, setQueued] = useState(false);

  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // The fetch logic
  const doFetch = useCallback(
    async (overrideBody?: unknown) => {
      const isMutation = method !== 'GET';
      const actualBody = overrideBody ?? initialBody;

      if (isMutation && !isOnline) {
        // ── OFFLINE MUTATION: Queue it ──
        try {
          await enqueueMutation(url, method, actualBody, headers);
          setQueued(true);
          setError(null);
          const count = await getPendingMutationCount();
          setPendingCount(count);
          return { success: true, queued: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to queue mutation';
          setError(msg);
          return { success: false, queued: true };
        }
      }

      if (isMutation && isOnline) {
        // ── ONLINE MUTATION: Execute immediately ──
        setLoading(true);
        setError(null);
        try {
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: actualBody !== undefined ? JSON.stringify(actualBody) : undefined,
          });
          const json = await res.json();

          if (!res.ok) {
            throw new Error(json.error || `HTTP ${res.status}`);
          }

          if (mountedRef.current) {
            // Invalidate related caches
            if (invalidateOnSuccess) {
              await invalidateCache(invalidateOnSuccess, true);
            }
            await invalidateCache(url.split('?')[0], true);
          }

          return { success: true, queued: false };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Request failed';
          if (mountedRef.current) setError(msg);
          return { success: false, queued: false };
        } finally {
          if (mountedRef.current) setLoading(false);
        }
      }

      // ── GET REQUEST ──
      setLoading(true);
      setError(null);

      // If offline, try cache first
      if (!isOnline) {
        const cached = await getCachedResponse<T>(url, cacheKey ? { key: cacheKey } : undefined);
        if (cached) {
          if (mountedRef.current) {
            setData(cached.data);
            setFromCache(true);
            setStale(cached.stale);
            setLoading(false);
          }
          return { success: true, queued: false };
        }
        // No cache available
        if (mountedRef.current) {
          setError('No cached data available while offline');
          setLoading(false);
        }
        return { success: false, queued: false };
      }

      // Online: fetch, cache, return
      try {
        const res = await fetch(url, { headers });
        const json = await res.json();

        if (!res.ok) {
          // If server error but we have stale cache, return it
          const cached = await getCachedResponse<T>(url, cacheKey ? { key: cacheKey } : undefined);
          if (cached) {
            if (mountedRef.current) {
              setData(cached.data);
              setFromCache(true);
              setStale(true);
              setError(`Server error ${res.status}, showing cached data`);
            }
          } else {
            throw new Error(json.error || `HTTP ${res.status}`);
          }
          return { success: false, queued: false };
        }

        // Cache successful GET response
        if (json.success !== false) {
          await cacheResponse(url, json, {
            key: cacheKey,
            ttlMs: cacheTtlMs ?? 5 * 60 * 1000,
            status: res.status,
          });
        }

        if (mountedRef.current) {
          setData(json as T);
          setFromCache(false);
          setStale(false);
        }

        return { success: true, queued: false };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Request failed';

        // Try stale cache on network error
        const cached = await getCachedResponse<T>(url, cacheKey ? { key: cacheKey } : undefined);
        if (cached && mountedRef.current) {
          setData(cached.data);
          setFromCache(true);
          setStale(true);
          setError(`Network error, showing cached data`);
        } else if (mountedRef.current) {
          setError(msg);
        }

        return { success: false, queued: false };
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [url, method, initialBody, headers, cacheTtlMs, cacheKey, invalidateOnSuccess, isOnline, setPendingCount]
  );

  // Auto-execute for GET on mount and when URL changes
  useEffect(() => {
    if (auto && method === 'GET') {
      doFetch();
    }
  }, [auto, method, doFetch]);

  const refetch = useCallback(async () => {
    setFromCache(false);
    setStale(false);
    await doFetch();
  }, [doFetch]);

  return {
    data,
    loading,
    error,
    refetch,
    execute: doFetch,
    queued,
    fromCache,
    stale,
  };
}

/** Helper to manually trigger a full sync. */
export function useSyncTrigger() {
  const { pendingCount } = useOfflineStore();
  return {
    pendingCount,
    sync: syncPendingMutations,
  };
}