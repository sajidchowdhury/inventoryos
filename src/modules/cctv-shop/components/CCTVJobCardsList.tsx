'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Search, Wrench, Calendar, User, ChevronRight,
  ClipboardList, Clock, PackageCheck, AlertTriangle,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { CCTVJobCard, JobCardStatus } from '@/modules/cctv-shop/types';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Diagnosing', value: 'DIAGNOSING' },
  { label: 'Awaiting', value: 'AWAITING_PARTS' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Testing', value: 'TESTING' },
  { label: 'Ready', value: 'READY_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Outsourced', value: 'OUTSOURCED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-slate-100 text-slate-700',
  DIAGNOSING: 'bg-blue-100 text-blue-700',
  AWAITING_PARTS: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-violet-100 text-violet-700',
  TESTING: 'bg-cyan-100 text-cyan-700',
  READY_FOR_DELIVERY: 'bg-emerald-100 text-emerald-700',
  DELIVERED: 'bg-green-100 text-green-700',
  OUTSOURCED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const TYPE_ICONS: Record<string, string> = {
  REPAIR: '⚡', INSTALLATION: '🔧', MAINTENANCE: '🛠️', DIAGNOSTIC: '🔬',
};

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500', HIGH: 'bg-amber-500', NORMAL: 'bg-gray-300', LOW: 'bg-gray-200',
};

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CCTVJobCardsList() {
  const { navigate, goBack } = useCCTVNavStore();
  const [jobs, setJobs] = useState<CCTVJobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeFilter) params.set('status', activeFilter);
        if (search) params.set('search', search);
        const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/job-cards?${params}`);
        if (res.ok && !cancelled) setJobs(await res.json());
      } catch {}
      if (!cancelled) setLoading(false);
    };
    fetchJobs();
    return () => { cancelled = true; };
  }, [activeFilter, search]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Tab counts
  const tabCounts = STATUS_TABS.reduce<Record<string, number>>((acc, tab) => {
    if (!tab.value) { acc[''] = jobs.length; return acc; }
    acc[tab.value] = jobs.filter((j) => j.status === tab.value).length;
    return acc;
  }, {});

  const active = jobs.filter((j) => !['DELIVERED', 'CANCELLED'].includes(j.status)).length;
  const ready = jobs.filter((j) => j.status === 'READY_FOR_DELIVERY').length;
  const now = new Date();
  const deliveredThisMonth = jobs.filter((j) => {
    if (j.status !== 'DELIVERED' || !j.deliveredAt) return false;
    const d = new Date(j.deliveredAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Job Cards</h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('create-job-card')}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active', value: active, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Ready', value: ready, icon: PackageCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Delivered', value: deliveredThisMonth, icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <s.icon className={cn('w-4 h-4', s.color)} />
            <p className={cn('text-xl font-bold mt-1', s.color)}>{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search jobs, customers, devices..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === tab.value
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {tab.label} {tabCounts[tab.value] > 0 && `(${tabCounts[tab.value]})`}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="space-y-2.5 max-h-[calc(100vh-340px)] overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="text-center py-10">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No job cards found</p>
          </div>
        ) : (
          jobs.map((job, i) => (
            <motion.button
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03 } }}
              onClick={() => navigate('job-card-detail', job.id)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-violet-600">{job.jobCode}</span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', STATUS_COLORS[job.status])}>
                      {job.status.replace(/_/g, ' ')}
                    </span>
                    {job.priority === 'URGENT' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">URGENT</span>
                    )}
                    {job.priority === 'HIGH' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">HIGH</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">{job.customerName}</p>
                  {job.deviceName && <p className="text-xs text-gray-500 truncate mt-0.5">{TYPE_ICONS[job.jobType] || '📦'} {job.deviceName}</p>}
                  {job.reportedFault && <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{job.reportedFault}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
              </div>

              <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-50">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">{relativeDate(job.receivedAt)}</span>
                </div>
                {job.assignedToName ? (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-500">{job.assignedToName}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-amber-500 font-medium">Unassigned</span>
                )}
                {job.estimatedCost != null && job.estimatedCost > 0 && (
                  <span className="text-[11px] text-gray-500 ml-auto">৳{job.estimatedCost.toLocaleString()}</span>
                )}
              </div>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}