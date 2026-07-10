'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  Receipt,
  ShoppingCart,
  Wallet,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const TYPE_CONFIG: Record<string, { icon: typeof Wallet; color: string; bgColor: string }> = {
  SALE_PAYMENT: { icon: ArrowUpCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  EXPENSE: { icon: Receipt, color: 'text-red-500', bgColor: 'bg-red-50' },
  RETURN_REFUND: { icon: RotateCcw, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  PURCHASE_PAYMENT: { icon: ShoppingCart, color: 'text-orange-600', bgColor: 'bg-orange-50' },
};

const QUICK_RANGES = [
  { label: 'This Month', from: 'month-start', to: 'month-end' },
  { label: 'Last Month', from: 'last-month-start', to: 'last-month-end' },
  { label: 'Last 7 Days', from: '7d-ago', to: 'today' },
  { label: 'Last 30 Days', from: '30d-ago', to: 'today' },
  { label: 'This Year', from: 'year-start', to: 'today' },
];

// ── Types ──

interface LedgerEntry {
  id: string;
  date: string;
  type: string;
  typeLabel: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string | null;
  category?: string;
  method?: string;
  sourceId: string;
  linkedId?: string;
}

interface LedgerData {
  from: string;
  to: string;
  openingBalance: number;
  closingBalance: number;
  totalCredit: number;
  totalDebit: number;
  netFlow: number;
  entryCount: number;
  typeBreakdown: Record<string, { count: number; credit: number; debit: number }>;
  entries: LedgerEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveRange(key: string): { from: string; to: string } {
  const now = new Date();
  const today = toLocalDateStr(now);

  switch (key) {
    case 'month-start':
      return { from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'last-month-start':
      return { from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case '7d-ago':
      return { from: toLocalDateStr(new Date(now.getTime() - 7 * 86400000)), to: today };
    case '30d-ago':
      return { from: toLocalDateStr(new Date(now.getTime() - 30 * 86400000)), to: today };
    case 'year-start':
      return { from: `${now.getFullYear()}-01-01`, to: today };
    default:
      return { from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  }
}

// ── Component ──

export function CCTVLedgerView() {
  const { goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const now = new Date();
  const [fromDate, setFromDate] = useState(toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(toLocalDateStr(now));
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ── Fetch ──
  const pageRef = useRef(1);

  const doFetch = useCallback(async (p: number, from: string, to: string) => {
    pageRef.current = p;
    try {
      const params = new URLSearchParams({ from, to, page: String(p), limit: '100' });
      const res = await fetch(`/api/businesses/${businessId}/cctv/ledger?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // error
    }
    setLoading(false);
  }, [businessId]);

  // Trigger fetch on mount and when filters change
  useEffect(() => {
    pageRef.current = 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- needed for loading UX on filter changes
    setLoading(true);
    const id = setTimeout(() => doFetch(1, fromDate, toDate), 0);
    return () => clearTimeout(id);
  }, [fromDate, toDate, businessId]);

  const handlePageChange = (newPage: number) => {
    pageRef.current = newPage;
    setLoading(true);
    doFetch(newPage, fromDate, toDate);
  };

  const handleQuickRange = (range: { from: string; to: string }) => {
    setFromDate(range.from);
    setToDate(range.to);
  };

  const handleExportCSV = async () => {
    const exportFrom = fromDate;
    const exportTo = toDate;
    setDownloading(true);
    try {
      const params = new URLSearchParams({ from: exportFrom, to: exportTo, format: 'csv' });
      const res = await fetch(`/api/businesses/${businessId}/cctv/ledger?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ledger_${fromDate}_${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // error
    }
    setDownloading(false);
  };

  // ── Group entries by date ──
  const grouped = data?.entries.reduce<Record<string, LedgerEntry[]>>((acc, entry) => {
    const day = new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {}) || {};

  const totalCredit = data?.totalCredit || 0;
  const totalDebit = data?.totalDebit || 0;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Financial Ledger</h1>
          <p className="text-[10px] text-gray-400">Day Book</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={downloading || loading || (data?.entryCount || 0) === 0}
          className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 active:bg-gray-50 transition-all flex items-center gap-1.5 disabled:opacity-40"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          CSV
        </button>
      </div>

      {/* ── Date range + filter toggle ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-10 pl-9 pr-2 rounded-xl bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>
          <span className="text-xs text-gray-400 font-medium">to</span>
          <div className="flex-1 relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-400" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-10 pl-9 pr-2 rounded-xl bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${showFilters ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-200'}`}
          >
            <Filter className={`w-4 h-4 ${showFilters ? 'text-violet-600' : 'text-gray-500'}`} />
          </button>
        </div>

        {/* Quick range buttons */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 overflow-hidden"
            >
              {QUICK_RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => handleQuickRange(resolveRange(r.from))}
                  className="h-8 px-3 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all"
                >
                  {r.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Summary cards ── */}
      {!loading && data && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-2 gap-2.5"
        >
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <p className="text-[10px] text-gray-400 font-medium">Total Income</p>
            </div>
            <p className="text-base font-bold text-emerald-600">{formatBDT(totalCredit)}</p>
            <p className="text-[10px] text-gray-400">{data.typeBreakdown?.SALE_PAYMENT?.count || 0} payments</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              <p className="text-[10px] text-gray-400 font-medium">Total Outflow</p>
            </div>
            <p className="text-base font-bold text-red-600">{formatBDT(totalDebit)}</p>
            <p className="text-[10px] text-gray-400">
              {(data.typeBreakdown?.EXPENSE?.count || 0) + (data.typeBreakdown?.PURCHASE_PAYMENT?.count || 0) + (data.typeBreakdown?.RETURN_REFUND?.count || 0)} transactions
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Opening / Closing balance bar ── */}
      {!loading && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200/60 p-3.5 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wider">Opening Balance</p>
            <p className="text-sm font-bold text-violet-700">{formatBDT(data.openingBalance)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400 font-medium">Net Flow</p>
            <p className={`text-sm font-bold ${data.netFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {data.netFlow >= 0 ? '+' : ''}{formatBDT(data.netFlow)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wider">Closing Balance</p>
            <p className="text-sm font-bold text-violet-700">{formatBDT(data.closingBalance)}</p>
          </div>
        </motion.div>
      )}

      {/* ── Ledger entries grouped by date ── */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : !data || data.entryCount === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No transactions found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different date range</p>
          </div>
        ) : (
          Object.entries(grouped).map(([day, entries]) => {
            const dayCredit = entries.reduce((s, e) => s + e.credit, 0);
            const dayDebit = entries.reduce((s, e) => s + e.debit, 0);
            return (
              <div key={day}>
                {/* Date header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[11px] font-bold text-gray-500">{day}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-500 font-semibold">+{formatBDT(dayCredit)}</span>
                    {dayDebit > 0 && <span className="text-red-400 font-semibold">-{formatBDT(dayDebit)}</span>}
                  </div>
                </div>

                {/* Entries */}
                <div className="space-y-1.5">
                  {entries.map((entry) => {
                    const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.EXPENSE;
                    const Icon = config.icon;
                    const isCredit = entry.credit > 0;

                    return (
                      <motion.div
                        key={entry.id}
                        layout
                        className="bg-white rounded-xl border border-gray-100 px-3.5 py-3 shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-gray-900 truncate">{entry.description}</p>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge className="text-[9px] px-1.5 py-0 rounded-full border-0 font-semibold leading-3 bg-gray-100 text-gray-500">
                                {entry.typeLabel}
                              </Badge>
                              {entry.method && (
                                <span className="text-[9px] text-gray-400">{entry.method}</span>
                              )}
                              {entry.reference && (
                                <span className="text-[9px] text-gray-400 font-mono">#{entry.reference}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isCredit ? '+' : '-'}{formatBDT(isCredit ? entry.credit : entry.debit)}
                            </p>
                            <p className="text-[10px] text-gray-400 font-medium">
                              {formatBDT(entry.balance)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => handlePageChange(pageRef - 1)}
            disabled={pageRef <= 1}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <p className="text-xs text-gray-500 font-medium">
            Page {pageRef} of {data.pagination.totalPages}
          </p>
          <button
            onClick={() => handlePageChange(pageRef + 1)}
            disabled={pageRef >= data.pagination.totalPages}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* ── Footer summary (if has data) ── */}
      {!loading && data && data.entryCount > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-gray-400">Total Entries</p>
              <p className="text-sm font-bold text-gray-900">{data.entryCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Credits</p>
              <p className="text-sm font-bold text-emerald-600">{formatBDT(totalCredit)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Debits</p>
              <p className="text-sm font-bold text-red-600">{formatBDT(totalDebit)}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}