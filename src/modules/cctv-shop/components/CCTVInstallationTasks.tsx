'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Clock, ChevronRight, AlertTriangle,
  CheckCircle2, Loader2, ClipboardList, MapPin, User,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  CCTVInstallationTask,
  TaskStatus,
  TaskPriority,
} from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ── Priority badge colors ──
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-gray-100 text-gray-600',
  LOW: 'bg-blue-100 text-blue-700',
};

// ── Status badge colors ──
const STATUS_STYLES: Record<TaskStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-violet-100 text-violet-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400 line-through',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  OVERDUE: 'Overdue',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

type FilterTab = 'ALL' | 'TODAY' | 'WEEK' | 'OVERDUE' | 'COMPLETED';

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Today', value: 'TODAY' },
  { label: 'This Week', value: 'WEEK' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Completed', value: 'COMPLETED' },
];

// ── Summary interface ──
interface TaskSummary {
  pending: number;
  inProgress: number;
  overdue: number;
  completedToday: number;
}

// ── Date helpers ──
function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

function isOverdue(task: CCTVInstallationTask): boolean {
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  const scheduled = new Date(task.scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return scheduled < today;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(dateStr)) return 'Today';
  if (isTomorrow(dateStr)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Group type ──
interface TaskGroup {
  label: string;
  tasks: CCTVInstallationTask[];
}

export function CCTVInstallationTasks() {
  const { navigate, goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const [tasks, setTasks] = useState<CCTVInstallationTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary>({ pending: 0, inProgress: 0, overdue: 0, completedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');

  // ── Fetch data ──
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, tasksRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/cctv/installation-tasks/summary`),
          fetch(`/api/businesses/${businessId}/cctv/installation-tasks`),
        ]);
        if (!cancelled) {
          if (summaryRes.ok) {
            const s = await summaryRes.json();
            setSummary({
              pending: s.pending ?? 0,
              inProgress: s.inProgress ?? 0,
              overdue: s.overdue ?? 0,
              completedToday: s.completedToday ?? 0,
            });
          }
          if (tasksRes.ok) {
            const data = await tasksRes.json();
            setTasks(Array.isArray(data) ? data : data.tasks ?? data.data ?? []);
          }
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // ── Filter tasks ──
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      switch (activeFilter) {
        case 'TODAY':
          return isToday(task.scheduledDate) && task.status !== 'CANCELLED';
        case 'WEEK':
          return isThisWeek(task.scheduledDate) && task.status !== 'CANCELLED' && task.status !== 'COMPLETED';
        case 'OVERDUE':
          return isOverdue(task);
        case 'COMPLETED':
          return task.status === 'COMPLETED';
        default:
          return true;
      }
    });
  }, [tasks, activeFilter]);

  // ── Group tasks by date ──
  const groupedTasks = useMemo(() => {
    const groups: TaskGroup[] = [];

    // Overdue group
    const overdueTasks = filteredTasks.filter((t) => isOverdue(t));
    if (overdueTasks.length > 0) {
      groups.push({ label: 'Overdue', tasks: overdueTasks });
    }

    // Today group
    const todayTasks = filteredTasks.filter((t) => !isOverdue(t) && isToday(t.scheduledDate));
    if (todayTasks.length > 0) {
      groups.push({ label: 'Today', tasks: todayTasks });
    }

    // Tomorrow group
    const tomorrowTasks = filteredTasks.filter((t) => !isOverdue(t) && isTomorrow(t.scheduledDate));
    if (tomorrowTasks.length > 0) {
      groups.push({ label: 'Tomorrow', tasks: tomorrowTasks });
    }

    // Upcoming - group remaining by date
    const upcomingTasks = filteredTasks.filter((t) =>
      !isOverdue(t) && !isToday(t.scheduledDate) && !isTomorrow(t.scheduledDate)
    );

    const dateMap = new Map<string, CCTVInstallationTask[]>();
    upcomingTasks.forEach((t) => {
      const key = t.scheduledDate.slice(0, 10);
      if (!dateMap.has(key)) dateMap.set(key, []);
      dateMap.get(key)!.push(t);
    });

    Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, dateTasks]) => {
        groups.push({ label: formatDate(dateKey), tasks: dateTasks });
      });

    return groups;
  }, [filteredTasks]);

  const overdueCount = summary.overdue;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Installation Tasks</h1>
      </div>

      {/* Overdue Alert Banner */}
      <AnimatePresence>
        {overdueCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeOut' as const } }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3"
          >
            <div className="relative">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">
                {overdueCount} Overdue Task{overdueCount > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-500">Tasks past their scheduled date need attention</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Banner */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Pending', value: summary.pending, bg: 'bg-gray-50', color: 'text-gray-600', border: 'border-gray-100' },
          { label: 'In Progress', value: summary.inProgress, bg: 'bg-violet-50', color: 'text-violet-600', border: 'border-violet-100' },
          { label: 'Overdue', value: summary.overdue, bg: 'bg-red-50', color: 'text-red-600', border: 'border-red-100', pulse: summary.overdue > 0 },
          { label: 'Done Today', value: summary.completedToday, bg: 'bg-green-50', color: 'text-green-600', border: 'border-green-100' },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              'bg-white rounded-2xl border p-3 shadow-sm text-center relative',
              s.border
            )}
          >
            {s.pulse && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
            <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTER_TABS.map((tab) => (
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
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-4 max-h-[calc(100vh-360px)] overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">No tasks found</p>
            <p className="text-xs text-gray-300 mt-1">
              {activeFilter === 'ALL'
                ? 'Create a new installation task to get started'
                : `No ${activeFilter.toLowerCase()} tasks to show`}
            </p>
          </div>
        ) : (
          groupedTasks.map((group) => (
            <div key={group.label} className="space-y-2">
              {/* Group header */}
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                {group.label}
              </h3>
              {group.tasks.map((task, i) => (
                <motion.button
                  key={task.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03, ease: 'easeOut' as const } }}
                  onClick={() => navigate('task-detail', task.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', PRIORITY_STYLES[task.priority])}>
                      {task.priority}
                    </span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', STATUS_STYLES[task.status])}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-semibold text-gray-900 mt-2 truncate">{task.taskTitle}</p>

                  {/* Project + Client */}
                  {task.project && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {task.project.projectName}
                      {task.project.clientName ? ` · ${task.project.clientName}` : ''}
                    </p>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-500">{formatShortDate(task.scheduledDate)}</span>
                  </div>

                  {/* Technician + Location row */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50">
                    {task.assignedToName && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-[11px] text-gray-500 truncate">{task.assignedToName}</span>
                      </div>
                    )}
                    {task.location && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-[11px] text-gray-500 truncate">{task.location}</span>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 ml-auto" />
                  </div>

                  {/* Checklist progress */}
                  {task.totalChecklist > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400">
                          {task.completedChecklist}/{task.totalChecklist} done
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {task.totalChecklist > 0 ? Math.round((task.completedChecklist / task.totalChecklist) * 100) : 0}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${task.totalChecklist > 0 ? (task.completedChecklist / task.totalChecklist) * 100 : 0}%`,
                          }}
                          transition={{ duration: 0.5, ease: 'easeOut' as const }}
                          className={cn(
                            'h-full rounded-full',
                            task.completedChecklist === task.totalChecklist
                              ? 'bg-green-500'
                              : task.status === 'OVERDUE'
                                ? 'bg-red-500'
                                : 'bg-gradient-to-r from-violet-500 to-purple-500'
                          )}
                        />
                      </div>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* FAB Button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => navigate('create-task')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 z-50"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </motion.div>
  );
}