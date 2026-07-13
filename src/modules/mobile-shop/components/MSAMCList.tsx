'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, X, ShieldCheck, AlertTriangle,
  Clock, ChevronRight, Plus, FileText, CalendarDays,
  ShieldAlert, Banknote,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { MSAmcContract, AmcStatus, AmcCoverageType, AmcPaymentFrequency } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const COVERAGE_COLORS: Record<AmcCoverageType, string> = {
  Basic: 'bg-gray-100 text-gray-600',
  Standard: 'bg-violet-100 text-violet-700',
  Premium: 'bg-amber-100 text-amber-700',
};

const STATUS_COLORS: Record<AmcStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  EXPIRING_SOON: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<AmcStatus, string> = {
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const FREQ_LABELS: Record<AmcPaymentFrequency, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

const FILTER_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Expiring', value: 'EXPIRING_SOON' },
  { label: 'Expired', value: 'EXPIRED' },
];

interface AmcSummary {
  active: number;
  expiringSoon: number;
  expired: number;
  total: number;
  annualValue: number;
  expiringAlerts: { id: string; contractCode: string; clientName: string; endDate: string; daysRemaining: number }[];
}

const formatBDT = (n: number) =>
  '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function MSAMCList() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();
  const [contracts, setContracts] = useState<MSAmcContract[]>([]);
  const [summary, setSummary] = useState<AmcSummary | null>(null);
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
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/amc-contracts/summary`);
        if (res.ok && !cancelled) setSummary(await res.json());
      } catch { /* silent */ }
      if (!cancelled) setSummaryLoading(false);
    };
    fetchSummary();
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch contracts
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (activeFilter) params.set('status', activeFilter);
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/amc-contracts?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setContracts(Array.isArray(data) ? data : []);
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [search, activeFilter]);

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">AMC Management</h1>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm">
              <Skeleton className="h-4 w-4 rounded mx-auto mb-1" />
              <Skeleton className="h-5 w-6 rounded mx-auto" />
              <Skeleton className="h-2.5 w-10 rounded mx-auto mt-0.5" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-500 mx-auto mb-0.5" />
            <p className="text-base font-bold text-gray-900">{summary.active}</p>
            <p className="text-[9px] text-gray-400 font-medium">Active</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm text-center">
            <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
            <p className="text-base font-bold text-gray-900">{summary.expiringSoon}</p>
            <p className="text-[9px] text-gray-400 font-medium">Expiring</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm text-center">
            <ShieldAlert className="w-4 h-4 text-red-500 mx-auto mb-0.5" />
            <p className="text-base font-bold text-gray-900">{summary.expired}</p>
            <p className="text-[9px] text-gray-400 font-medium">Expired</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-2.5 shadow-sm text-center">
            <Banknote className="w-4 h-4 text-violet-500 mx-auto mb-0.5" />
            <p className="text-base font-bold text-gray-900">{(summary.annualValue / 1000).toFixed(0)}K</p>
            <p className="text-[9px] text-gray-400 font-medium">Annual ৳</p>
          </div>
        </div>
      ) : null}

      {/* Expiring Soon alert cards */}
      {summary && summary.expiringAlerts?.length > 0 && !summaryLoading && (
        <div className="space-y-2">
          {summary.expiringAlerts.slice(0, 3).map((alert) => (
            <motion.button
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } }}
              onClick={() => navigate('amc-detail', alert.id)}
              className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 truncate">
                  {alert.clientName}
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {alert.contractCode} · {alert.daysRemaining} days remaining
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <Input
          placeholder="Search by client name, contract code..."
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
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* AMC contract list */}
      <div className="space-y-2.5 max-h-[calc(100vh-340px)] overflow-y-auto cctv-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-2 pt-2.5 border-t border-gray-50">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-gray-50">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : contracts.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No AMC contracts found</p>
            <p className="text-xs text-gray-300 mt-1">
              {search || activeFilter
                ? 'Try adjusting your search or filter'
                : 'Create your first AMC contract to get started'}
            </p>
          </div>
        ) : (
          contracts.map((amc, i) => {
            const statusBadge = STATUS_COLORS[amc.status as AmcStatus] || 'bg-gray-100 text-gray-500';
            const statusLabel = STATUS_LABELS[amc.status as AmcStatus] || amc.status;
            const coverageBadge = COVERAGE_COLORS[amc.coverageType as AmcCoverageType] || 'bg-gray-100 text-gray-600';
            const visitCount = amc._count?.visits ?? amc.totalVisitsUsed ?? 0;
            const freqLabel = FREQ_LABELS[amc.paymentFrequency as AmcPaymentFrequency] || amc.paymentFrequency;

            return (
              <motion.button
                key={amc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.25, delay: i * 0.03, ease: 'easeOut' as const },
                }}
                onClick={() => navigate('amc-detail', amc.id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                {/* Top row: contract code + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-violet-600">{amc.contractCode}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', statusBadge)}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">{amc.clientName}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-2 mt-2.5">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', coverageBadge)}>
                    {amc.coverageType}
                  </span>
                  <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">
                    {visitCount} visit{visitCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    {freqLabel}
                  </span>
                </div>

                {/* Bottom row: period + value */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-500">
                      {fmtDate(amc.startDate)} — {fmtDate(amc.endDate)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{formatBDT(amc.totalAmount)}</span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {/* FAB */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { delay: 0.3, duration: 0.3, ease: 'easeOut' as const } }}
        onClick={() => navigate('create-amc')}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 flex items-center justify-center active:scale-95 transition-transform z-40"
        style={{ maxWidth: '480px', position: 'fixed' }}
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </motion.div>
  );
}