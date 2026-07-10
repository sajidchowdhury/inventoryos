'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Wallet,
  Receipt,
  Package,
  Loader2,
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

const QUICK_RANGES = [
  { label: 'This Month', from: 'month-start', to: 'month-end' },
  { label: 'Last Month', from: 'last-month-start', to: 'last-month-end' },
  { label: 'Last 3 Months', from: '3m-ago', to: 'today' },
  { label: 'Last 6 Months', from: '6m-ago', to: 'today' },
  { label: 'This Year', from: 'year-start', to: 'today' },
];

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent',
  SALARY: 'Salary',
  TRANSPORT: 'Transport',
  UTILITY: 'Utility',
  MISC: 'Misc',
};

// ── Types ──

interface MonthlyBreakdown {
  month: string;
  monthLabel: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  opex: number;
  netProfit: number;
  netMargin: number;
  saleCount: number;
  expenseCount: number;
}

interface PLData {
  success: boolean;
  from: string;
  to: string;
  summary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    opex: number;
    netProfit: number;
    netMargin: number;
    saleCount: number;
    expenseCount: number;
  };
  months: MonthlyBreakdown[];
  expenseBreakdown: Array<{ category: string; total: number; count: number }>;
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
      return {
        from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };
    case 'last-month-start':
      return {
        from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case '3m-ago':
      return {
        from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        to: today,
      };
    case '6m-ago':
      return {
        from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
        to: today,
      };
    case 'year-start':
      return { from: `${now.getFullYear()}-01-01`, to: today };
    default:
      return {
        from: toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      };
  }
}

// ── Component ──

