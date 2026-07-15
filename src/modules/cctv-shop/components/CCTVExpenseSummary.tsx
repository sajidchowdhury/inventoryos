'use client';

import { useState } from 'react';
import { ReportShell, formatBDT, formatDate } from './ReportShell';
import { Receipt, TrendingDown } from 'lucide-react';

export function CCTVExpenseSummary() {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (params: Record<string, string>) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/reports/expense-summary?from=${params.from}&to=${params.to}`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const maxCategoryTotal = data?.categoryBreakdown?.[0]?.total || 1;

  return (
    <ReportShell
      title="Expense Summary"
      description="All expenses by category with breakdown"
      onSearch={handleSearch}
      loading={loading}
      hasSearched={hasSearched}
    >
      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <span className="text-xs text-red-700 font-medium">Total Expenses</span>
              <p className="text-xl font-bold text-red-700 mt-1">{formatBDT(data.summary.total)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Total Count</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.count}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Avg per Expense</span>
              <p className="text-xl font-bold text-violet-600 mt-1">{formatBDT(data.summary.avgPerExpense)}</p>
            </div>
          </div>

          {/* Category breakdown with bars */}
          {data.categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">By Category</h3>
              <div className="space-y-3">
                {data.categoryBreakdown.map((cat: any) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{cat.category}</span>
                      <span className="text-gray-500">
                        {formatBDT(cat.total)} · {cat.count} expense(s) · {cat.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-rose-500"
                        style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expense list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">All Expenses ({data.expenses.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {data.expenses.map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{exp.category}</p>
                    {exp.description && <p className="text-[10px] text-gray-400">{exp.description}</p>}
                    <p className="text-[10px] text-gray-400">{formatDate(exp.expenseDate)}</p>
                  </div>
                  <p className="font-semibold text-red-600">{formatBDT(exp.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

import { useAuthStore } from '@/stores/auth-store';
