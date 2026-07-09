'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, X, Shield, ShieldCheck, ShieldAlert,
  Clock, AlertTriangle, ChevronRight, FileWarning,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
};

interface WarrantySummary {
  active: number;
  expiringSoon: number;
  expired: number;
  total: number;
  claims: {
    pending: number;
    approved: number;
    inProgress: number;
    completed: number;
    rejected: number;
  };
}

interface WarrantyItem {
  id: string;
  serialItemId: string;
  serialNumber: string;
  imei: string | null;
  productId: string;
  productName: string;
  productBrand: string;
  status: string;
  customerName: string;
  customerPhone: string;
  saleId: string;
  warrantyMonths: number;
  warrantyStart: string;
  warrantyEnd: string;
  warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
  daysRemaining: number;
  _count: { warrantyClaims: number };
}

const WARRANTY_STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  ACTIVE: { badge: 'bg-emerald-100 text-emerald-700', label: 'Active' },
  EXPIRING_SOON: { badge: 'bg-amber-100 text-amber-700', label: 'Expiring Soon' },
  EXPIRED: { badge: 'bg-red-100 text-red-700', label: 'Expired' },
};

const FILTER_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Expiring Soon', value: 'EXPIRING_SOON' },
  { label: 'Expired', value: 'EXPIRED' },
];

function daysRemainingColor(days: number): string {
  if (days > 90) return 'text-emerald-600';
  if (days > 30) return 'text-amber-600';
  if (days > 0) return 'text-red-600';
  return 'text-gray-400';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CCTVWarrantiesList() {
  const { navigate, goBack } = useCCTVNavStore();
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [summary, setSummary] = useState<WarrantySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Fetch summary
  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      setSummaryLoading(true);
      try {
        const res = await fetch(
          `/api/businesses/${BUSINESS_ID}/cctv/warranties/summary`
        );
        if (res.ok && !cancelled) {
          setSummary(await res.json());
        }
      } catch {
        // silently fail for summary
      }
      if (!cancelled) setSummaryLoading(false);
    };
    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch warranties with search and filter
  const fetchWarranties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (activeFilter) params.set('status', activeFilter);
      const res = await fetch(
        `/api/businesses/${BUSINESS_ID}/cctv/warranties?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setWarranties(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [search, activeFilter]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await fetchWarranties();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fetchWarranties]);

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Warranties</h1>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm"
            >
              <Skeleton className="h-5 w-5 rounded mx-auto mb-1.5" />
              <Skeleton className="h-6 w-8 rounded mx-auto" />
              <Skeleton className="h-3 w-12 rounded mx-auto mt-1" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{summary.active}</p>
            <p className="text-[10px] text-gray-400 font-medium">Active</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
            <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">
              {summary.expiringSoon}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">
              Expiring Soon
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
            <ShieldAlert className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">
              {summary.expired}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Expired</p>
          </div>
        </div>
      ) : null}

      {/* Pending claims alert */}
      {summary && summary.claims.pending > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] } }}
        >
          <button
            onClick={() => setActiveFilter('ACTIVE')}
            className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <FileWarning className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {summary.claims.pending} Pending Warranty Claim
                {summary.claims.pending > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Tap to view active warranties
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
          </button>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <Input
          placeholder="Search by product, serial, customer..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10 pr-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 rounded-2xl h-11"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === tab.value
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Warranty list */}
      <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto cctv-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-gray-50">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))
        ) : warranties.length === 0 ? (
          <div className="text-center py-10">
            <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No warranties found</p>
            <p className="text-xs text-gray-300 mt-1">
              {search || activeFilter
                ? 'Try adjusting your search or filter'
                : 'Warranties will appear here when items are sold'}
            </p>
          </div>
        ) : (
          warranties.map((w, i) => {
            const statusCfg = WARRANTY_STATUS_CONFIG[w.warrantyStatus] || {
              badge: 'bg-gray-100 text-gray-700',
              label: w.warrantyStatus,
            };
            const drColor = daysRemainingColor(w.daysRemaining);

            return (
              <motion.button
                key={w.serialItemId}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.25,
                    delay: i * 0.03,
                    ease: [0, 0, 0.2, 1],
                  },
                }}
                onClick={() =>
                  navigate('warranty-detail', w.serialItemId)
                }
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                {/* Top row: product + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {w.productName}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {w.productBrand}
                    </p>
                    <p className="text-xs font-mono text-gray-500 mt-1">
                      {w.serialNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={cn(
                        'text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap',
                        statusCfg.badge
                      )}
                    >
                      {statusCfg.label}
                    </span>
                    {w._count.warrantyClaims > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1.5 py-0 h-4 font-semibold bg-violet-50 text-violet-600"
                      >
                        {w._count.warrantyClaims} claim
                        {w._count.warrantyClaims > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] text-gray-400">Customer</p>
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {w.customerName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Warranty Period</p>
                    <p className="text-xs font-medium text-gray-700">
                      {w.warrantyMonths} months
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Start</p>
                    <p className="text-xs font-medium text-gray-700">
                      {formatDate(w.warrantyStart)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">End</p>
                    <p className="text-xs font-medium text-gray-700">
                      {formatDate(w.warrantyEnd)}
                    </p>
                  </div>
                </div>

                {/* Bottom row: phone + days remaining */}
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <a
                    href={`tel:${w.customerPhone.replace(/[^0-9+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[11px] text-violet-600 font-medium"
                  >
                    <Shield className="w-3 h-3" />
                    {w.customerPhone}
                  </a>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span
                      className={cn('text-xs font-bold', drColor)}
                    >
                      {w.daysRemaining >= 0
                        ? `${w.daysRemaining} days left`
                        : `${Math.abs(w.daysRemaining)} days overdue`}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}