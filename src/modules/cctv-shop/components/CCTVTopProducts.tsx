'use client';

import { useState } from 'react';
import { ReportShell, formatBDT } from './ReportShell';
import { Package, TrendingUp, Award } from 'lucide-react';

export function CCTVTopProducts() {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [view, setView] = useState<'revenue' | 'qty'>('revenue');

  const handleSearch = async (params: Record<string, string>) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/reports/top-products?from=${params.from}&to=${params.to}&limit=20`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const products = view === 'revenue' ? data?.topByRevenue : data?.topByQty;

  return (
    <ReportShell
      title="Top Products Report"
      description="Best-selling products by revenue and quantity"
      onSearch={handleSearch}
      loading={loading}
      hasSearched={hasSearched}
    >
      {data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-[11px] text-gray-500 font-medium">Products Sold</span>
              <p className="text-xl font-bold text-violet-600">{data.summary.totalProducts}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-[11px] text-gray-500 font-medium">Total Qty Sold</span>
              <p className="text-xl font-bold text-blue-600">{data.summary.totalQtySold}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-[11px] text-gray-500 font-medium">Total Revenue</span>
              <p className="text-xl font-bold text-emerald-600">{formatBDT(data.summary.totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-[11px] text-gray-500 font-medium">Total Profit</span>
              <p className="text-xl font-bold text-violet-600">{formatBDT(data.summary.totalProfit)}</p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setView('revenue')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${view === 'revenue' ? 'bg-violet-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              By Revenue
            </button>
            <button
              onClick={() => setView('qty')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${view === 'qty' ? 'bg-violet-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              By Quantity
            </button>
          </div>

          {/* Products list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Top {products?.length || 0} Products
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {products?.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                      <span className="flex items-center gap-0.5"><Package className="w-2.5 h-2.5" /> {p.qtySold} sold</span>
                      <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5" /> Profit: {formatBDT(p.profit)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-600">{formatBDT(p.revenue)}</p>
                    <p className="text-[10px] text-gray-400">revenue</p>
                  </div>
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
