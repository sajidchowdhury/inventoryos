'use client';

import { useState } from 'react';
import { ReportShell, formatBDT } from './ReportShell';
import { TrendingUp, TrendingDown, DollarSign, Wrench, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CCTVProfitLoss() {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (params: Record<string, string>) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/reports/profit-loss?from=${params.from}&to=${params.to}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReportShell
      title="Profit & Loss Report"
      description="Revenue minus cost of goods minus expenses = net profit"
      onSearch={handleSearch}
      loading={loading}
      hasSearched={hasSearched}
    >
      {data && (
        <div className="space-y-4">
          {/* Net profit hero */}
          <div className={cn(
            'rounded-2xl p-6 text-white shadow-lg',
            data.summary.netProfit >= 0
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
              : 'bg-gradient-to-br from-red-500 to-rose-600'
          )}>
            <p className="text-xs text-white/80 uppercase tracking-wider">Net Profit</p>
            <p className="text-3xl font-bold mt-1">{formatBDT(data.summary.netProfit)}</p>
            <p className="text-xs text-white/70 mt-2">
              {data.summary.salesCount} sales · {data.summary.expenseCount} expenses · {data.summary.repairCount} repairs
            </p>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-gray-800">Breakdown</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Sales Revenue
                </span>
                <span className="text-sm font-bold text-emerald-600">{formatBDT(data.summary.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-blue-500" /> Cost of Goods Sold
                </span>
                <span className="text-sm font-bold text-blue-600">-{formatBDT(data.summary.totalCOGS)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Gross Profit</span>
                <span className="text-sm font-bold text-violet-600">{formatBDT(data.summary.grossProfit)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" /> Repair Revenue
                </span>
                <span className="text-sm font-bold text-amber-600">+{formatBDT(data.summary.repairRevenue)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                <span className="text-sm text-gray-700 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-red-500" /> Total Expenses
                </span>
                <span className="text-sm font-bold text-red-600">-{formatBDT(data.summary.totalExpenses)}</span>
              </div>
              <div className={cn(
                'flex items-center justify-between p-3 rounded-xl border-t-2',
                data.summary.netProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'
              )}>
                <span className="text-sm font-bold text-gray-900">Net Profit</span>
                <span className={cn(
                  'text-lg font-bold',
                  data.summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                )}>{formatBDT(data.summary.netProfit)}</span>
              </div>
            </div>
          </div>

          {/* Expense by category */}
          {Object.keys(data.expenseByCategory).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Expenses by Category</h3>
              <div className="space-y-2">
                {Object.entries(data.expenseByCategory).map(([cat, amount]: [string, any]) => (
                  <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                    <span className="text-sm text-gray-700">{cat}</span>
                    <span className="text-sm font-semibold text-red-600">{formatBDT(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
}

import { useAuthStore } from '@/stores/auth-store';
