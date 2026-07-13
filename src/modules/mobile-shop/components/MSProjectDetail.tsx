'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronRight, Calendar, MapPin, User, Phone,
  Mail, Package, DollarSign, FileText, Camera, Cable,
  Plus, Trash2, Save, Edit3, X, Check, Image as ImageIcon,
  Eye, EyeOff, AlertTriangle, ClipboardList, CheckCircle2,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import type {
  MSProject, MSSiteSurvey, MSCameraPosition, MSCableRoute,
  ProjectStatus, ProjectType, CameraType, CableType,
  MSInstallationTask as TaskType,
} from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const statusConfig: Record<ProjectStatus, { label: string; bg: string; text: string; bar: string }> = {
  PLANNING:     { label: 'Planning',     bg: 'bg-gray-100',  text: 'text-gray-600', bar: 'bg-gray-400' },
  SURVEY:       { label: 'Survey',       bg: 'bg-cyan-100',  text: 'text-cyan-700', bar: 'bg-cyan-500' },
  PROCUREMENT:  { label: 'Procurement',  bg: 'bg-blue-100',  text: 'text-blue-700', bar: 'bg-blue-500' },
  INSTALLATION: { label: 'Installation', bg: 'bg-violet-100', text: 'text-violet-700', bar: 'bg-violet-500' },
  TESTING:      { label: 'Testing',      bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  HANDOVER:     { label: 'Handover',     bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  COMPLETED:    { label: 'Completed',    bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  CANCELLED:    { label: 'Cancelled',    bg: 'bg-red-100',   text: 'text-red-600',   bar: 'bg-red-400' },
};

const statusOptions: ProjectStatus[] = ['PLANNING', 'SURVEY', 'PROCUREMENT', 'INSTALLATION', 'TESTING', 'HANDOVER', 'COMPLETED', 'CANCELLED'];
const cameraTypes: CameraType[] = ['Bullet', 'Dome', 'PTZ', 'Box', 'Turret'];
const cableTypes: CableType[] = ['Cat5e', 'Cat6', 'Coaxial', 'Fiber'];

// ─── Types for local editing ───
interface Point { x: number; y: number }

// ─── Inline: Tasks Tab for Project Detail ───

function ProjectTasksTab({ projectId, navigate }: { projectId: string; navigate: (v: 'create-task' | 'task-detail', id?: string) => void }) {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/installation-tasks/by-project/${projectId}`);
        if (res.ok) setTasks(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [projectId]);

  const statusColors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-600',
    IN_PROGRESS: 'bg-violet-100 text-violet-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    OVERDUE: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-400 line-through',
  };
  const priorityColors: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    NORMAL: 'bg-gray-100 text-gray-600',
    LOW: 'bg-blue-100 text-blue-600',
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-50 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Create task CTA */}
      <button
        onClick={() => navigate('create-task', projectId)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm text-left active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-900">Create Installation Task</p>
          <p className="text-[10px] text-gray-400">Add a task with checklist for this project</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </button>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-gray-800">No Tasks Yet</p>
          <p className="text-[10px] text-gray-400 mt-1">Create tasks to schedule installation work</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto">
          {tasks.map((task) => {
            const pct = task.totalChecklist > 0 ? Math.round((task.completedChecklist / task.totalChecklist) * 100) : 0;
            return (
              <button
                key={task.id}
                onClick={() => navigate('task-detail', task.id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', priorityColors[task.priority] || priorityColors.NORMAL)}>
                        {task.priority}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold', statusColors[task.status] || '')}>
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">{task.taskTitle}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                  {task.assignedToName && (
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignedToName}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(task.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>

                {task.totalChecklist > 0 && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400">{task.completedChecklist}/{task.totalChecklist} done</span>
                      <span className="text-[10px] font-semibold text-violet-600">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type TabKey = 'overview' | 'survey' | 'equipment' | 'tasks';

// ─── Workflow step indicator ───
const WORKFLOW_STEPS = [
  { key: 'overview', label: 'Project' },
  { key: 'survey', label: 'Survey' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'tasks', label: 'Complete' },
] as const;

function getWorkflowStepIndex(project: MSProject | null): number {
  if (!project) return 0;
  const statusOrder: Record<string, number> = {
    PLANNING: 0, SURVEY: 1, PROCUREMENT: 2, INSTALLATION: 2, TESTING: 3, HANDOVER: 3, COMPLETED: 3, CANCELLED: -1,
  };
  return statusOrder[project.status] ?? 0;
}

export function MSProjectDetail() {
  const { goBack, contextId, navigate } = useMSNavStore();
  const businessId = useMSBusinessId();
  const apiBase = `/api/businesses/${businessId}/mobile-shop/projects`;
  const projectId = contextId;

  const [project, setProject] = useState<MSProject | null>(null);
  const [surveys, setSurveys] = useState<MSSiteSurvey[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  // Survey editor state
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [surveyNote, setSurveyNote] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [floorPlanData, setFloorPlanData] = useState<string | null>(null);
  const [floorPlanName, setFloorPlanName] = useState<string>('');
  const [cameras, setCameras] = useState<MSCameraPosition[]>([]);
  const [cableRoutes, setCableRoutes] = useState<MSCableRoute[]>([]);

  // Drawing state
  const [mode, setMode] = useState<'view' | 'place-camera' | 'draw-cable'>('view');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const floorPlanRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera dialog
  const [cameraDialog, setCameraDialog] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const [camForm, setCamForm] = useState({ label: '', cameraType: 'Bullet' as CameraType, resolution: '4MP', notes: '' });

  // Cable dialog
  const [cableDialog, setCableDialog] = useState(false);
  const [cableForm, setCableForm] = useState({ label: '', cableType: 'Cat6' as CableType, cableLength: '', notes: '' });

  // Status change
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [surveyJustCreated, setSurveyJustCreated] = useState(false);

  const loadSurvey = (s: MSSiteSurvey) => {
    setActiveSurveyId(s.id);
    setFloorPlanData(s.floorPlanData || null);
    setFloorPlanName(s.floorPlanName || '');
    setSurveyorName(s.surveyorName || '');
    setSurveyNote(s.notes || '');
    setCameras(s.cameraPositions || []);
    setCableRoutes(s.cableRoutes || []);
    setMode('view');
    setDrawingPoints([]);
  };

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projRes, survRes] = await Promise.all([
        fetch(`${apiBase}/${projectId}`),
        fetch(`${apiBase}/${projectId}/surveys`),
      ]);
      if (projRes.ok) {
        const p = await projRes.json();
        setProject(p);
      }
      if (survRes.ok) {
        const s = await survRes.json();
        setSurveys(s);
        // Auto-select first survey if none active
        setActiveSurveyId((prev) => prev || s?.[0]?.id || null);
        // Pre-populate editor state from first survey
        if (s?.[0] && !activeSurveyId) {
          setFloorPlanData(s[0].floorPlanData || null);
          setFloorPlanName(s[0].floorPlanName || '');
          setSurveyorName(s[0].surveyorName || '');
          setSurveyNote(s[0].notes || '');
          setCameras(s[0].cameraPositions || []);
          setCableRoutes(s[0].cableRoutes || []);
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [projectId, activeSurveyId, apiBase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await fetchProject();
    };
    load();
    return () => { cancelled = true; };
  }, [fetchProject]);

  // ─── Floor plan upload ───
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFloorPlanName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFloorPlanData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ─── Floor plan click handler ───
  const handleFloorPlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (mode === 'place-camera') {
      setCameraDialog({ open: true, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
      setMode('view');
    } else if (mode === 'draw-cable') {
      setDrawingPoints((prev) => [...prev, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }]);
    }
  };

  const handleFinishCable = () => {
    if (drawingPoints.length < 2) {
      setDrawingPoints([]);
      setMode('view');
      return;
    }
    setCableDialog(true);
  };

  // ─── Save camera position ───
  const saveCamera = async () => {
    if (!activeSurveyId || !cameraDialog.open) return;
    const cam: Record<string, unknown> = {
      posX: cameraDialog.x,
      posY: cameraDialog.y,
      label: camForm.label || `Camera ${cameras.length + 1}`,
      cameraType: camForm.cameraType,
      resolution: camForm.resolution,
      notes: camForm.notes || undefined,
      sortOrder: cameras.length,
    };
    const res = await fetch(`${apiBase}/${projectId}/surveys/${activeSurveyId}/camera-positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cam),
    });
    if (res.ok) {
      const saved = await res.json();
      setCameras((prev) => [...prev, saved]);
      setCamForm({ label: '', cameraType: 'Bullet', resolution: '4MP', notes: '' });
    }
    setCameraDialog({ open: false, x: 0, y: 0 });
  };

  const deleteCamera = async (camId: string) => {
    if (!activeSurveyId) return;
    await fetch(`${apiBase}/${projectId}/surveys/${activeSurveyId}/camera-positions?id=${camId}`, { method: 'DELETE' });
    setCameras((prev) => prev.filter((c) => c.id !== camId));
  };

  // ─── Save cable route ───
  const saveCableRoute = async () => {
    if (!activeSurveyId || drawingPoints.length < 2) return;
    const route: Record<string, unknown> = {
      label: cableForm.label || `Route ${cableRoutes.length + 1}`,
      points: JSON.stringify(drawingPoints),
      cableType: cableForm.cableType,
      cableLength: cableForm.cableLength ? parseFloat(cableForm.cableLength) : undefined,
      notes: cableForm.notes || undefined,
      sortOrder: cableRoutes.length,
    };
    const res = await fetch(`${apiBase}/${projectId}/surveys/${activeSurveyId}/cable-routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    if (res.ok) {
      const saved = await res.json();
      setCableRoutes((prev) => [...prev, saved]);
    }
    setCableForm({ label: '', cableType: 'Cat6', cableLength: '', notes: '' });
    setDrawingPoints([]);
    setCableDialog(false);
    setMode('view');
  };

  const deleteCableRoute = async (routeId: string) => {
    if (!activeSurveyId) return;
    await fetch(`${apiBase}/${projectId}/surveys/${activeSurveyId}/cable-routes?id=${routeId}`, { method: 'DELETE' });
    setCableRoutes((prev) => prev.filter((r) => r.id !== routeId));
  };

  // ─── Create survey ───
  const createSurvey = async () => {
    if (!projectId) return;
    const res = await fetch(`${apiBase}/${projectId}/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const s = await res.json();
      setSurveys((prev) => [s, ...prev]);
      loadSurvey(s);
      setSurveyJustCreated(true);
      // Auto-dismiss after 8 seconds
      setTimeout(() => setSurveyJustCreated(false), 8000);
      // Auto-advance project status to SURVEY if still PLANNING
      if (project?.status === 'PLANNING') {
        changeStatus('SURVEY');
      }
    }
  };

  // ─── Save survey metadata ───
  const saveSurveyMeta = async () => {
    if (!activeSurveyId || !projectId) return;
    const res = await fetch(`${apiBase}/${projectId}/surveys/${activeSurveyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floorPlanData: floorPlanData || undefined,
        floorPlanName: floorPlanName || undefined,
        surveyorName: surveyorName || undefined,
        notes: surveyNote || undefined,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSurveys((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    }
  };

  // ─── Status change ───
  const changeStatus = async (newStatus: ProjectStatus) => {
    if (!projectId || !project) return;
    const res = await fetch(`${apiBase}/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
    }
    setShowStatusPicker(false);
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-5 bg-gray-100 rounded w-1/2 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-gray-500">Project not found</p>
        <button onClick={goBack} className="mt-3 text-xs text-violet-600 font-semibold">Go Back</button>
      </div>
    );
  }

  const cfg = statusConfig[project.status] || statusConfig.PLANNING;
  const pct = project.totalItems > 0 ? Math.round((project.completedItems / project.totalItems) * 100) : 0;

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const tabItems: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: 'overview', label: 'Overview', icon: FileText },
    { key: 'survey', label: 'Site Survey', icon: Camera },
    { key: 'equipment', label: 'Equipment', icon: Package },
    { key: 'tasks', label: 'Tasks', icon: ClipboardList },
  ];

  // Camera icon by type
  const getCameraIcon = (type: CameraType) => {
    switch (type) {
      case 'Dome': return '🔳';
      case 'PTZ': return '🎯';
      case 'Box': return '📦';
      case 'Turret': return '🔘';
      default: return '📷';
    }
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-400 font-mono">{project.projectCode}</p>
          <h1 className="text-sm font-bold text-gray-900 truncate">{project.projectName}</h1>
        </div>
      </div>

      {/* Status + Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowStatusPicker(true)}
            className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold', cfg.bg, cfg.text)}
          >
            {cfg.label}
          </button>
          <span className="text-xs font-bold text-gray-700">{pct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={cn('h-full rounded-full', cfg.bar)} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
          <span>{project.completedItems}/{project.totalItems} items</span>
          <span>৳{(project.projectValue || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Workflow Step Progress Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-100" />
          {/* Active line */}
          {(() => {
            const stepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === activeTab);
            const workflowIdx = getWorkflowStepIndex(project);
            const activeLine = Math.max(stepIdx, workflowIdx);
            if (activeLine > 0) {
              return (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(activeLine / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute top-4 left-6 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500"
                />
              );
            }
            return null;
          })()}
          {WORKFLOW_STEPS.map((step, idx) => {
            const stepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === activeTab);
            const workflowIdx = getWorkflowStepIndex(project);
            const isActive = step.key === activeTab;
            const isCompleted = workflowIdx > idx || (workflowIdx >= idx && stepIdx > idx);
            const isClickable = idx <= workflowIdx + 1;
            return (
              <button
                key={step.key}
                onClick={() => isClickable && setActiveTab(step.key as TabKey)}
                disabled={!isClickable}
                className={cn(
                  'relative z-10 flex flex-col items-center gap-1.5 transition-all',
                  isClickable ? 'cursor-pointer' : 'cursor-default opacity-40',
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                  isActive
                    ? 'bg-violet-500 border-violet-500 text-white shadow-lg shadow-violet-500/30'
                    : isCompleted
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-600'
                    : 'bg-white border-gray-200 text-gray-400',
                )}>
                  {isCompleted && !isActive ? <Check className="w-3.5 h-3.5" /> : <span>{idx + 1}</span>}
                </div>
                <span className={cn(
                  'text-[10px] font-semibold whitespace-nowrap',
                  isActive ? 'text-violet-700' : isCompleted ? 'text-emerald-600' : 'text-gray-400',
                )}>
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                activeTab === tab.key
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      {activeTab === 'overview' && (
        <motion.div {...fadeUp} className="space-y-3">
          {/* Client Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Client</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-800">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-medium">{project.clientName}</span>
              </div>
              {project.clientPhone && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {project.clientPhone}
                </div>
              )}
              {project.clientEmail && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {project.clientEmail}
                </div>
              )}
              {project.clientAddress && (
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  {project.clientAddress}
                </div>
              )}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Timeline</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400">Start</p>
                <p className="text-xs font-medium text-gray-700">{fmtDate(project.startDate)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Deadline</p>
                <p className={cn('text-xs font-medium', project.deadline && new Date(project.deadline) < new Date() && !['COMPLETED', 'CANCELLED'].includes(project.status) ? 'text-red-600' : 'text-gray-700')}>
                  {fmtDate(project.deadline)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Completed</p>
                <p className="text-xs font-medium text-gray-700">{fmtDate(project.completedAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Type</p>
                <p className="text-xs font-medium text-gray-700">{project.projectType}</p>
              </div>
            </div>
          </div>

          {/* Site Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Site</h3>
            {project.siteAddress && (
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                {project.siteAddress}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {project.siteContact && (
                <div>
                  <p className="text-[10px] text-gray-400">Contact</p>
                  <p className="text-xs font-medium text-gray-700">{project.siteContact}</p>
                </div>
              )}
              {project.siteContactPhone && (
                <div>
                  <p className="text-[10px] text-gray-400">Phone</p>
                  <p className="text-xs font-medium text-gray-700">{project.siteContactPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {(project.notes || project.internalNotes) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</h3>
              {project.notes && (
                <p className="text-xs text-gray-600">{project.notes}</p>
              )}
              {project.internalNotes && (
                <div className="mt-2 p-2.5 bg-amber-50 rounded-lg">
                  <p className="text-[10px] font-semibold text-amber-600 mb-1">Internal</p>
                  <p className="text-xs text-amber-800">{project.internalNotes}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── SITE SURVEY TAB ─── */}
      {activeTab === 'survey' && (
        <motion.div {...fadeUp} className="space-y-3">
          {/* Post-creation success guidance */}
          <AnimatePresence>
            {surveyJustCreated && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 overflow-hidden"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-emerald-800">Survey Created Successfully</p>
                    <p className="text-[11px] text-emerald-600 mt-1">
                      Upload a floor plan, place cameras, and draw cable routes. When done, proceed to the next step.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSurveyJustCreated(false); fileInputRef.current?.click(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-semibold active:scale-95 transition-transform"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Upload Floor Plan
                  </button>
                  <button
                    onClick={() => { setSurveyJustCreated(false); setActiveTab('equipment'); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold active:scale-95 transition-transform"
                  >
                    <Package className="w-3.5 h-3.5" /> Equipment Tab
                  </button>
                </div>
                <button
                  onClick={() => setSurveyJustCreated(false)}
                  className="w-full text-center text-[10px] text-emerald-500 font-medium"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Survey list + create */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Surveys ({surveys.length})</h3>
            <button
              onClick={createSurvey}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" /> New Survey
            </button>
          </div>

          {surveys.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
              <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No surveys yet. Create one to start planning.</p>
            </div>
          ) : (
            <>
              {/* Survey selector tabs */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {surveys.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => loadSurvey(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                      activeSurveyId === s.id
                        ? 'bg-violet-500 text-white shadow-sm'
                        : 'bg-white border border-gray-100 text-gray-500',
                    )}
                  >
                    Survey {surveys.length - i}
                  </button>
                ))}
              </div>

              {activeSurveyId && (
                <>
                  {/* Surveyor + Notes */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Surveyor</label>
                        <input
                          type="text"
                          placeholder="Name"
                          value={surveyorName}
                          onChange={(e) => setSurveyorName(e.target.value)}
                          onBlur={saveSurveyMeta}
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Survey Date</label>
                        <input
                          type="text"
                          readOnly
                          value={surveys.find((s) => s.id === activeSurveyId)?.surveyDate
                            ? fmtDate(surveys.find((s) => s.id === activeSurveyId)!.surveyDate)
                            : '—'}
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Blind Spot Notes</label>
                      <textarea
                        placeholder="Observations, blind spots, special requirements..."
                        value={surveyNote}
                        onChange={(e) => setSurveyNote(e.target.value)}
                        onBlur={saveSurveyMeta}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                      />
                    </div>
                  </div>

                  {/* Floor Plan Upload */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Floor Plan</h3>
                      <div className="flex items-center gap-1.5">
                        {!floorPlanData && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-semibold active:scale-95 transition-transform"
                          >
                            <ImageIcon className="w-3 h-3" /> Upload
                          </button>
                        )}
                        {floorPlanData && (
                          <button
                            onClick={() => { setFloorPlanData(null); setFloorPlanName(''); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-semibold active:scale-95 transition-transform"
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

                    {floorPlanData ? (
                      <div
                        ref={floorPlanRef}
                        className="relative w-full rounded-xl overflow-hidden border border-gray-200 cursor-crosshair"
                        style={{ minHeight: 200 }}
                        onClick={handleFloorPlanClick}
                      >
                        <img src={floorPlanData} alt="Floor Plan" className="w-full h-auto block" style={{ minHeight: 200, objectFit: 'contain', background: '#f9fafb' }} />

                        {/* Cable Routes */}
                        {cableRoutes.map((route) => {
                          let pts: Point[] = [];
                          try { pts = JSON.parse(route.points); } catch { /* */ }
                          if (pts.length < 2) return null;
                          return (
                            <svg key={route.id} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <polyline
                                points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="0.4"
                                strokeDasharray="1,0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              {pts.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="0.6" fill="#f59e0b" />
                              ))}
                            </svg>
                          );
                        })}

                        {/* Drawing in progress */}
                        {drawingPoints.length > 0 && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polyline
                              points={drawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="0.5"
                              strokeDasharray="1,0.5"
                              strokeLinecap="round"
                            />
                            {drawingPoints.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="#f59e0b" />
                            ))}
                          </svg>
                        )}

                        {/* Camera Markers */}
                        {cameras.map((cam) => (
                          <div
                            key={cam.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group"
                            style={{ left: `${cam.posX}%`, top: `${cam.posY}%` }}
                          >
                            <div className="w-7 h-7 rounded-full bg-violet-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-sm">
                              {getCameraIcon(cam.cameraType)}
                            </div>
                            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-violet-700 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                              {cam.label}
                            </div>
                          </div>
                        ))}

                        {/* Mode indicator */}
                        {mode !== 'view' && (
                          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
                            {mode === 'place-camera' ? 'Tap to place camera' : `Tap to add points (${drawingPoints.length})`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                        <ImageIcon className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                        <p className="text-xs text-gray-400">Upload a floor plan or site photo</p>
                      </div>
                    )}
                    {floorPlanName && <p className="text-[10px] text-gray-400 truncate">{floorPlanName}</p>}
                  </div>

                  {/* Toolbar */}
                  {floorPlanData && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                      <button
                        onClick={() => { setMode(mode === 'place-camera' ? 'view' : 'place-camera'); setDrawingPoints([]); }}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                          mode === 'place-camera'
                            ? 'bg-violet-500 text-white shadow-sm'
                            : 'bg-white border border-gray-100 text-gray-600',
                        )}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {mode === 'place-camera' ? 'Cancel' : 'Place Camera'}
                      </button>
                      <button
                        onClick={() => {
                          if (mode === 'draw-cable' && drawingPoints.length >= 2) {
                            handleFinishCable();
                          } else {
                            setMode(mode === 'draw-cable' ? 'view' : 'draw-cable');
                            if (mode !== 'draw-cable') setDrawingPoints([]);
                          }
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors',
                          mode === 'draw-cable'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-white border border-gray-100 text-gray-600',
                        )}
                      >
                        <Cable className="w-3.5 h-3.5" />
                        {mode === 'draw-cable'
                          ? (drawingPoints.length >= 2 ? 'Finish Route' : `Tap points (${drawingPoints.length})`)
                          : 'Draw Cable'}
                      </button>
                      {mode === 'draw-cable' && drawingPoints.length > 0 && (
                        <button
                          onClick={() => { setDrawingPoints([]); setMode('view'); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-red-50 text-red-600"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  )}

                  {/* Camera & Cable Lists */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Camera positions list */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-500">
                          <Camera className="w-3 h-3 inline mr-1" />Cameras ({cameras.length})
                        </h4>
                      </div>
                      {cameras.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2">No cameras placed</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {cameras.map((cam) => (
                            <div key={cam.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 group">
                              <span className="text-sm">{getCameraIcon(cam.cameraType)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-gray-800 truncate">{cam.label}</p>
                                <p className="text-[9px] text-gray-400">{cam.cameraType}{cam.resolution ? ` · ${cam.resolution}` : ''}</p>
                              </div>
                              <button
                                onClick={() => deleteCamera(cam.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 active:scale-90 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cable routes list */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-500">
                          <Cable className="w-3 h-3 inline mr-1" />Cables ({cableRoutes.length})
                        </h4>
                      </div>
                      {cableRoutes.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2">No cable routes</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {cableRoutes.map((route) => (
                            <div key={route.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 group">
                              <div className="w-5 h-0.5 bg-amber-400 rounded" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-gray-800 truncate">{route.label}</p>
                                <p className="text-[9px] text-gray-400">{route.cableType}{route.cableLength ? ` · ${route.cableLength}m` : ''}</p>
                              </div>
                              <button
                                onClick={() => deleteCableRoute(route.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 active:scale-90 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Survey complete action */}
          {surveys.length > 0 && project?.status === 'SURVEY' && (
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-center shadow-lg shadow-violet-500/20">
              <p className="text-xs font-bold text-white mb-1">Survey Ready?</p>
              <p className="text-[10px] text-violet-100 mb-3">Mark survey complete and move to Equipment planning</p>
              <button
                onClick={() => changeStatus('PROCUREMENT')}
                className="px-6 py-2.5 rounded-xl bg-white text-violet-700 text-xs font-bold active:scale-95 transition-transform shadow-sm"
              >
                Complete Survey → Equipment
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── EQUIPMENT TAB ─── */}
      {activeTab === 'equipment' && (
        <motion.div {...fadeUp} className="space-y-3">
          {/* Workflow guidance for equipment step */}
          {surveys.length > 0 && project?.status !== 'COMPLETED' && project?.status !== 'CANCELLED' && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-violet-800">
                {cameras.length > 0 || cableRoutes.length > 0
                  ? 'Survey data available from Site Survey tab'
                  : 'Complete the Site Survey first for best results'}
              </p>
              <p className="text-[11px] text-violet-600">
                {cameras.length > 0
                  ? `${cameras.length} camera(s) and ${cableRoutes.length} cable route(s) mapped. Use this info when planning equipment.`
                  : 'Equipment will be linked here from serial items when assigned to this project.'}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setActiveTab('survey')}
                  className="text-[11px] font-semibold text-violet-600 flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" /> View Survey
                </button>
                <span className="text-violet-300">·</span>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-[11px] font-semibold text-violet-600 flex items-center gap-1"
                >
                  <ClipboardList className="w-3 h-3" /> Create Tasks
                </button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-800">Equipment Tracking</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto">
              Equipment will be linked here from serial items when assigned to this project.
            </p>
          </div>
          {/* Storage Calculator CTA */}
          <button
            onClick={() => navigate('storage-calculator')}
            className="w-full mt-3 flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zM9 17V7m6 10V7" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900">Storage Estimation Calculator</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Estimate HDD requirements for this project</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </button>
        </motion.div>
      )}

      {/* ─── TASKS TAB ─── */}
      {activeTab === 'tasks' && (
        <motion.div {...fadeUp}>
          <ProjectTasksTab projectId={projectId || ''} navigate={navigate} />
        </motion.div>
      )}

      {/* ─── CAMERA PLACEMENT DIALOG ─── */}
      <AnimatePresence>
        {cameraDialog.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setCameraDialog({ open: false, x: 0, y: 0 })}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Add Camera</h3>
                <button onClick={() => setCameraDialog({ open: false, x: 0, y: 0 })} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Label</label>
                  <input
                    type="text"
                    placeholder={`Camera ${cameras.length + 1}`}
                    value={camForm.label}
                    onChange={(e) => setCamForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Type</label>
                    <select
                      value={camForm.cameraType}
                      onChange={(e) => setCamForm((f) => ({ ...f, cameraType: e.target.value as CameraType }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      {cameraTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Resolution</label>
                    <input
                      type="text"
                      placeholder="4MP"
                      value={camForm.resolution}
                      onChange={(e) => setCamForm((f) => ({ ...f, resolution: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Notes</label>
                  <textarea
                    placeholder="Installation notes..."
                    value={camForm.notes}
                    onChange={(e) => setCamForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={saveCamera}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-transform"
              >
                <Save className="w-4 h-4 inline mr-1.5" />
                Save Camera
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── CABLE ROUTE DIALOG ─── */}
      <AnimatePresence>
        {cableDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => { setCableDialog(false); setDrawingPoints([]); setMode('view'); }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Save Cable Route</h3>
                <button onClick={() => { setCableDialog(false); setDrawingPoints([]); setMode('view'); }} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Label</label>
                  <input
                    type="text"
                    placeholder={`Route ${cableRoutes.length + 1}`}
                    value={cableForm.label}
                    onChange={(e) => setCableForm((f) => ({ ...f, label: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Cable Type</label>
                    <select
                      value={cableForm.cableType}
                      onChange={(e) => setCableForm((f) => ({ ...f, cableType: e.target.value as CableType }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      {cableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Length (m)</label>
                    <input
                      type="number"
                      placeholder="e.g., 50"
                      value={cableForm.cableLength}
                      onChange={(e) => setCableForm((f) => ({ ...f, cableLength: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Notes</label>
                  <textarea
                    placeholder="Route notes..."
                    value={cableForm.notes}
                    onChange={(e) => setCableForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={saveCableRoute}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-transform"
              >
                <Save className="w-4 h-4 inline mr-1.5" />
                Save Cable Route
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── STATUS PICKER DIALOG ─── */}
      <AnimatePresence>
        {showStatusPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowStatusPicker(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Change Status</h3>
                <button onClick={() => setShowStatusPicker(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((s) => {
                  const sc = statusConfig[s];
                  return (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className={cn(
                        'px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors',
                        project.status === s
                          ? 'bg-violet-500 text-white shadow-sm'
                          : `${sc.bg} ${sc.text}`,
                      )}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}