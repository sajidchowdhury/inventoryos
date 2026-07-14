'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Loader2, Users, AlertTriangle, Phone } from 'lucide-react';
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

const AGING_COLORS: Record<string, string> = {
  '0-30 days': 'bg-emerald-50 text-emerald-700',
  '31-60 days': 'bg-amber-50 text-amber-700',
  '61-90 days': 'bg-orange-50 text-orange-700',
  '90+ days': 'bg-red-50 text-red-700',
};

export function CCTVDueCollection() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/reports/due-collection`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Due Collection Report</h1>
          <p className="text-xs text-gray-500">Customers who owe you money, with aging analysis</p>
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Loading...' : 'Load Dues'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : hasSearched && data ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <span className="text-xs text-red-700 font-medium">Total Due</span>
              <p className="text-xl font-bold text-red-700 mt-1">{formatBDT(data.summary.totalDue)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Customers with Due</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.customerCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Average Due</span>
              <p className="text-xl font-bold text-violet-600 mt-1">{formatBDT(data.summary.avgDue)}</p>
            </div>
          </div>

          {/* Customer list */}
          {data.customers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <Users className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">No outstanding dues!</p>
              <p className="text-xs text-gray-400 mt-1">All customers are settled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.customers.map((c: any) => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold', AGING_COLORS[c.agingBucket] || 'bg-gray-100 text-gray-600')}>
                          {c.agingBucket}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {c.phone || 'No phone'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {c.unpaidSalesCount} unpaid sale(s) · oldest: {c.oldestDueDate || '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-red-600">{formatBDT(c.balance)}</p>
                      <p className="text-[10px] text-gray-400">due</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-amber-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Click "Load Dues" to see who owes you</p>
          <p className="text-xs text-gray-400 mt-1">Shows all customers with outstanding balances + aging</p>
        </div>
      )}
    </motion.div>
  );
}
