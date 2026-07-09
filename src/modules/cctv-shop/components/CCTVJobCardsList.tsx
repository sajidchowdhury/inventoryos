'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Wrench, Calendar, User, ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const filters = ['All', 'Pending', 'In Progress', 'Completed'] as const;

const statusColors: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

const typeIcons: Record<string, string> = {
  Installation: '🔧',
  Maintenance: '🛠️',
  Repair: '⚡',
};

const mockJobCards = [
  { id: 'JC-001', customer: 'Rahim Electronics', type: 'Installation', status: 'In Progress', date: '2025-01-15', tech: 'Karim Uddin' },
  { id: 'JC-002', customer: 'City Shopping Mall', type: 'Installation', status: 'Pending', date: '2025-01-18', tech: 'Unassigned' },
  { id: 'JC-003', customer: 'BD Bank Motijheel', type: 'Maintenance', status: 'In Progress', date: '2025-01-14', tech: 'Hasan Ali' },
  { id: 'JC-004', customer: 'Green Tower Residency', type: 'Repair', status: 'Pending', date: '2025-01-16', tech: 'Unassigned' },
  { id: 'JC-005', customer: 'Metro Hospital', type: 'Installation', status: 'Completed', date: '2025-01-10', tech: 'Karim Uddin' },
  { id: 'JC-006', customer: 'Sunrise School & College', type: 'Maintenance', status: 'Completed', date: '2025-01-08', tech: 'Hasan Ali' },
  { id: 'JC-007', customer: 'Pacific Telecom', type: 'Repair', status: 'In Progress', date: '2025-01-13', tech: 'Rafiq Ahmed' },
  { id: 'JC-008', customer: 'Bashundhara City', type: 'Installation', status: 'Pending', date: '2025-01-20', tech: 'Unassigned' },
];

export function CCTVJobCardsList() {
  const { navigate, goBack } = useCCTVNavStore();
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const filtered = mockJobCards.filter(
    (j) => activeFilter === 'All' || j.status === activeFilter
  );

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Job Cards</h1>
        <span className="text-xs text-gray-400">{mockJobCards.length} jobs</span>
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

      {/* Job card list */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {filtered.map((job, i) => {
          const dateStr = new Date(job.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <motion.button
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
              onClick={() => navigate('job-card-detail', job.id)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-violet-600">{job.id}</span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        statusColors[job.status]
                      )}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1.5">{job.customer}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
              </div>

              <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-50">
                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">
                    {typeIcons[job.type]} {job.type}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">{dateStr}</span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className={cn('text-[11px]', job.tech === 'Unassigned' ? 'text-amber-500' : 'text-gray-500')}>
                    {job.tech}
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No job cards found</p>
        </div>
      )}
    </motion.div>
  );
}