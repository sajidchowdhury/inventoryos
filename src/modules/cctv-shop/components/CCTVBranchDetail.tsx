'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Phone, Package, Truck, ArrowRightLeft, Plus,
  Loader2, MoreVertical, Pencil, Trash2, Box, ChevronRight,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CCTVBranch, CCTVTransfer } from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const transferStatusColor: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CCTVBranchDetail() {
  const { navigate, goBack, contextId } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [branch, setBranch] = useState<CCTVBranch | null>(null);
  const [transfers, setTransfers] = useState<CCTVTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchBranch = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/branches/${contextId}`);
      if (res.ok) {
        const data = await res.json();
        setBranch(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  const fetchTransfers = useCallback(async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/transfers`);
      if (res.ok) {
        const data = await res.json();
        const all: CCTVTransfer[] = Array.isArray(data) ? data : data.transfers || [];
        // Filter transfers involving this branch, take last 5
        const filtered = all
          .filter(
            (t) => t.fromBranchId === contextId || t.toBranchId === contextId
          )
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5);
        setTransfers(filtered);
      }
    } catch {
      // silent
    }
  }, [contextId]);

  useEffect(() => {
    fetchBranch();
    fetchTransfers();
  }, [fetchBranch, fetchTransfers]);

  const handleDelete = async () => {
    if (!contextId) return;
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/branches/${contextId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        goBack();
      }
    } catch {
      // silent
    }
  };

  // Computed stats
  const inStock = branch?._count?.serialItems ?? 0;
  const inTransitCount = transfers.filter(
    (t) => t.status === 'IN_TRANSIT' && t.toBranchId === contextId
  ).length;
  const totalTransfers = transfers.length;

  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!branch) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Branch</h1>
        </div>
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">Branch not found</p>
        </div>
      </motion.div>
    );
  }

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
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{branch.name}</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <MoreVertical className="w-4.5 h-4.5 text-gray-500" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-0 top-11 z-50 bg-white rounded-xl border border-gray-100 shadow-lg p-1 min-w-[140px]"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    // Future: navigate to edit
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-gray-400" />
                  Edit Branch
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Branch
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Branch info card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {branch.code}
          </span>
          {branch.isDefault && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              Default
            </span>
          )}
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            branch.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          )}>
            {branch.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        {(branch.address || branch.phone) && (
          <div className="space-y-1 mt-2">
            {branch.address && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{branch.address}</span>
              </div>
            )}
            {branch.phone && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{branch.phone}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mx-auto mb-1.5">
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{inStock}</p>
          <p className="text-[10px] text-gray-400 font-medium">In Stock</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mx-auto mb-1.5">
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{inTransitCount}</p>
          <p className="text-[10px] text-gray-400 font-medium">In Transit</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mx-auto mb-1.5">
            <ArrowRightLeft className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{totalTransfers}</p>
          <p className="text-[10px] text-gray-400 font-medium">Transfers</p>
        </motion.div>
      </div>

      {/* View Inventory button */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        onClick={() => navigate('serial-items')}
        className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Box className="w-5 h-5 text-violet-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">View Inventory</p>
            <p className="text-[11px] text-gray-400">{inStock} serial items</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </motion.button>

      {/* Recent Transfers */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2.5">
          <h2 className="text-sm font-semibold text-gray-900">Recent Transfers</h2>
          {transfers.length > 0 && (
            <button
              onClick={() => navigate('transfers')}
              className="text-xs text-violet-600 font-medium"
            >
              View All
            </button>
          )}
        </div>

        {transfers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2.5">
              <ArrowRightLeft className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-xs font-medium text-gray-500">No transfers yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Create a transfer to move items</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5 scrollbar-thin">
            {transfers.map((transfer, i) => {
              const isSent = transfer.fromBranchId === contextId;
              const direction = isSent ? 'to' : 'from';
              const otherBranch = isSent ? transfer.toBranch : transfer.fromBranch;

              return (
                <motion.button
                  key={transfer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.04 } }}
                  onClick={() => navigate('transfer-detail', transfer.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-semibold text-gray-700">
                      {transfer.transferCode}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      transferStatusColor[transfer.status] || 'bg-gray-100 text-gray-500'
                    )}>
                      {transfer.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="text-violet-600 font-medium">{direction}</span>
                    <span className="truncate font-medium">{otherBranch?.name || 'Unknown'}</span>
                    <span className="text-gray-300 ml-auto shrink-0">
                      {transfer._count?.items || 0} items
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {formatDate(transfer.createdAt)}
                  </p>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* New Transfer button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={() => navigate('create-transfer')}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <Plus className="w-4 h-4" />
        New Transfer
      </motion.button>
    </motion.div>
  );
}