'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, Clock, ChevronRight,
  FileText, CalendarDays, Users,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const coverageColors: Record<string, string> = {
  Basic: 'bg-gray-100 text-gray-600',
  Standard: 'bg-violet-100 text-violet-700',
  Premium: 'bg-amber-100 text-amber-700',
};

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Expiring: 'bg-amber-100 text-amber-700',
  Expired: 'bg-red-100 text-red-700',
};

const mockAMCs = [
  { id: '1', contractId: 'AMC-001', client: 'City Shopping Mall Ltd', coverage: 'Premium', start: '2024-04-01', end: '2025-03-31', monthlyVisits: 2, status: 'Expiring' },
  { id: '2', contractId: 'AMC-002', client: 'BD Bank, Motijheel', coverage: 'Premium', start: '2024-07-01', end: '2025-06-30', monthlyVisits: 4, status: 'Active' },
  { id: '3', contractId: 'AMC-003', client: 'Metro General Hospital', coverage: 'Standard', start: '2024-01-15', end: '2025-01-14', monthlyVisits: 1, status: 'Expired' },
  { id: '4', contractId: 'AMC-004', client: 'Green Tower Residency', coverage: 'Standard', start: '2024-06-01', end: '2025-05-31', monthlyVisits: 1, status: 'Active' },
  { id: '5', contractId: 'AMC-005', client: 'Pacific Telecom', coverage: 'Basic', start: '2024-09-01', end: '2025-08-31', monthlyVisits: 1, status: 'Active' },
  { id: '6', contractId: 'AMC-006', client: 'Sunrise School & College', coverage: 'Standard', start: '2024-03-15', end: '2025-03-14', monthlyVisits: 2, status: 'Expiring' },
];

export function CCTVAMCList() {
  const { navigate, goBack } = useCCTVNavStore();

  const activeCount = mockAMCs.filter((a) => a.status === 'Active').length;
  const expiringCount = mockAMCs.filter((a) => a.status === 'Expiring').length;
  const annualValue = 240000; // Mock total annual value

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">AMC Management</h1>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <span className="font-semibold text-emerald-600">{activeCount} Active</span>
        <span>·</span>
        <span className="text-amber-600 font-medium">{expiringCount} Expiring</span>
        <span>·</span>
        <span className="font-semibold text-violet-600">৳{(annualValue / 100000).toFixed(1)}L Annual</span>
      </div>

      {/* AMC list */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {mockAMCs.map((amc, i) => {
          const startStr = new Date(amc.start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          const endStr = new Date(amc.end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

          return (
            <motion.button
              key={amc.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.05 } }}
              onClick={() => navigate('amc-detail', amc.id)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-violet-600">{amc.contractId}</span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        statusColors[amc.status]
                      )}
                    >
                      {amc.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1.5">{amc.client}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <span
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full font-medium',
                    coverageColors[amc.coverage]
                  )}
                >
                  {amc.coverage}
                </span>
                <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-medium">
                  {amc.monthlyVisits} visit{amc.monthlyVisits > 1 ? 's' : ''}/mo
                </span>
              </div>

              <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-gray-50">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">{startStr} — {endStr}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}