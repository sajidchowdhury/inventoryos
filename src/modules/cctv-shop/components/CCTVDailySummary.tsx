'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Calendar, TrendingUp, ShoppingCart, Wrench,
  Receipt, RefreshCw, DollarSign, ArrowDown, ArrowUp, Printer,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${Math.abs(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function CCTVDailySummary() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/reports/daily-summary?date=${date}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId, date]);

  const handlePrint = () => window.print();

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Daily Business Summary</h1>
        <button onClick={handlePrint}
          className="ml-auto h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Date picker */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-400" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-xl text-sm max-w-xs" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : data ? (
        <>
          {/* Print header */}
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">Daily Business Summary — {data.date}</h1>
          </div>

          {/* Net cash flow hero card */}
          <div className={cn(
            'rounded-2xl p-6 text-white shadow-lg',
            data.summary.netCashFlow >= 0
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
              : 'bg-gradient-to-br from-red-500 to-rose-600'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/80 uppercase tracking-wider">Net Cash Flow</p>
                <p className="text-3xl font-bold mt-1">{formatBDT(data.summary.netCashFlow)}</p>
                <p className="text-xs text-white/70 mt-1">
                  Money In: {formatBDT(data.summary.moneyIn)} · Money Out: {formatBDT(data.summary.moneyOut)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/80 uppercase tracking-wider">{data.date}</p>
                <p className="text-sm font-semibold mt-1">
                  {data.summary.sales.count + data.summary.purchases.count + data.summary.expenses.count} transactions
                </p>
              </div>
            </div>
          </div>

          {/* Summary cards grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Sales */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Sales</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatBDT(data.summary.sales.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {data.summary.sales.count} sale(s) · Due: {formatBDT(data.summary.sales.due)}
              </p>
            </div>

            {/* Purchases */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Purchases</span>
                <ShoppingCart className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-blue-600">{formatBDT(data.summary.purchases.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {data.summary.purchases.count} purchase(s) · Due: {formatBDT(data.summary.purchases.due)}
              </p>
            </div>

            {/* Expenses */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Expenses</span>
                <Receipt className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-xl font-bold text-red-600">{formatBDT(data.summary.expenses.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{data.summary.expenses.count} expense(s)</p>
            </div>

            {/* Repairs */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Repairs</span>
                <Wrench className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-amber-600">{formatBDT(data.summary.repairs.revenue)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {data.summary.repairs.count} repair(s) · {data.summary.repairs.warrantyCount} warranty
              </p>
            </div>

            {/* Returns */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Returns</span>
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </div>
              <p className="text-xl font-bold text-gray-600">{formatBDT(data.summary.returns.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{data.summary.returns.count} return(s)</p>
            </div>

            {/* Customer Payments */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-500 font-medium">Customer Payments</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatBDT(data.summary.customerPayments.total)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{data.summary.customerPayments.count} payment(s)</p>
            </div>
          </div>

          {/* Detailed transactions */}
          {data.details.sales.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">Sales ({data.details.sales.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.details.sales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{sale.customerName || 'Walk-in'}</p>
                      <p className="text-[10px] text-gray-400">{formatTime(sale.saleDate)}{sale.paymentType === 'credit' ? ' · Credit' : ' · Cash'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">{formatBDT(sale.totalAmount)}</p>
                      {sale.dueAmount > 0 && <p className="text-[10px] text-red-500">Due: {formatBDT(sale.dueAmount)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.details.purchases.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">Purchases ({data.details.purchases.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.details.purchases.map((pur: any) => (
                  <div key={pur.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{pur.supplierName || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-400">{pur.invoiceNo || 'No invoice'}</p>
                    </div>
                    <p className="font-semibold text-blue-600">{formatBDT(pur.totalAmount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.details.expenses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">Expenses ({data.details.expenses.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.details.expenses.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{exp.category}</p>
                      {exp.description && <p className="text-[10px] text-gray-400">{exp.description}</p>}
                    </div>
                    <p className="font-semibold text-red-600">{formatBDT(exp.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.details.repairs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">Repairs Received ({data.details.repairs.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.details.repairs.map((rep: any) => (
                  <div key={rep.id} className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">
                        {rep.tokenNo} · {rep.productName || rep.serialNumber}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {rep.customerName || 'Walk-in'}
                        {rep.underWarranty && <span className="text-emerald-500 ml-1">· Warranty</span>}
                      </p>
                    </div>
                    {rep.repairCost > 0 && <p className="font-semibold text-amber-600">{formatBDT(rep.repairCost)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {data.summary.sales.count === 0 && data.summary.purchases.count === 0 && data.summary.expenses.count === 0 && data.summary.repairs.count === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">No transactions on this day</p>
              <p className="text-xs text-gray-400 mt-1">Pick a different date</p>
            </div>
          )}
        </>
      ) : null}
    </motion.div>
  );
}
