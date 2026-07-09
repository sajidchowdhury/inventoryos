'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, FolderKanban, AlertTriangle,
  BarChart3, Package,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const statusColors: Record<string, string> = {
  Planning: 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Testing: 'bg-amber-100 text-amber-700',
  Handover: 'bg-emerald-100 text-emerald-700',
};

const progressBarColor: Record<string, string> = {
  Planning: 'bg-gray-400',
  'In Progress': 'bg-violet-500',
  Testing: 'bg-amber-500',
  Handover: 'bg-emerald-500',
};

const mockProjects = [
  { id: '1', name: 'City Mall Surveillance', client: 'City Shopping Mall Ltd', status: 'In Progress', totalItems: 48, completedItems: 32, deadline: '2025-02-28' },
  { id: '2', name: 'BD Bank Branch Security', client: 'Bangladesh Bank, Motijheel', status: 'Testing', totalItems: 24, completedItems: 22, deadline: '2025-01-25' },
  { id: '3', name: 'Green Tower Residency CCTV', client: 'Green Tower Housing', status: 'Planning', totalItems: 36, completedItems: 0, deadline: '2025-03-15' },
  { id: '4', name: 'Metro Hospital IP System', client: 'Metro General Hospital', status: 'Handover', totalItems: 16, completedItems: 16, deadline: '2025-01-10' },
  { id: '5', name: 'Sunrise School Campus', client: 'Sunrise School & College', status: 'In Progress', totalItems: 52, completedItems: 18, deadline: '2025-04-01' },
];

export function CCTVProjectsList() {
  const { navigate, goBack } = useCCTVNavStore();

  const activeCount = mockProjects.filter((p) => p.status !== 'Handover').length;
  const nearDeadline = mockProjects.filter((p) => {
    const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 30 && p.status !== 'Handover';
  }).length;

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
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <span className="font-semibold text-violet-600">{activeCount} Active</span>
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

      {/* Project cards */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {mockProjects.map((project, i) => {
          const pct = project.totalItems > 0
            ? Math.round((project.completedItems / project.totalItems) * 100)
            : 0;
          const deadlineStr = new Date(project.deadline).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });

          return (
            <motion.button
              key={project.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.06 } }}
              onClick={() => navigate('project-detail', project.id)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        statusColors[project.status]
                      )}
                    >
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1.5">{project.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{project.client}</p>
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
                    transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', progressBarColor[project.status])}
                  />
                </div>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Completion
                </span>
                <span className="text-[11px] font-medium text-gray-500">{deadlineStr}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}