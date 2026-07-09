'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, ArrowRightLeft, Package, Loader2, ArrowRight,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { CCTVTransfer, TransferStatus } from '@/modules/cctv-shop/types';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const tabs: { label: string; value: TransferStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const transferStatusColor: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CCTVTransfersList() {
  const { navigate, goBack } = useCCTVNavStore();

  const [transfers, setTransfers] = useState<CCTVTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TransferStatus | 'ALL'>('ALL');

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/transfers`);
      if (res.ok) {
        const data = await res.json();
        const all: CCTVTransfer[] = Array.isArray(data) ? data : data.transfers || [];
        // Sort by newest first
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransfers(all);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const filteredTransfers = useMemo(() => {
    if (activeTab === 'ALL') return transfers;
    return transfers.filter((t) => t.status === activeTab);
  }, [transfers, activeTab]);

  const emptyMessage = useMemo(() => {
    switch (activeTab) {
      case 'DRAFT': return 'No draft transfers';
      case 'IN_TRANSIT': return 'No transfers in transit';
      case 'RECEIVED': return 'No received transfers';
      case 'CANCELLED': return 'No cancelled transfers';
      default: return 'No transfers yet';
    }
  }, [activeTab]);

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Transfers</h1>
        <button
          onClick={() => navigate('create-transfer')}
          className="h-8 px-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-sm active:scale-[0.97] transition-transform flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeTab === tab.value
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-3/4 mb-1.5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredTransfers.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <ArrowRightLeft className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700">{emptyMessage}</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            {activeTab === 'ALL'
              ? 'Create a transfer to move stock between branches'
              : `No transfers matching "${activeTab.replace('_', ' ')}" status`}
          </p>
          {activeTab === 'ALL' && (
            <button
              onClick={() => navigate('create-transfer')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4" />
              New Transfer
            </button>
          )}
        </div>
      )}

      {/* Transfer list */}
      {!loading && filteredTransfers.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 px-1">
            {filteredTransfers.length} transfer{filteredTransfers.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {filteredTransfers.map((transfer, i) => (
                <motion.button
                  key={transfer.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                  onClick={() => navigate('transfer-detail', transfer.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  {/* Top row: code + status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold text-gray-800">
                      {transfer.transferCode}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      transferStatusColor[transfer.status] || 'bg-gray-100 text-gray-500'
                    )}>
                      {transfer.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* From → To */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 mb-0.5">From</p>
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {transfer.fromBranch?.name || 'Unknown'}
                      </p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-[10px] text-gray-400 mb-0.5">To</p>
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {transfer.toBranch?.name || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom row: items count + date */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Package className="w-3.5 h-3.5" />
                      <span>{transfer._count?.items || 0} items</span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {formatDate(transfer.createdAt)}
                    </span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}