// ── Offline-First: Connection Status Store ──
//
// 4-state connectivity indicator per spec:
//   - online:   connected, all clear
//   - offline:  no internet, using cached/queued
//   - syncing:  back online, replaying mutation queue
//   - error:    sync failed (some mutations could not be replayed)

import { create } from 'zustand';

export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'error';

interface OfflineState {
  status: ConnectionStatus;
  isOnline: boolean;
  pendingCount: number;
  lastSyncError: string | null;
  lastSyncAt: number | null;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncAt: (ts: number | null) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  status: 'online',
  isOnline: true,
  pendingCount: 0,
  lastSyncError: null,
  lastSyncAt: null,

  setStatus: (status) => set({ status }),
  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setSyncError: (error) => set({ lastSyncError: error }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
}));