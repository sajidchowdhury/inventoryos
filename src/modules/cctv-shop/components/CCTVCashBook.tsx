'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Wallet,
  Calendar, Printer,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface CashEntry {
  time: string;
  description: string;
  amountIn: number;
  amountOut: number;
  type: string;
}

interface CashBookData {
  success: boolean;
  date: string;
  entries: CashEntry[];
  summary: {
    totalIn: number;
    totalOut: number;
    netCash: number;
    transactionCount: number;
  };
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CCTVCashBook() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<CashBookData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId || !date) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/reports/cash-book?date=${date}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId, date]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Daily Cash Book</h1>
        <button
          onClick={handlePrint}
          className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Date picker */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-xl max-w-[200px]"
          />
        </div>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{businessName}</h1>
        <p className="text-sm text-gray-600">Daily Cash Book — {formatDateDisplay(date)}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : data && data.entries.length > 0 ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-emerald-700 font-medium">Money In</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-700">{formatBDT(data.summary.totalIn)}</p>
            </div>
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-red-700 font-medium">Money Out</span>
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-xl font-bold text-red-700">{formatBDT(data.summary.totalOut)}</p>
            </div>
            <div className={cn(
              'rounded-2xl border p-4',
              data.summary.netCash >= 0
                ? 'bg-violet-50 border-violet-100'
                : 'bg-amber-50 border-amber-100'
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-xs font-medium',
                  data.summary.netCash >= 0 ? 'text-violet-700' : 'text-amber-700'
                )}>Net Cash</span>
                <Wallet className={cn(
                  'w-4 h-4',
                  data.summary.netCash >= 0 ? 'text-violet-500' : 'text-amber-500'
                )} />
              </div>
              <p className={cn(
                'text-xl font-bold',
                data.summary.netCash >= 0 ? 'text-violet-700' : 'text-amber-700'
              )}>
                {formatBDT(data.summary.netCash)}
              </p>
            </div>
          </div>

          {/* Transaction table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-semibold text-gray-700">Time</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Description</th>
                    <th className="text-right p-3 font-semibold text-emerald-700">In (৳)</th>
                    <th className="text-right p-3 font-semibold text-red-700">Out (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-3 text-gray-500 font-mono text-xs">{entry.time}</td>
                      <td className="p-3 text-gray-700">
                        {entry.description}
                        <span className={cn(
                          'ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                          entry.type === 'sale' ? 'bg-emerald-50 text-emerald-600' :
                          entry.type === 'expense' ? 'bg-red-50 text-red-600' :
                          entry.type.includes('purchase') ? 'bg-amber-50 text-amber-600' :
                          entry.type.includes('supplier') ? 'bg-orange-50 text-orange-600' :
                          'bg-blue-50 text-blue-600'
                        )}>
                          {entry.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-emerald-700">
                        {entry.amountIn > 0 ? formatBDT(entry.amountIn) : '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-red-700">
                        {entry.amountOut > 0 ? formatBDT(entry.amountOut) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={2} className="p-3 font-bold text-gray-800">Total</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{formatBDT(data.summary.totalIn)}</td>
                    <td className="p-3 text-right font-bold text-red-700">{formatBDT(data.summary.totalOut)}</td>
                  </tr>
                  <tr className="bg-violet-50">
                    <td colSpan={2} className="p-3 font-bold text-violet-800">Net Cash Position</td>
                    <td colSpan={2} className="p-3 text-right font-bold text-violet-700">
                      {formatBDT(data.summary.netCash)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center print:hidden">
            {data.summary.transactionCount} transactions on {formatDateDisplay(data.date)}
          </p>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No transactions on this day</p>
          <p className="text-xs text-gray-400 mt-1">
            Select a different date or make some sales/purchases first
          </p>
        </div>
      )}
    </motion.div>
  );
}
