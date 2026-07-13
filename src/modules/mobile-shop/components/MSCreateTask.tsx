'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, X, Plus, ChevronDown,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { TaskPriority, MSInstallationTask, MSProject } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ── Priority options ──
const PRIORITIES: { value: TaskPriority; label: string; color: string; activeColor: string }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-50 text-gray-500 border-gray-200', activeColor: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-gray-50 text-gray-500 border-gray-200', activeColor: 'bg-gray-200 text-gray-800 border-gray-400' },
  { value: 'HIGH', label: 'High', color: 'bg-gray-50 text-gray-500 border-gray-200', activeColor: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-gray-50 text-gray-500 border-gray-200', activeColor: 'bg-red-100 text-red-700 border-red-300' },
];

// ── Quick-add checklist chips ──
const QUICK_ADD_ITEMS = [
  'Mount cameras',
  'Run cables',
  'Configure NVR/DVR',
  'Test all camera feeds',
  'Train client on system',
  'Clean up site',
];

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-3">
      {title}
    </h3>
  );
}

export function MSCreateTask() {
  const { navigate, goBack, contextId } = useMSNavStore();
  const businessId = useMSBusinessId();
  const { toast } = useToast();
  const isEditing = !!contextId;

  // ── Form state ──
  const [projectId, setProjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [assignedToName, setAssignedToName] = useState('');
  const [location, setLocation] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Projects for dropdown ──
  const [projects, setProjects] = useState<MSProject[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectName, setSelectedProjectName] = useState('');

  // ── Fetch projects for dropdown ──
  // Exclude CANCELLED and COMPLETED — show all active projects regardless of status
  useEffect(() => {
    let cancelled = false;
    const fetchProjects = async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/projects`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list: MSProject[] = (Array.isArray(data) ? data : data.projects ?? data.data ?? []);
          // Filter out completed/cancelled on client side
          setProjects(list.filter((p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'));
        }
      } catch { /* silent */ }
    };
    fetchProjects();
    return () => { cancelled = true; };
  }, [businessId]);

  // ── Fetch existing task if editing, or pre-select project if contextId is a project ──
  useEffect(() => {
    if (!contextId) return;
    let cancelled = false;
    const fetchTask = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/installation-tasks/${contextId}`);
        if (res.ok && !cancelled) {
          const task: MSInstallationTask = await res.json();
          setProjectId(task.projectId);
          setTaskTitle(task.taskTitle);
          setScheduledDate(task.scheduledDate.slice(0, 10));
          setPriority(task.priority);
          setAssignedToName(task.assignedToName ?? '');
          setLocation(task.location ?? '');
          setSiteAddress(task.siteAddress ?? '');
          setNotes(task.notes ?? '');
          setInternalNotes(task.internalNotes ?? '');
          if (task.project) {
            setSelectedProjectName(task.project.projectName);
          }
          if (task.checklists && task.checklists.length > 0) {
            setChecklistItems(task.checklists.map((c) => c.itemText));
          }
        } else {
          // contextId is not a task ID — treat it as a pre-selected projectId
          setProjectId(contextId);
          const pMatch = projects.find((p) => p.id === contextId);
          if (pMatch) setSelectedProjectName(pMatch.projectName);
        }
      } catch {
        // On error, treat as pre-selected projectId
        setProjectId(contextId);
        const pMatch = projects.find((p) => p.id === contextId);
        if (pMatch) setSelectedProjectName(pMatch.projectName);
      }
      if (!cancelled) setLoading(false);
    };
    // Delay slightly so projects list may be available
    const t = setTimeout(fetchTask, 100);
    return () => { cancelled = true; clearTimeout(t); };
  }, [contextId, projects]);

  // ── Filter projects by search ──
  const filteredProjects = projects.filter(
    (p) =>
      p.projectName.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.clientName.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // ── Checklist handlers ──
  const addChecklistItem = (text: string) => {
    const trimmed = text.trim();
    if (trimmed && !checklistItems.includes(trimmed)) {
      setChecklistItems([...checklistItems, trimmed]);
    }
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  // ── Validation ──
  const canSubmit = projectId && taskTitle.trim() && scheduledDate && !submitting;

  // ── Show validation toast ──
  const handleTrySubmit = () => {
    if (!projectId) {
      toast({ title: 'Project required', description: 'Please select a project to create a task.', variant: 'destructive' });
      return;
    }
    if (!taskTitle.trim()) {
      toast({ title: 'Title required', description: 'Please enter a task title.', variant: 'destructive' });
      return;
    }
    if (!scheduledDate) {
      toast({ title: 'Date required', description: 'Please select a scheduled date.', variant: 'destructive' });
      return;
    }
    handleSubmit();
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body = {
        projectId,
        taskTitle: taskTitle.trim(),
        scheduledDate,
        priority,
        assignedToName: assignedToName.trim() || undefined,
        location: location.trim() || undefined,
        siteAddress: siteAddress.trim() || undefined,
        checklistItems,
        notes: notes.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
      };

      const url = isEditing ? `/api/businesses/${businessId}/mobile-shop/installation-tasks/${contextId}` : `/api/businesses/${businessId}/mobile-shop/installation-tasks`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: isEditing ? 'Task updated' : 'Task created', description: 'Installation task saved successfully.' });
        navigate('installation-tasks');
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Error', description: err.error || 'Failed to save task', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-gray-200" />
          <div className="h-5 w-32 bg-gray-200 rounded" />
        </div>
        <div className="space-y-4 mt-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div {...fadeUp} className="space-y-1 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {isEditing ? 'Edit Task' : 'New Task'}
        </h1>
      </div>

      {/* Project Selector */}
      <SectionHeader title="Project *" />

      {/* No projects at all — show create CTA */}
      {projects.length === 0 && !selectedProjectName && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs font-semibold text-amber-800">No projects found</p>
          <p className="text-[11px] text-amber-600">Create a project first, then come back to add tasks.</p>
          <button
            onClick={() => navigate('create-project')}
            className="px-4 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" /> Create Project
          </button>
        </div>
      )}

      {/* Selected project display */}
      {selectedProjectName && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <span className="text-sm">📁</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800 truncate">{selectedProjectName}</p>
          </div>
          <button
            onClick={() => { setProjectId(''); setSelectedProjectName(''); }}
            className="w-6 h-6 rounded-full bg-violet-200 flex items-center justify-center"
          >
            <X className="w-3 h-3 text-violet-600" />
          </button>
        </div>
      )}

      {/* Project dropdown */}
      {!selectedProjectName && (
        <div className="relative">
          <div className="relative">
            <Input
              placeholder="Search project or client..."
              value={projectSearch}
              onChange={(e) => {
                setProjectSearch(e.target.value);
                setShowProjectDropdown(true);
              }}
              onFocus={() => setShowProjectDropdown(true)}
              className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 pr-10"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>

          {showProjectDropdown && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filteredProjects.length > 0 ? (
                filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProjectId(p.id);
                      setSelectedProjectName(p.projectName);
                      setShowProjectDropdown(false);
                      setProjectSearch('');
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.projectName}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium shrink-0">
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{p.clientName}{p.projectCode ? ` · ${p.projectCode}` : ''}</p>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-400">No projects found</p>
                  <button
                    onClick={() => navigate('create-project')}
                    className="mt-2 text-xs font-semibold text-violet-600"
                  >
                    + Create a project first
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Task Title */}
      <SectionHeader title="Task Title *" />
      <Input
        placeholder="e.g., Install 8 IP cameras at warehouse"
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
      />

      {/* Scheduled Date */}
      <SectionHeader title="Scheduled Date *" />
      <Input
        type="date"
        value={scheduledDate}
        onChange={(e) => setScheduledDate(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
      />

      {/* Priority */}
      <SectionHeader title="Priority" />
      <div className="grid grid-cols-4 gap-2">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            onClick={() => setPriority(p.value)}
            className={cn(
              'px-2 py-2 rounded-xl text-[11px] font-semibold border transition-all',
              priority === p.value ? p.activeColor : p.color
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Assign Technician */}
      <SectionHeader title="Assign Technician" />
      <Input
        placeholder="Technician name"
        value={assignedToName}
        onChange={(e) => setAssignedToName(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
      />

      {/* Location */}
      <SectionHeader title="Location" />
      <Input
        placeholder="e.g., Building A, Floor 3"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
      />

      {/* Site Address */}
      <SectionHeader title="Site Address" />
      <Input
        placeholder="Full site address"
        value={siteAddress}
        onChange={(e) => setSiteAddress(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
      />

      {/* Checklist Items */}
      <SectionHeader title="Checklist Items" />

      {/* Quick-add chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ADD_ITEMS.filter((chip) => !checklistItems.includes(chip)).map((chip) => (
          <button
            key={chip}
            onClick={() => addChecklistItem(chip)}
            className="text-[10px] px-2 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100 transition-colors"
          >
            + {chip}
          </button>
        ))}
      </div>

      {/* Current checklist items */}
      {checklistItems.length > 0 && (
        <div className="mt-3 space-y-2">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
            >
              <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <span className="text-sm text-gray-700 flex-1 truncate">{item}</span>
              <button
                onClick={() => removeChecklistItem(idx)}
                className="w-5 h-5 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add custom checklist item */}
      <div className="flex gap-2 mt-2">
        <Input
          placeholder="Add custom item..."
          value={newChecklistItem}
          onChange={(e) => setNewChecklistItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addChecklistItem(newChecklistItem);
              setNewChecklistItem('');
            }
          }}
          className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 flex-1"
        />
        <button
          onClick={() => {
            addChecklistItem(newChecklistItem);
            setNewChecklistItem('');
          }}
          className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 hover:bg-violet-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Notes */}
      <SectionHeader title="Notes" />
      <Textarea
        placeholder="Any additional notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 min-h-[80px] resize-none"
        rows={3}
      />

      {/* Internal Notes */}
      <SectionHeader title="Internal Only" />
      <Textarea
        placeholder="Internal notes (not visible to client)..."
        value={internalNotes}
        onChange={(e) => setInternalNotes(e.target.value)}
        className="bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 min-h-[80px] resize-none"
        rows={3}
      />

      {/* Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-40">
        <div className="max-w-[480px] mx-auto">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleTrySubmit}
            disabled={submitting}
            className={cn(
              'w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
              canSubmit
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Update Task' : 'Create Task'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}