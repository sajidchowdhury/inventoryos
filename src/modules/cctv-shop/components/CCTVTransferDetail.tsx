'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Package, Truck, CheckCircle2, XCircle,
  Loader2, Calendar, FileText, Building2,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { CCTVTransfer, TransferStatus } from '@/modules/cctv-shop/types';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const statusConfig: Record<TransferStatus, { color: string; bg: string; icon: typeof CheckCircle2; label: string }> = {
  DRAFT: { color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText, label: 'Draft' },
  IN_TRANSIT: { color: 'text-amber-700', bg: 'bg-amber-100', icon: Truck, label: 'In Transit' },
  RECEIVED: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2, label: 'Received' },
  CANCELLED: { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle, label: 'Cancelled' },
};

const itemStatusColor: Record<string, string> = {
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  RECEIVED: 'bg-emerald-100 text-emerald-700',
  RETURNED: 'bg-red-100 text-red-600',
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CCTVTransferDetail() {
  const { navigate, goBack, contextId } = useCCTVNavStore();

  const [transfer, setTransfer] = useState<CCTVTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const fetchTransfer = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/transfers/${contextId}`);
      if (res.ok) {
        const data = await res.json();
        setTransfer(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  useEffect(() => {
    fetchTransfer();
  }, [fetchTransfer]);

  const handleSend = async () => {
    if (!contextId) return;
    setActionLoading('send');
    setSendDialogOpen(false);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/transfers/${contextId}/send`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchTransfer();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleReceive = async () => {
    if (!contextId) return;
    setActionLoading('receive');
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/transfers/${contextId}/receive`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchTransfer();
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!contextId) return;
    setActionLoading('cancel');
    setCancelDialogOpen(false);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/transfers/${contextId}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        navigate('transfers');
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="flex-1 h-11 rounded-2xl" />
          <Skeleton className="flex-1 h-11 rounded-2xl" />
        </div>
      </motion.div>
    );
  }

  if (!transfer) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Transfer</h1>
        </div>
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">Transfer not found</p>
        </div>
      </motion.div>
    );
  }

  const config = statusConfig[transfer.status];
  const StatusIcon = config.icon;

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
          <h1 className="text-base font-bold text-gray-900 font-mono truncate">
            {transfer.transferCode}
          </h1>
        </div>
      </div>

      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn('rounded-2xl p-4 flex items-center gap-3', config.bg)}
      >
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center bg-white/80', config.color)}>
          <StatusIcon className="w-6 h-6" />
        </div>
        <div>
          <p className={cn('text-sm font-bold', config.color)}>{config.label}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {transfer.status === 'DRAFT' && 'Ready to be sent'}
            {transfer.status === 'IN_TRANSIT' && 'Items are on the way'}
            {transfer.status === 'RECEIVED' && 'All items delivered'}
            {transfer.status === 'CANCELLED' && 'Transfer was cancelled'}
          </p>
        </div>
      </motion.div>

      {/* From → To */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 mb-1">From</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-violet-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {transfer.fromBranch?.name || 'Unknown'}
                </p>
                {transfer.fromBranch?.code && (
                  <p className="text-[10px] text-gray-400">{transfer.fromBranch.code}</p>
                )}
              </div>
            </div>
          </div>

          <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p className="text-[10px] text-gray-400 mb-1">To</p>
            <div className="flex items-center gap-2 justify-end">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {transfer.toBranch?.name || 'Unknown'}
                </p>
                {transfer.toBranch?.code && (
                  <p className="text-[10px] text-gray-400">{transfer.toBranch.code}</p>
                )}
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-3 px-1"
      >
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(transfer.createdAt)}</span>
        </div>
        <span className="text-gray-200">·</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Package className="w-3.5 h-3.5" />
          <span>{transfer.items?.length || transfer._count?.items || 0} items</span>
        </div>
      </motion.div>

      {/* Notes */}
      {transfer.notes && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-amber-50/60 rounded-xl border border-amber-100 p-3"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] font-semibold text-amber-600">Notes</p>
          </div>
          <p className="text-xs text-amber-800/80">{transfer.notes}</p>
        </motion.div>
      )}

      {/* Items list */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Items</p>
          <span className="text-[10px] font-bold text-gray-400">
            {transfer.items?.length || transfer._count?.items || 0} total
          </span>
        </div>

        {(!transfer.items || transfer.items.length === 0) && (
          <p className="text-xs text-gray-400 text-center py-4">No items loaded</p>
        )}

        {transfer.items && transfer.items.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
            {transfer.items.map((item, i) => (
              <div
                key={item.id}
                className="bg-gray-50 rounded-xl p-3 flex items-center gap-2.5"
              >
                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {item.serialItem?.product?.name || 'Unknown Product'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">
                    {item.serialItem?.serialNumber || item.serialItemId}
                  </p>
                </div>
                {item.serialItem?.grade && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-gray-500 shrink-0">
                    {item.serialItem.grade}
                  </span>
                )}
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                  itemStatusColor[item.status] || 'bg-gray-100 text-gray-500'
                )}>
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Timestamps for received / cancelled */}
      {transfer.receivedAt && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 px-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Received on {formatDate(transfer.receivedAt)}</span>
        </div>
      )}
      {transfer.cancelledAt && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-500 px-1">
          <XCircle className="w-3.5 h-3.5" />
          <span>Cancelled on {formatDate(transfer.cancelledAt)}</span>
        </div>
      )}

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex gap-2.5 pt-1"
      >
        {transfer.status === 'DRAFT' && (
          <>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              disabled={actionLoading !== null}
              className="flex-1 h-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => setSendDialogOpen(true)}
              disabled={actionLoading !== null}
              className="flex-1 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20"
            >
              {actionLoading === 'send' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Send Transfer
                  <Truck className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </>
        )}

        {transfer.status === 'IN_TRANSIT' && (
          <>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              disabled={actionLoading !== null}
              className="flex-1 h-11 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={actionLoading !== null}
              className="flex-1 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20"
            >
              {actionLoading === 'receive' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Confirm Receipt
                  <CheckCircle2 className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </>
        )}

        {transfer.status === 'RECEIVED' && (
          <div className="flex-1 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" />
            Completed
          </div>
        )}

        {transfer.status === 'CANCELLED' && (
          <div className="flex-1 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center gap-2 text-sm font-bold">
            <XCircle className="w-4 h-4" />
            Cancelled
          </div>
        )}
      </motion.div>

      {/* Send confirmation dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent className="rounded-2xl p-5 max-w-[calc(100vw-2rem)] w-full mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Send Transfer?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-500">
              This will mark {transfer.items?.length || transfer._count?.items || 0} item(s) as in transit from{' '}
              <span className="font-semibold text-gray-700">{transfer.fromBranch?.name}</span> to{' '}
              <span className="font-semibold text-gray-700">{transfer.toBranch?.name}</span>.
              The items will be removed from the source branch's available inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl h-10 text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              className="rounded-xl h-10 bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold"
            >
              Confirm Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="rounded-2xl p-5 max-w-[calc(100vw-2rem)] w-full mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-red-600">Cancel Transfer?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-500">
              This action cannot be undone. The transfer{' '}
              <span className="font-mono font-semibold text-gray-700">{transfer.transferCode}</span> will be
              permanently cancelled. Items will remain at the source branch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="rounded-xl h-10 text-sm">Keep Transfer</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="rounded-xl h-10 bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
            >
              Cancel Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}