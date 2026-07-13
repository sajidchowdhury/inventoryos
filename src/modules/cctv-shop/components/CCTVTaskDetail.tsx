'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, User, MapPin, FileText, ChevronRight,
  AlertTriangle, CheckCircle2, Circle, Plus, X, Loader2,
  RotateCcw, Ban, Play, CheckCircle, Building2,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type {
  CCTVInstallationTask,
  CCTVTaskChecklist,
  TaskStatus,
  TaskPriority,
} from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ── Badge styles ──
const PRIORITY_STYLES: Record<TaskPriority, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-gray-100 text-gray-600',
  LOW: 'bg-blue-100 text-blue-700',
};

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

// ── Date helpers ──
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function daysOverdue(scheduledDate: string): number {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduled.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - scheduled.getTime()) / 86400000);
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function CCTVTaskDetail() {
  const { navigate, goBack, contextId } = useCCTVNavStore();
  const { toast } = useToast();
  const businessId = useCctvBusinessId();
  const apiBase = `/api/businesses/${businessId}/mobile-shop/installation-tasks`;

  const [task, setTask] = useState<CCTVInstallationTask | null>(null);
  const [loading, setLoading] = useState<boolean | null>(null); // null=initial, true=loading, false=done
  const [statusChanging, setStatusChanging] = useState(false);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  // Inline add item
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // ── Reload task (used after mutations) ──
  const reloadTask = async (taskId: string) => {
    try {
      const res = await fetch(`${apiBase}/${taskId}`);
      if (res.ok) {
        setTask(await res.json());
      }
    } catch { /* silent */ }
  };

  // ── Fetch task on mount ──
  useEffect(() => {
    let cancelled = false;
    if (!contextId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${apiBase}/${contextId}`, { signal: controller.signal });
        if (res.ok && !cancelled) {
          setTask(await res.json());
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [contextId]);

  // ── Change status ──
  const changeStatus = async (newStatus: TaskStatus) => {
    if (!task || statusChanging) return;
    setStatusChanging(true);
    try {
      const res = await fetch(`${apiBase}/${task.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast({
          title: 'Status updated',
          description: `Task marked as ${STATUS_LABELS[newStatus]}`,
        });
        await reloadTask(task.id);
      } else {
        toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setStatusChanging(false);
  };

  // ── Toggle checklist item ──
  const toggleChecklistItem = async (item: CCTVTaskChecklist) => {
    if (togglingItem) return;
    setTogglingItem(item.id);
    try {
      const res = await fetch(`${apiBase}/${task!.id}/checklist/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !item.isCompleted }),
      });
      if (res.ok) {
        await reloadTask(task!.id);
      } else {
        toast({ title: 'Error', description: 'Failed to update checklist', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setTogglingItem(null);
  };

  // ── Add checklist item ──
  const addChecklistItem = async () => {
    if (!task || !newItemText.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const res = await fetch(`${apiBase}/${task.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemText: newItemText.trim() }),
      });
      if (res.ok) {
        setNewItemText('');
        setShowAddItem(false);
        await reloadTask(task.id);
      } else {
        toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setAddingItem(false);
  };

  // ── Computed values ──
  const isOverdue = task?.status === 'OVERDUE';
  const overdueDays = task ? daysOverdue(task.scheduledDate) : 0;
  const checklists = task?.checklists ?? [];
  const totalItems = task?.totalChecklist ?? checklists.length;
  const completedItems = task?.completedChecklist ?? checklists.filter((c) => c.isCompleted).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // ── Loading state ──
  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-gray-200 animate-pulse" />
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3 mt-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3 animate-pulse">
            <div className="h-5 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-48 bg-gray-100 rounded" />
          </div>
          <div className="h-24 bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse" />
        </div>
      </motion.div>
    );
  }

  if (!task) {
    return (
      <motion.div {...fadeUp} className="text-center py-16">
        <p className="text-sm text-gray-400">Task not found</p>
        <button onClick={goBack} className="text-sm text-violet-600 mt-2">Go back</button>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-36">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">{task.taskTitle}</h1>
      </div>

      {/* Status + Priority badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-semibold', STATUS_STYLES[task.status])}>
          {STATUS_LABELS[task.status]}
        </span>
        <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-semibold', PRIORITY_STYLES[task.priority])}>
          {task.priority}
        </span>
      </div>

      {/* Overdue Alert */}
      <AnimatePresence>
        {isOverdue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeOut' as const } }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                {overdueDays} day{overdueDays > 1 ? 's' : ''} overdue
              </p>
              <p className="text-xs text-red-500">Was scheduled for {formatDate(task.scheduledDate)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Info Card */}
      {task.project && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project</h3>
          <button
            onClick={() => navigate('project-detail', task.project!.id)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-violet-600" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold text-gray-900 truncate">{task.project.projectName}</p>
                <p className="text-[11px] text-gray-400 truncate">{task.project.clientName}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
          {(task.project.siteAddress || task.siteAddress) && (
            <div className="flex items-start gap-2 pt-2 border-t border-gray-50">
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500">{task.project.siteAddress || task.siteAddress}</p>
            </div>
          )}
        </div>
      )}

      {/* Scheduling Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scheduling</h3>
        <div className="grid gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Scheduled Date</p>
              <p className="text-sm font-medium text-gray-800">{formatDate(task.scheduledDate)}</p>
            </div>
          </div>
          {task.assignedToName && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Assigned Technician</p>
                <p className="text-sm font-medium text-gray-800">{task.assignedToName}</p>
              </div>
            </div>
          )}
          {task.location && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Location</p>
                <p className="text-sm font-medium text-gray-800">{task.location}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checklist Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Checklist</h3>
          <span className="text-xs font-semibold text-violet-600">{completedItems} of {totalItems} completed</span>
        </div>

        {/* Progress bar */}
        {totalItems > 0 && (
          <div className="space-y-1.5">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' as const }}
                className={cn(
                  'h-full rounded-full',
                  progressPercent === 100
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-violet-500 to-purple-500'
                )}
              />
            </div>
            <p className="text-right text-[10px] text-gray-400 font-medium">{progressPercent}%</p>
          </div>
        )}

        {/* Checklist items */}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {checklists.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No checklist items yet</p>
          )}
          {checklists.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2.5 p-2 rounded-xl transition-colors',
                item.isCompleted ? 'bg-green-50/50' : 'hover:bg-gray-50'
              )}
            >
              <button
                onClick={() => toggleChecklistItem(item)}
                disabled={togglingItem === item.id}
                className="shrink-0"
              >
                {togglingItem === item.id ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : item.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 hover:text-violet-400 transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm transition-all',
                    item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'
                  )}
                >
                  {item.itemText}
                </p>
                {item.completedAt && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Done at {formatTime(item.completedAt)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add item inline */}
        <AnimatePresence>
          {showAddItem ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { duration: 0.2, ease: 'easeOut' as const } }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2"
            >
              <Input
                placeholder="Checklist item..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                autoFocus
                className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 flex-1 text-sm"
              />
              <button
                onClick={addChecklistItem}
                disabled={addingItem || !newItemText.trim()}
                className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 hover:bg-violet-200 transition-colors disabled:opacity-50"
              >
                {addingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setShowAddItem(false); setNewItemText(''); }}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowAddItem(true)}
              className="text-xs text-violet-600 font-medium flex items-center gap-1 hover:text-violet-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          )}
        </AnimatePresence>
      </div>

      {/* Notes Section */}
      {task.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Notes
          </h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.notes}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-40">
        <div className="max-w-[480px] mx-auto flex gap-2">
          {task.status === 'PENDING' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => changeStatus('IN_PROGRESS')}
              disabled={statusChanging}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 disabled:opacity-60"
            >
              {statusChanging && <Loader2 className="w-4 h-4 animate-spin" />}
              <Play className="w-4 h-4" />
              Mark In Progress
            </motion.button>
          )}

          {task.status === 'IN_PROGRESS' && (
            <>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => changeStatus('COMPLETED')}
                disabled={statusChanging}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20 disabled:opacity-60"
              >
                {statusChanging && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => changeStatus('CANCELLED')}
                disabled={statusChanging}
                className="py-3 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                {statusChanging && <Loader2 className="w-4 h-4 animate-spin" />}
                <Ban className="w-4 h-4" />
                Cancel
              </motion.button>
            </>
          )}

          {task.status === 'COMPLETED' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => changeStatus('IN_PROGRESS')}
              disabled={statusChanging}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 disabled:opacity-60"
            >
              {statusChanging && <Loader2 className="w-4 h-4 animate-spin" />}
              <RotateCcw className="w-4 h-4" />
              Reopen
            </motion.button>
          )}

          {task.status === 'PENDING' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => changeStatus('CANCELLED')}
              disabled={statusChanging}
              className="py-3 px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-60"
            >
              {statusChanging && <Loader2 className="w-4 h-4 animate-spin" />}
              <Ban className="w-4 h-4" />
              Cancel
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}