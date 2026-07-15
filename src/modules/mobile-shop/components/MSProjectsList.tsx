'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, AlertTriangle,
  BarChart3, Package, Plus, Search, Filter,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import type { MSProject, ProjectStatus } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const statusConfig: Record<ProjectStatus, { label: string; bg: string; text: string; bar: string }> = {
  PLANNING:     { label: 'Planning',     bg: 'bg-gray-100',  text: 'text-gray-600', bar: 'bg-gray-400' },
  SURVEY:       { label: 'Survey',       bg: 'bg-cyan-100',  text: 'text-cyan-700', bar: 'bg-cyan-500' },
  PROCUREMENT:  { label: 'Procurement',  bg: 'bg-blue-100',  text: 'text-blue-700', bar: 'bg-blue-500' },
  INSTALLATION: { label: 'Installation', bg: 'bg-cyan-100', text: 'text-cyan-700', bar: 'bg-cyan-500' },
  TESTING:      { label: 'Testing',      bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  HANDOVER:     { label: 'Handover',     bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  COMPLETED:    { label: 'Completed',    bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  CANCELLED:    { label: 'Cancelled',    bg: 'bg-red-100',   text: 'text-red-600',   bar: 'bg-red-400' },
};

const statusTabs: { key: ProjectStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PLANNING', label: 'Planning' },
  { key: 'SURVEY', label: 'Survey' },
  { key: 'INSTALLATION', label: 'Install' },
  { key: 'TESTING', label: 'Testing' },
  { key: 'HANDOVER', label: 'Handover' },
  { key: 'COMPLETED', label: 'Done' },
];

export function MSProjectsList() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();
  const [projects, setProjects] = useState<MSProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ProjectStatus | 'ALL'>('ALL');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.set('status', activeTab);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/projects?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [activeTab, search]);

  useEffect(() => {
    const timer = setTimeout(fetchProjects, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchProjects, search]);

  const activeCount = projects.filter((p) => !['COMPLETED', 'CANCELLED'].includes(p.status)).length;
  const nearDeadline = projects.filter((p) => {
    if (!p.deadline || ['COMPLETED', 'CANCELLED'].includes(p.status)) return false;
    const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 30;
  }).length;
  const totalValue = projects.reduce((sum, p) => sum + (p.projectValue || 0), 0);

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Projects</h1>
        <button
          onClick={() => navigate('create-project')}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 text-xs text-gray-500 px-1">
        <span className="font-semibold text-cyan-600">{activeCount} Active</span>
        <span>·</span>
        <span>৳{totalValue.toLocaleString()}</span>
        {nearDeadline > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {nearDeadline} Near Deadline
            </span>
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-300 shadow-sm"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
              activeTab === tab.key
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-100',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Project cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-2 bg-gray-100 rounded-full w-full" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-100 flex items-center justify-center mb-3">
            <BarChart3 className="w-7 h-7 text-cyan-400" />
          </div>
          <p className="text-sm font-semibold text-gray-800">No Projects</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
            {search || activeTab !== 'ALL'
              ? 'Try adjusting your filters'
              : 'Create your first CCTV project'}
          </p>
          {!search && activeTab === 'ALL' && (
            <button
              onClick={() => navigate('create-project')}
              className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {projects.map((project, i) => {
            const cfg = statusConfig[project.status] || statusConfig.PLANNING;
            const pct = project.totalItems > 0
              ? Math.round((project.completedItems / project.totalItems) * 100)
              : 0;
            const deadlineStr = project.deadline
              ? new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '';

            return (
              <motion.button
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.05 } }}
                onClick={() => navigate('project-detail', project.id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-gray-400 bg-gray-50 font-mono">
                        {project.projectCode}
                      </span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1.5">{project.projectName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{project.clientName}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {project.completedItems}/{project.totalItems} items
                    </span>
                    <span className="text-xs font-bold text-gray-700">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', cfg.bar)}
                    />
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    ৳{(project.projectValue || 0).toLocaleString()}
                  </span>
                  {deadlineStr && (
                    <span className={cn(
                      'text-[11px] font-medium',
                      nearDeadline > 0 && !['COMPLETED', 'CANCELLED'].includes(project.status)
                        ? 'text-amber-600' : 'text-gray-500',
                    )}>
                      {deadlineStr}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}