'use client';

import { useState } from 'react';
import { ReportShell, formatBDT, formatDate } from './ReportShell';
import { ShoppingCart, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';

export function CCTVPurchaseReport() {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (params: Record<string, string>) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/reports/purchase-report?from=${params.from}&to=${params.to}`);
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
      title="Purchase Report"
      description="All purchases in a date range — totals, suppliers, top products"
      onSearch={handleSearch}
      loading={loading}
      hasSearched={hasSearched}
    >
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Total Purchases</span>
                <ShoppingCart className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xl font-bold text-blue-600">{data.summary.count}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Total Amount</span>
                <TrendingUp className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-xl font-bold text-violet-600">{formatBDT(data.summary.totalAmount)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Paid</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatBDT(data.summary.totalPaid)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500 font-medium">Due</span>
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-xl font-bold text-red-600">{formatBDT(data.summary.totalDue)}</p>
            </div>
          </div>

          {/* Supplier breakdown */}
          {Object.keys(data.summary.supplierBreakdown || {}).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">By Supplier</h3>
              <div className="space-y-2">
                {Object.entries(data.summary.supplierBreakdown).map(([supplier, amount]: [string, any]) => (
                  <div key={supplier} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                    <span className="text-sm text-gray-700">{supplier}</span>
                    <span className="text-sm font-semibold text-blue-600">{formatBDT(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchases detail */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">All Purchases ({data.purchases.length})</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {data.purchases.map((pur: any) => (
                <div key={pur.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{pur.supplierName || 'Unknown'}</p>
                    <p className="text-[10px] text-gray-400">
                      {formatDate(pur.purchaseDate)} · {pur.items.length} item(s)
                      {pur.invoiceNo && ` · ${pur.invoiceNo}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{formatBDT(pur.totalAmount)}</p>
                    {pur.dueAmount > 0 && <p className="text-[10px] text-red-500">Due: {formatBDT(pur.dueAmount)}</p>}
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
