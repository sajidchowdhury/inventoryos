'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Heart, TrendingUp, TrendingDown, Minus,
  ShoppingCart, Receipt, Wrench, AlertTriangle, CheckCircle2, Activity,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${Math.abs(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function ChangeIndicator({ value }: { value: number }) {
  if (value > 0) {
    return <span className="text-emerald-600 flex items-center gap-0.5 text-xs"><TrendingUp className="w-3 h-3" /> +{value}%</span>;
  }
  if (value < 0) {
    return <span className="text-red-600 flex items-center gap-0.5 text-xs"><TrendingDown className="w-3 h-3" /> {value}%</span>;
  }
  return <span className="text-gray-500 flex items-center gap-0.5 text-xs"><Minus className="w-3 h-3" /> 0%</span>;
}

export function CCTVWeeklyHealth() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/reports/weekly-health`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!data) return null;

  const { thisWeek, prevWeek, dailyData, insights } = data;
  const maxSales = Math.max(...dailyData.map((d: any) => d.sales), 1);

  const healthColor = insights.healthScore >= 80 ? 'from-emerald-500 to-green-600' :
                       insights.healthScore >= 60 ? 'from-blue-500 to-cyan-600' :
                       insights.healthScore >= 40 ? 'from-amber-500 to-orange-600' :
                       'from-red-500 to-rose-600';

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Weekly Health Report</h1>
      </div>

      <p className="text-xs text-gray-500 px-1">
        {data.period.from} → {data.period.to} · Compared to previous 7 days
      </p>

      {/* Health Score Hero */}
      <div className={cn('rounded-2xl p-6 text-white shadow-lg bg-gradient-to-br', healthColor)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/80 uppercase tracking-wider flex items-center gap-1">
              <Heart className="w-3 h-3" /> Business Health Score
            </p>
            <p className="text-4xl font-bold mt-2">{insights.healthScore}<span className="text-xl text-white/60">/100</span></p>
            <p className="text-sm font-semibold mt-1">{insights.healthLabel}</p>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center">
            <span className="text-2xl font-bold">{insights.healthScore}%</span>
          </div>
        </div>
      </div>

      {/* This Week Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 font-medium">Sales</span>
            <ChangeIndicator value={insights.salesChange} />
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatBDT(thisWeek.sales)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Prev: {formatBDT(prevWeek.sales)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 font-medium">Purchases</span>
            <ShoppingCart className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-blue-600">{formatBDT(thisWeek.purchases)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Prev: {formatBDT(prevWeek.purchases)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 font-medium">Expenses</span>
            <ChangeIndicator value={insights.expenseChange} />
          </div>
          <p className="text-xl font-bold text-red-600">{formatBDT(thisWeek.expenses)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Prev: {formatBDT(prevWeek.expenses)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 font-medium">Net Profit</span>
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <p className={cn('text-xl font-bold', thisWeek.profit >= 0 ? 'text-violet-600' : 'text-red-600')}>
            {formatBDT(thisWeek.profit)}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Change: {formatBDT(insights.profitChange)}</p>
        </div>
      </div>

      {/* 7-Day Sales Graph */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">7-Day Sales Trend</h3>
        <div className="flex items-end justify-between gap-2 h-40">
          {dailyData.map((day: any, i: number) => {
            const heightPct = (day.sales / maxSales) * 100;
            const isBest = day.label === insights.bestDay;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-500 font-medium">
                  {day.sales > 0 ? formatBDT(day.sales) : ''}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPct, 2)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className={cn(
                      'w-full rounded-t-lg',
                      isBest ? 'bg-gradient-to-t from-emerald-500 to-teal-400' : 'bg-gradient-to-t from-violet-500 to-purple-400'
                    )}
                  />
                </div>
                <span className={cn(
                  'text-[10px] font-medium',
                  isBest ? 'text-emerald-600' : 'text-gray-500'
                )}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs">
          <span className="text-gray-500">
            Best day: <span className="font-semibold text-emerald-600">{insights.bestDay}</span>
          </span>
          <span className="text-gray-500">
            Slowest day: <span className="font-semibold text-gray-700">{insights.worstDay}</span>
          </span>
        </div>
      </div>

      {/* Insights cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.activeRepairs > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-800">Active Repairs</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{insights.activeRepairs}</p>
            <p className="text-[10px] text-amber-600 mt-1">Products in repair queue</p>
          </div>
        )}
        {insights.lowStockProducts > 0 && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-800">Low Stock Alert</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{insights.lowStockProducts}</p>
            <p className="text-[10px] text-red-600 mt-1">Products need restocking</p>
          </div>
        )}
        {insights.salesChange > 0 && (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800">Sales Growing</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">+{insights.salesChange}%</p>
            <p className="text-[10px] text-emerald-600 mt-1">vs previous week</p>
          </div>
        )}
        {insights.expenseChange > 0 && (
          <div className="bg-orange-50 rounded-2xl border border-orange-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-orange-800">Expenses Up</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">+{insights.expenseChange}%</p>
            <p className="text-[10px] text-orange-600 mt-1">Keep an eye on spending</p>
          </div>
        )}
        {thisWeek.profit > 0 && (
          <div className="bg-violet-50 rounded-2xl border border-violet-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-800">Profitable Week</span>
            </div>
            <p className="text-2xl font-bold text-violet-700">{formatBDT(thisWeek.profit)}</p>
            <p className="text-[10px] text-violet-600 mt-1">Sales - Purchases - Expenses</p>
          </div>
        )}
        {insights.salesChange < 0 && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-800">Sales Dropping</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{insights.salesChange}%</p>
            <p className="text-[10px] text-red-600 mt-1">vs previous week — investigate</p>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-4">
        <h3 className="text-sm font-bold text-violet-800 mb-2 flex items-center gap-1">
          <Heart className="w-4 h-4" /> Smart Recommendations
        </h3>
        <ul className="space-y-1.5 text-xs text-violet-700">
          {insights.lowStockProducts > 5 && (
            <li className="flex items-start gap-1.5">
              <span>•</span>
              <span>You have {insights.lowStockProducts} low-stock products. Consider restocking soon.</span>
            </li>
          )}
          {insights.activeRepairs > 5 && (
            <li className="flex items-start gap-1.5">
              <span>•</span>
              <span>{insights.activeRepairs} repairs in queue. Complete them to collect repair revenue.</span>
            </li>
          )}
          {insights.salesChange > 20 && (
            <li className="flex items-start gap-1.5">
              <span>•</span>
              <span>Sales grew {insights.salesChange}% — great momentum! Keep pushing.</span>
            </li>
          )}
          {insights.expenseChange > 20 && (
            <li className="flex items-start gap-1.5">
              <span>•</span>
              <span>Expenses increased {insights.expenseChange}%. Review where money is going.</span>
            </li>
          )}
          {thisWeek.profit < 0 && (
            <li className="flex items-start gap-1.5">
              <span>•</span>
              <span>You operated at a loss this week. Reduce expenses or increase prices.</span>
            </li>
          )}
          {thisWeek.profit > 0 && insights.salesChange >= 0 && insights.expenseChange <= 0 && (
            <li className="flex items-start gap-1.5">
              <span>•</span>
              <span>Healthy week! Sales up, expenses controlled. Keep doing what you are doing.</span>
            </li>
          )}
        </ul>
      </div>
    </motion.div>
  );
}
