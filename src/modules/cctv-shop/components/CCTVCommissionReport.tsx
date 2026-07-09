'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Award, Calendar, ChevronDown, Loader2,
  DollarSign, User,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { CCTVCommissionRecord } from '@/modules/cctv-shop/types';

const BUSINESS_ID = 'bus_placeholder';

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return '—';
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const RULE_LABELS: Record<string, string> = {
  FIXED_PER_TYPE: 'Fixed/Type',
  PERCENT_LABOR: '% Labor',
  PERCENT_PROFIT: '% Profit',
  NONE: 'No Rule',
};

interface TechnicianGroup {
  technician: { id: string; displayName: string };
  records: CCTVCommissionRecord[];
  total: number;
}

interface ReportData {
  month: string;
  records: CCTVCommissionRecord[];
  byTechnician: TechnicianGroup[];
  grandTotal: number;
  availableMonths: string[];
}

export function CCTVCommissionReport() {
  const { goBack } = useCCTVNavStore();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchReport = async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/commissions/report?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
        if (data.availableMonths?.length > 0 && !data.availableMonths.includes(month)) {
          setSelectedMonth(data.availableMonths[0]);
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchReport(selectedMonth);
  }, [selectedMonth]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Award className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Commission Report</h2>
            <p className="text-[10px] text-gray-400">Monthly summary</p>
          </div>
        </div>
      </div>

      {/* Month Picker */}
      {report && report.availableMonths.length > 0 && (
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full h-9 text-sm rounded-xl border border-gray-200 bg-white px-3 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            {report.availableMonths.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </option>
            ))}
          </select>
          <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : !report || report.byTechnician.length === 0 ? (
        <div className="text-center py-12">
          <Award className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No commissions this month</p>
          <p className="text-xs text-gray-300">Commissions are auto-calculated when jobs are delivered</p>
        </div>
      ) : (
        <>
          {/* Grand Total */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-violet-500/20"
          >
            <p className="text-[10px] text-white/70 uppercase tracking-wide font-medium">Total Commissions</p>
            <p className="text-2xl font-bold mt-1">{formatBDT(report.grandTotal)}</p>
            <p className="text-[10px] text-white/60 mt-1">{report.byTechnician.length} technician{report.byTechnician.length > 1 ? 's' : ''} · {report.records.length} job{report.records.length > 1 ? 's' : ''}</p>
          </motion.div>

          {/* By Technician */}
          {report.byTechnician.map((group, idx) => (
            <motion.div
              key={group.technician.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <User className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{group.technician.displayName}</p>
                    <p className="text-[10px] text-gray-400">{group.records.length} job{group.records.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-600">{formatBDT(group.total)}</p>
              </div>

              {/* Individual records */}
              <div className="space-y-1.5">
                {group.records.map((rec) => (
                  <div key={rec.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{rec.jobCard?.jobCode} — {rec.jobCard?.customerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 bg-blue-50 text-blue-600">{rec.jobType}</Badge>
                        <span className="text-[9px] text-gray-400">{RULE_LABELS[rec.ruleType] || rec.ruleType}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700 shrink-0 ml-2">{formatBDT(rec.commissionAmount)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}