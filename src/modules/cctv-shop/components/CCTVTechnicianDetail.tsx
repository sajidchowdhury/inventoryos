'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Phone, Wrench, Clock, Star, TrendingUp,
  Award, Loader2, Calendar, DollarSign,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { CCTVTechnician, TechnicianPerformance, CCTVCommissionRecord } from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return '—';
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const JOB_TYPE_LABELS: Record<string, string> = {
  REPAIR: 'Repair', INSTALLATION: 'Install', MAINTENANCE: 'Maint.', DIAGNOSTIC: 'Diag.',
};

export function CCTVTechnicianDetail() {
  const { goBack, contextId } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [tech, setTech] = useState<CCTVTechnician | null>(null);
  const [perf, setPerf] = useState<TechnicianPerformance | null>(null);
  const [commissions, setCommissions] = useState<CCTVCommissionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contextId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [techRes, perfRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/mobile-shop/technicians/${contextId}`),
          fetch(`/api/businesses/${businessId}/mobile-shop/technicians/${contextId}/performance`),
        ]);
        if (techRes.ok && !cancelled) setTech(await techRes.json());
        if (perfRes.ok && !cancelled) setPerf(await perfRes.json());
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [contextId]);

  if (loading) {
    return <div className="p-4 space-y-3"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  }
  if (!tech) {
    return <div className="p-4 text-center text-sm text-gray-400">Technician not found</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
            <User className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{tech.displayName}</h2>
            <div className="flex items-center gap-2">
              {tech.phone && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{tech.phone}</span>}
              {tech.specialization && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-purple-50 text-purple-600">
                  {tech.specialization}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      {perf && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-violet-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Performance</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{perf.completedJobs}<span className="text-xs font-normal text-gray-400">/{perf.totalJobs}</span></p>
              <p className="text-[10px] text-gray-400 mt-0.5">Jobs Done</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-600">{perf.avgTatLabel}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Avg Turnaround</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{formatBDT(perf.totalCommission)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Total Commission</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{perf.avgRating ? `${perf.avgRating}` : '—'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Avg Rating{perf.avgRating ? ' ⭐' : ''}</p>
            </div>
          </div>

          {/* Job Type Breakdown */}
          {Object.keys(perf.jobTypeBreakdown).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Job Types</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(perf.jobTypeBreakdown).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-[10px] px-2 py-0.5">
                    {JOB_TYPE_LABELS[type] || type}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Info placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Commission History</h3>
        </div>
        <p className="text-xs text-gray-400">View detailed commission history in the Commission Report.</p>
      </motion.div>
    </div>
  );
}