'use client';

import { useState } from 'react';
import { ReportShell, formatBDT, formatDate } from './ReportShell';
import { TrendingUp, ShoppingBag, DollarSign, AlertCircle, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';

export function CCTVSalesReport() {
  const { navigate } = useCCTVNavStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (params: Record<string, string>) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${useBusinessId()}/cctv/reports/sales-report?from=${params.from}&to=${params.to}`);
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
      title="Sales Report"
      description="All sales in a date range — totals, payment methods, top products"
      onSearch={handleSearch}
      loading={loading}
      hasSearched={hasSearched}
    >
      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Total Sales</span>
                <ShoppingBag className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-xl font-bold text-violet-600">{data.summary.count}</p>
              <p className="text-[10px] text-gray-400 mt-1">transactions</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Total Amount</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatBDT(data.summary.totalAmount)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Paid</span>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xl font-bold text-blue-600">{formatBDT(data.summary.totalPaid)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Due</span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-xl font-bold text-red-600">{formatBDT(data.summary.totalDue)}</p>
            </div>
          </div>

          {/* Payment method breakdown */}
          {Object.keys(data.summary.methodBreakdown || {}).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Payment Methods</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(data.summary.methodBreakdown).map(([method, amount]: [string, any]) => (
                  <div key={method} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 uppercase">{method}</p>
                    <p className="text-sm font-bold text-gray-900">{formatBDT(amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top products */}
          {data.topProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">Top Products</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Product</th>
                      <th className="text-center p-3 font-semibold text-gray-700">Qty Sold</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="p-3 text-gray-800">{p.name}</td>
                        <td className="p-3 text-center text-gray-600">{p.qty}</td>
                        <td className="p-3 text-right font-semibold text-emerald-600">{formatBDT(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sales detail */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">All Sales ({data.sales.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {data.sales.map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{sale.customerName || 'Walk-in'}</p>
                    <p className="text-[10px] text-gray-400">
                      {formatDate(sale.saleDate)} · {sale.items.length} item(s)
                      {sale.paymentType === 'credit' && ' · Credit'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-3">
                    <p className="font-semibold text-emerald-600">{formatBDT(sale.totalAmount)}</p>
                    {sale.dueAmount > 0 && <p className="text-[10px] text-red-500">Due: {formatBDT(sale.dueAmount)}</p>}
                  </div>
                  <button
                    onClick={() => navigate('sale-invoice', sale.id)}
                    className="w-8 h-8 rounded-lg bg-violet-50 hover:bg-violet-100 flex items-center justify-center shrink-0"
                    title="Print Invoice"
                  >
                    <Printer className="w-4 h-4 text-violet-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}

// Helper to get businessId from auth store
import { useAuthStore } from '@/stores/auth-store';
function useBusinessId() {
  return useAuthStore.getState().session?.business?.id || '';
}
