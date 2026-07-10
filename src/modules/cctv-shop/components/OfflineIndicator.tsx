'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useOfflineStore, type ConnectionStatus } from '@/stores/offline-store';
import { syncPendingMutations } from '@/lib/offline-sync';
import { useState } from 'react';

const STATUS_CONFIG: Record<ConnectionStatus, {
  icon: typeof Wifi;
  label: string;
  bg: string;
  text: string;
  border: string;
  showPending: boolean;
  dismissible: boolean;
}> = {
  online: {
    icon: Wifi,
    label: 'Online',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    showPending: false,
    dismissible: true,
  },
  offline: {
    icon: WifiOff,
    label: 'Offline — Using cached data',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    showPending: true,
    dismissible: false,
  },
  syncing: {
    icon: RefreshCw,
    label: 'Syncing…',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    showPending: true,
    dismissible: false,
  },
  error: {
    icon: AlertTriangle,
    label: 'Sync Error',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    showPending: true,
    dismissible: false,
  },
};

export function OfflineIndicator() {
  const { status, pendingCount, lastSyncError } = useOfflineStore();
  const [dismissed, setDismissed] = useState(false);

  // Don't show the indicator when online with no pending items
  if (status === 'online' && pendingCount === 0) return null;
  if (dismissed && status === 'online') return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isSpinning = status === 'syncing';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={`mx-4 mt-0 mb-3 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${config.bg} ${config.border}`}
      >
        <div className={`${isSpinning ? 'animate-spin' : ''}`}>
          <Icon className={`w-4 h-4 ${config.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${config.text}`}>
            {config.label}
          </p>
          {config.showPending && pendingCount > 0 && (
            <p className="text-[10px] text-gray-500 mt-0.5">
              {pendingCount} pending action{pendingCount !== 1 ? 's' : ''} to sync
            </p>
          )}
          {status === 'error' && lastSyncError && (
            <p className="text-[10px] text-gray-500 mt-0.5 truncate">{lastSyncError}</p>
          )}
        </div>

        {/* Actions */}
        {status === 'error' && (
          <button
            onClick={() => { syncPendingMutations(); }}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white/80 border border-orange-200 text-[10px] font-semibold text-orange-700 hover:bg-white transition-colors"
          >
            Retry
          </button>
        )}

        {config.dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 rounded-lg hover:bg-white/60 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Compact pill version for use in headers or nav bars. */
export function OfflinePill() {
  const { status, pendingCount } = useOfflineStore();
  if (status === 'online' && pendingCount === 0) return null;

  const colors: Record<ConnectionStatus, string> = {
    online: 'bg-emerald-100 text-emerald-700',
    offline: 'bg-rose-100 text-rose-700',
    syncing: 'bg-amber-100 text-amber-700',
    error: 'bg-orange-100 text-orange-700',
  };

  const labels: Record<ConnectionStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    syncing: `Syncing${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
    error: `Error${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[status]}`}>
      {status === 'syncing' && (
        <RefreshCw className="w-3 h-3 animate-spin" />
      )}
      {status === 'offline' && (
        <WifiOff className="w-3 h-3" />
      )}
      {status === 'error' && (
        <AlertTriangle className="w-3 h-3" />
      )}
      {labels[status]}
    </span>
  );
}