export function CCTVProfitLossReport() {
  const { goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const now = new Date();
  const [fromDate, setFromDate] = useState(
    toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [toDate, setToDate] = useState(toLocalDateStr(now));
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'monthly' | 'expenses'>('summary');
  const [downloading, setDownloading] = useState(false);

  // ── Fetch ──
  const doFetch = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(
        `/api/businesses/${businessId}/cctv/reports/profit-loss?${params.toString()}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // error
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    const id = setTimeout(() => doFetch(fromDate, toDate), 0);
    return () => clearTimeout(id);
  }, [fromDate, toDate, doFetch]);

  const handleQuickRange = (range: { from: string; to: string }) => {
    setFromDate(range.from);
    setToDate(range.to);
  };

  // ── CSV Export ──
  const handleExportCSV = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const rows: string[] = [];
      rows.push('Month,Revenue,COGS,Gross Profit,Gross Margin %,OpEx,Net Profit,Net Margin %,Sales,Expenses');

      // Total row
      const s = data.summary;
      rows.push(
        `TOTAL,${s.revenue.toFixed(2)},${s.cogs.toFixed(2)},${s.grossProfit.toFixed(2)},${s.grossMargin},${s.opex.toFixed(2)},${s.netProfit.toFixed(2)},${s.netMargin},${s.saleCount},${s.expenseCount}`
      );

      // Monthly rows
      for (const m of data.months) {
        rows.push(
          `${m.monthLabel},${m.revenue.toFixed(2)},${m.cogs.toFixed(2)},${m.grossProfit.toFixed(2)},${m.grossMargin},${m.opex.toFixed(2)},${m.netProfit.toFixed(2)},${m.netMargin},${m.saleCount},${m.expenseCount}`
        );
      }

      // Expense breakdown
      rows.push('');
      rows.push('Expense Category,Amount,Count');
      for (const eb of data.expenseBreakdown) {
        rows.push(
          `${CATEGORY_LABELS[eb.category] || eb.category},${eb.total.toFixed(2)},${eb.count}`
        );
      }

      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profit_loss_${fromDate}_${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // error
    }
    setDownloading(false);
  };

  // ── Derived ──
  const summary = data?.summary;
  const months = data?.months || [];

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
          <h1 className="text-lg font-bold text-gray-900">Profit & Loss</h1>
          <p className="text-[10px] text-gray-400">Financial Performance Report</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={downloading || loading || !data || data.summary.saleCount === 0}
          className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 active:bg-gray-50 transition-all flex items-center gap-1.5 disabled:opacity-40"
        >
          {downloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
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
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
              showFilters ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-200'
            }`}
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

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : !data || data.summary.saleCount === 0 ? (
        /* ── Empty state ── */
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
            <PieChart className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">No sales data in this period</p>
          <p className="text-xs text-gray-400 mt-1">Try a different date range</p>
        </div>
      ) : (
        <>
          {/* ── Tab switcher ── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-1 shadow-sm flex">
            {(
              [
                { key: 'summary', label: 'Summary' },
                { key: 'monthly', label: 'Monthly' },
                { key: 'expenses', label: 'Expenses' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-violet-100 text-violet-700 shadow-sm'
                    : 'text-gray-500 active:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════ */}
          {/* ── SUMMARY TAB ── */}
          {/* ══════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              {/* ── Net Profit Hero Card ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className={`rounded-2xl p-4 shadow-sm border ${
                  (summary?.netProfit || 0) >= 0
                    ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/60'
                    : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        (summary?.netProfit || 0) >= 0
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {summary && summary.netProfit >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                        Net Profit
                      </p>
                      <p
                        className={`text-xl font-bold ${
                          (summary?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {formatBDT(summary?.netProfit || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-medium">Net Margin</p>
                    <p
                      className={`text-lg font-bold ${
                        (summary?.netMargin || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {summary?.netMargin || 0}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span>{summary?.saleCount || 0} sales</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span>{summary?.expenseCount || 0} expenses</span>
                </div>
              </motion.div>

              {/* ── P&L Breakdown Card ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
              >
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Income Statement
                </h3>

                {/* Revenue */}
                <PLRow
                  icon={<Wallet className="w-4 h-4" />}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                  label="Revenue"
                  value={formatBDT(summary?.revenue || 0)}
                  delay={0.12}
                />

                {/* COGS */}
                <PLRow
                  icon={<Package className="w-4 h-4" />}
                  iconBg="bg-orange-50"
                  iconColor="text-orange-600"
                  label="Cost of Goods Sold (COGS)"
                  value={formatBDT(summary?.cogs || 0)}
                  valueColor="text-red-600"
                  prefix="-"
                  delay={0.15}
                />

                {/* Divider: Gross Profit */}
                <div className="border-t border-dashed border-gray-200 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-800">Gross Profit</p>
                      <Badge className="text-[9px] px-1.5 py-0 rounded-full border-0 font-semibold leading-3 bg-violet-100 text-violet-700">
                        {summary?.grossMargin || 0}%
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {formatBDT(summary?.grossProfit || 0)}
                    </p>
                  </div>
                </div>

                {/* Operating Expenses */}
                <PLRow
                  icon={<Receipt className="w-4 h-4" />}
                  iconBg="bg-rose-50"
                  iconColor="text-rose-600"
                  label="Operating Expenses"
                  value={formatBDT(summary?.opex || 0)}
                  valueColor="text-red-600"
                  prefix="-"
                  delay={0.18}
                />

                {/* Divider: Net Profit */}
                <div className="border-t-2 border-gray-800 pt-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-900">Net Profit</p>
                      <Badge
                        className={`text-[9px] px-1.5 py-0 rounded-full border-0 font-semibold leading-3 ${
                          (summary?.netMargin || 0) >= 0
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {summary?.netMargin || 0}%
                      </Badge>
                    </div>
                    <p
                      className={`text-base font-bold ${
                        (summary?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatBDT(summary?.netProfit || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* ── Gross Margin Visual ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.22 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <PieChart className="w-3.5 h-3.5" /> Profit Composition
                </h3>
                {summary && summary.revenue > 0 ? (
                  <ProfitCompositionBar
                    grossProfit={summary.grossProfit}
                    opex={summary.opex}
                    netProfit={summary.netProfit}
                    revenue={summary.revenue}
                  />
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">No revenue data</p>
                )}
              </motion.div>
            </div>
          )}

          {/* ══════════════════════════════════════ */}
          {/* ── MONTHLY TAB ── */}
          {/* ══════════════════════════════════════ */}
          {activeTab === 'monthly' && (
            <div className="space-y-3">
              {/* ── Monthly chart (bar comparison) ── */}
              {months.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                >
                  <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Monthly Revenue vs Net Profit
                  </h3>
                  <div className="flex items-end gap-1.5 h-32">
                    {months.map((m, i) => {
                      const maxVal = Math.max(
                        ...months.map((x) => Math.max(x.revenue, Math.abs(x.netProfit))),
                        1
                      );
                      const revH = Math.max((m.revenue / maxVal) * 100, 2);
                      const netH = m.netProfit >= 0
                        ? Math.max((m.netProfit / maxVal) * 100, 1)
                        : Math.max((Math.abs(m.netProfit) / maxVal) * 100, 1);
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full relative flex-1 flex items-end justify-center gap-0.5">
                            {/* Revenue bar */}
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${revH}%` }}
                              transition={{ duration: 0.4, delay: i * 0.06 }}
                              className="w-[45%] rounded-t-sm bg-violet-400"
                            />
                            {/* Net profit bar */}
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${netH}%` }}
                              transition={{ duration: 0.4, delay: i * 0.06 + 0.1 }}
                              className={`w-[45%] rounded-t-sm ${
                                m.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-400'
                              }`}
                            />
                          </div>
                          <span className="text-[7px] text-gray-400 font-medium whitespace-nowrap mt-0.5">
                            {m.monthLabel.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 mt-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-violet-400" />
                      <span className="text-[9px] text-gray-500">Revenue</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                      <span className="text-[9px] text-gray-500">Net Profit</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Monthly detail cards ── */}
              {months.map((m, i) => (
                <motion.div
                  key={m.month}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.08 + i * 0.04 }}
                  className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-bold text-gray-800">{m.monthLabel}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-gray-400">
                        {m.saleCount} sales
                      </span>
                      {m.expenseCount > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                          <span className="text-[9px] text-gray-400">
                            {m.expenseCount} exp
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Revenue</p>
                      <p className="text-xs font-bold text-gray-900">{formatBDT(m.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Gross</p>
                      <div className="flex items-center gap-1">
                        <p
                          className={`text-xs font-bold ${
                            m.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatBDT(m.grossProfit)}
                        </p>
                        <span className="text-[8px] text-gray-400">{m.grossMargin}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Net</p>
                      <div className="flex items-center gap-1">
                        <p
                          className={`text-xs font-bold ${
                            m.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatBDT(m.netProfit)}
                        </p>
                        <span className="text-[8px] text-gray-400">{m.netMargin}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Mini breakdown bar */}
                  {m.revenue > 0 && (
                    <div className="mt-2.5">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                        <div
                          className="bg-orange-300 h-full"
                          style={{ width: `${(m.cogs / m.revenue) * 100}%` }}
                          title={`COGS: ${((m.cogs / m.revenue) * 100).toFixed(1)}%`}
                        />
                        <div
                          className="bg-rose-300 h-full"
                          style={{ width: `${(m.opex / m.revenue) * 100}%` }}
                          title={`OpEx: ${((m.opex / m.revenue) * 100).toFixed(1)}%`}
                        />
                        <div
                          className={`h-full ${m.netProfit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                          style={{
                            width: `${Math.max(
                              ((m.netProfit / m.revenue) * 100),
                              m.netProfit >= 0 ? 1 : 0
                            )}%`,
                          }}
                          title={`Net: ${m.netMargin}%`}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════ */}
          {/* ── EXPENSES TAB ── */}
          {/* ══════════════════════════════════════ */}
          {activeTab === 'expenses' && (
            <div className="space-y-3">
              {data.expenseBreakdown.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
                  <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-500">No expenses recorded</p>
                  <p className="text-xs text-gray-400 mt-1">Expenses from this period will appear here</p>
                </div>
              ) : (
                <>
                  {/* OpEx total */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                          <TrendingDown className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 font-medium">Total Operating Expenses</p>
                          <p className="text-lg font-bold text-red-600">
                            {formatBDT(summary?.opex || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">% of Revenue</p>
                        <p className="text-sm font-bold text-gray-700">
                          {summary && summary.revenue > 0
                            ? `${((summary.opex / summary.revenue) * 100).toFixed(1)}%`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Category breakdown */}
                  {data.expenseBreakdown.map((eb, i) => {
                    const catLabel = CATEGORY_LABELS[eb.category] || eb.category;
                    const pctOfTotal =
                      (summary?.opex || 0) > 0
                        ? ((eb.total / (summary?.opex || 1)) * 100).toFixed(1)
                        : '0';
                    return (
                      <motion.div
                        key={eb.category}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.08 + i * 0.04 }}
                        className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{catLabel}</p>
                            <p className="text-[10px] text-gray-400">
                              {eb.count} expense{eb.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-600">{formatBDT(eb.total)}</p>
                            <p className="text-[10px] text-gray-400">{pctOfTotal}% of OpEx</p>
                          </div>
                        </div>
                        {/* Proportion bar */}
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pctOfTotal}%` }}
                            transition={{ duration: 0.5, delay: 0.15 + i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ── Sub-components ──

function PLRow({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor = 'text-gray-900',
  prefix = '',
  delay = 0,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  prefix?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay }}
      className="flex items-center gap-2.5"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <p className="text-xs text-gray-600 flex-1">{label}</p>
      <p className={`text-xs font-bold ${valueColor}`}>
        {prefix}{value}
      </p>
    </motion.div>
  );
}

function ProfitCompositionBar({
  grossProfit,
  opex,
  netProfit,
  revenue,
}: {
  grossProfit: number;
  opex: number;
  netProfit: number;
  revenue: number;
}) {
  const cogs = revenue - grossProfit;
  const cogsPct = (cogs / revenue) * 100;
  const opexPct = (opex / revenue) * 100;
  const netPct = Math.max((netProfit / revenue) * 100, 0);

  return (
    <div>
      {/* Stacked bar */}
      <div className="h-6 rounded-lg overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cogsPct}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-orange-300 h-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${opexPct}%` }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-rose-300 h-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${netPct}%` }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className={`h-full ${netProfit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ minWidth: netProfit >= 0 && netPct > 0 ? '4px' : '0' }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        <LegendItem color="bg-orange-300" label="COGS" pct={cogsPct.toFixed(1)} />
        <LegendItem color="bg-rose-300" label="OpEx" pct={opexPct.toFixed(1)} />
        <LegendItem
          color={netProfit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}
          label="Net Profit"
          pct={netPct.toFixed(1)}
        />
      </div>
    </div>
  );
}

function LegendItem({ color, label, pct }: { color: string; label: string; pct: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-[10px] text-gray-600">{label}</span>
      <span className="text-[10px] font-bold text-gray-800">{pct}%</span>
    </div>
  );
}