// ── Offline-First: Sync Engine ──
//
// On reconnection, replays the mutation queue (last-write-wins).
// Updates the offline store status throughout the process.

import { useOfflineStore } from '@/stores/offline-store';
import {
  getPendingMutations,
  removeMutation,
  updateMutationError,
  getPendingMutationCount,
  invalidateCache,
} from '@/lib/offline-store';

const MAX_RETRIES = 3;
const SYNC_COOLDOWN_MS = 2000; // prevent rapid re-syncs

let isSyncing = false;
let lastSyncStart = 0;

/** Trigger a sync of all pending mutations. Safe to call multiple times. */
export async function syncPendingMutations(): Promise<void> {
  if (isSyncing) return;
  if (Date.now() - lastSyncStart < SYNC_COOLDOWN_MS) return;

  const { setStatus, setSyncError, setLastSyncAt, setPendingCount } = useOfflineStore.getState();

  const count = await getPendingMutationCount();
  setPendingCount(count);
  if (count === 0) return;

  isSyncing = true;
  lastSyncStart = Date.now();
  setStatus('syncing');

  const mutations = await getPendingMutations();
  let hasError = false;
  let errorMessages: string[] = [];

  for (const mutation of mutations) {
    if (mutation.retries >= MAX_RETRIES) {
      errorMessages.push(`Failed: ${mutation.method} ${mutation.url} (max retries)`);
      hasError = true;
      continue;
    }

    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.method !== 'DELETE' ? mutation.body : undefined,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status}: ${text.slice(0, 100)}`);
      }

      // Success — remove from queue and invalidate related caches
      await removeMutation(mutation.id);
      // Invalidate any cached data that might be stale after this mutation
      await invalidateCache(mutation.url.split('?')[0], true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateMutationError(mutation.id, message);
      hasError = true;
      errorMessages.push(`${mutation.method} ${mutation.url}: ${message}`);
    }
  }

  const remaining = await getPendingMutationCount();
  setPendingCount(remaining);

  if (hasError) {
    setStatus('error');
    setSyncError(errorMessages[0] || 'Some mutations failed to sync');
  } else {
    setStatus('online');
    setSyncError(null);
    setLastSyncAt(Date.now());
  }

  isSyncing = false;
}

/** Start listening for online/offline events and auto-sync. */
export function startOfflineListeners(): () => void {
  const handleOnline = () => {
    const { setOnline, setStatus } = useOfflineStore.getState();
    setOnline(true);
    setStatus('syncing');
    // Delay sync slightly to let connection stabilize
    setTimeout(() => syncPendingMutations(), 500);
  };

  const handleOffline = () => {
    const { setOnline, setStatus } = useOfflineStore.getState();
    setOnline(false);
    setStatus('offline');
  };

  // Set initial state
  if (typeof window !== 'undefined') {
    const { setOnline, setStatus } = useOfflineStore.getState();
    setOnline(navigator.onLine);
    setStatus(navigator.onLine ? 'online' : 'offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If online on load, check for pending mutations
    if (navigator.onLine) {
      getPendingMutationCount().then((count) => {
        const { setPendingCount } = useOfflineStore.getState();
        setPendingCount(count);
        if (count > 0) {
          syncPendingMutations();
        }
      });
    }

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  return () => {};
}