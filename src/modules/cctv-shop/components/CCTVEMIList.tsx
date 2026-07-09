'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CreditCard, AlertCircle, Clock, IndianRupee,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const filters = ['All', 'Active', 'Completed', 'Overdue'] as const;

const statusColors: Record<string, string> = {
  Active: 'bg-violet-100 text-violet-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Overdue: 'bg-red-100 text-red-700',
};

const mockEMIs = [
  { id: '1', customer: 'Rahim Electronics', product: 'Hikvision 16ch NVR + 12 Cameras', total: 180000, monthly: 15000, paidMonths: 6, totalMonths: 12, nextDue: '2025-02-05', status: 'Active' },
  { id: '2', customer: 'City Shopping Mall', product: 'Dahua 32ch NVR + 28 Cameras', total: 480000, monthly: 40000, paidMonths: 8, totalMonths: 12, nextDue: '2025-01-20', status: 'Overdue' },
  { id: '3', customer: 'Green Tower Residency', product: 'Hikvision 8ch NVR + 8 Cameras', total: 96000, monthly: 8000, paidMonths: 12, totalMonths: 12, nextDue: null, status: 'Completed' },
  { id: '4', customer: 'Pacific Telecom', product: 'PTZ System + 4 Bullet Cameras', total: 120000, monthly: 10000, paidMonths: 3, totalMonths: 12, nextDue: '2025-02-10', status: 'Active' },
  { id: '5', customer: 'BD Bank Motijheel', product: 'Hikvision 64ch NVR + 48 IP Cameras', total: 960000, monthly: 80000, paidMonths: 4, totalMonths: 12, nextDue: '2025-01-15', status: 'Overdue' },
  { id: '6', customer: 'Sunrise School', product: 'Dahua 8ch DVR + 8 Cameras', total: 72000, monthly: 6000, paidMonths: 2, totalMonths: 12, nextDue: '2025-02-01', status: 'Active' },
];

export function CCTVEMIList() {
  const { goBack } = useCCTVNavStore();
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const filtered = mockEMIs.filter((e) => activeFilter === 'All' || e.status === activeFilter);

  const totalEMI = mockEMIs.reduce((a, e) => a + e.total, 0);
  const thisMonth = mockEMIs
    .filter((e) => e.status === 'Active' || e.status === 'Overdue')
    .reduce((a, e) => a + e.monthly, 0);
  const overdueCount = mockEMIs.filter((e) => e.status === 'Overdue').length;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">EMI Tracking</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
          <IndianRupee className="w-5 h-5 text-violet-500 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-900">৳{(totalEMI / 100000).toFixed(1)}L</p>
          <p className="text-[10px] text-gray-400 font-medium">Total EMI</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
          <CreditCard className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-900">৳{(thisMonth / 1000).toFixed(0)}K</p>
          <p className="text-[10px] text-gray-400 font-medium">This Month</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
          <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-base font-bold text-gray-900">{overdueCount}</p>
          <p className="text-[10px] text-gray-400 font-medium">Overdue</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === f
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* EMI list */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {filtered.map((emi, i) => {
          const pct = Math.round((emi.paidMonths / emi.totalMonths) * 100);
          const remaining = emi.totalMonths - emi.paidMonths;

          return (
            <motion.div
              key={emi.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{emi.customer}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{emi.product}</p>
                </div>
                <span
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap',
                    statusColors[emi.status]
                  )}
                >
                  {emi.status === 'Completed' ? (
                    <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Done</span>
                  ) : emi.status === 'Overdue' ? (
                    <span className="flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5" /> Overdue</span>
                  ) : (
                    emi.status
                  )}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-400">
                    {emi.paidMonths}/{emi.totalMonths} months paid
                  </span>
                  <span className="text-xs font-bold text-gray-700">{pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                    className={cn(
                      'h-full rounded-full',
                      emi.status === 'Completed' ? 'bg-emerald-500' : emi.status === 'Overdue' ? 'bg-red-500' : 'bg-violet-500'
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400">Total Amount</p>
                  <p className="text-xs font-semibold text-gray-900">৳{emi.total.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Monthly</p>
                  <p className="text-xs font-semibold text-gray-900">৳{emi.monthly.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Remaining</p>
                  <p className="text-xs font-medium text-gray-700">{remaining} months</p>
                </div>
                {emi.nextDue && (
                  <div>
                    <p className="text-[10px] text-gray-400">Next Due</p>
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(emi.nextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No EMI records found</p>
        </div>
      )}
    </motion.div>
  );
}