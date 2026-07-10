'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Pencil, X, Save, Loader2, Phone, User, Package,
  Wrench, Camera, FileText, AlertCircle, Clock,
  Zap, ShieldCheck, ExternalLink, Hash, Search, Plus, Trash2,
  Lock, CheckCircle2, KeyRound, AlertTriangle, Building2, ChevronDown,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { CCTVJobCard, CCTVJobCardPart, JobPriority, CCTVOutsourcedVendor } from '@/modules/cctv-shop/types';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

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

const STATUS_BG: Record<string, string> = {
  RECEIVED: 'bg-slate-500',
  DIAGNOSING: 'bg-blue-500',
  AWAITING_PARTS: 'bg-amber-500',
  IN_PROGRESS: 'bg-violet-500',
  TESTING: 'bg-cyan-500',
  READY_FOR_DELIVERY: 'bg-emerald-500',
  DELIVERED: 'bg-green-600',
  OUTSOURCED: 'bg-orange-500',
  CANCELLED: 'bg-red-500',
};

const VALID_TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
  RECEIVED: [
    { status: 'DIAGNOSING', label: 'Start Diagnosis', color: 'bg-blue-500 hover:bg-blue-600' },
    { status: 'CANCELLED', label: 'Cancel Job', color: 'bg-red-500 hover:bg-red-600' },
  ],
  DIAGNOSING: [
    { status: 'AWAITING_PARTS', label: 'Await Parts', color: 'bg-amber-500 hover:bg-amber-600' },
    { status: 'IN_PROGRESS', label: 'Start Repair', color: 'bg-violet-500 hover:bg-violet-600' },
    { status: 'OUTSOURCED', label: 'Outsource', color: 'bg-orange-500 hover:bg-orange-600' },
    { status: 'CANCELLED', label: 'Cancel Job', color: 'bg-red-500 hover:bg-red-600' },
  ],
  AWAITING_PARTS: [
    { status: 'IN_PROGRESS', label: 'Start Repair', color: 'bg-violet-500 hover:bg-violet-600' },
    { status: 'CANCELLED', label: 'Cancel Job', color: 'bg-red-500 hover:bg-red-600' },
  ],
  IN_PROGRESS: [
    { status: 'TESTING', label: 'Start Testing', color: 'bg-cyan-500 hover:bg-cyan-600' },
    { status: 'AWAITING_PARTS', label: 'Need Parts', color: 'bg-amber-500 hover:bg-amber-600' },
  ],
  TESTING: [
    { status: 'READY_FOR_DELIVERY', label: 'Ready for Pickup', color: 'bg-emerald-500 hover:bg-emerald-600' },
    { status: 'IN_PROGRESS', label: 'Back to Repair', color: 'bg-violet-500 hover:bg-violet-600' },
  ],
  READY_FOR_DELIVERY: [], // 2D: DELIVERED is now handled via OTP flow, not direct transition
  OUTSOURCED: [
    { status: 'TESTING', label: 'Start Testing', color: 'bg-cyan-500 hover:bg-cyan-600' },
    { status: 'IN_PROGRESS', label: 'Start Repair', color: 'bg-violet-500 hover:bg-violet-600' },
  ],
};

const TYPE_ICONS: Record<string, string> = {
  REPAIR: '⚡', INSTALLATION: '🔧', MAINTENANCE: '🛠️', DIAGNOSTIC: '🔬',
};

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return null;
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

interface StatusHistoryEntry {
  status: string;
  date: string;
  notes?: string;
}

export function CCTVJobCardDetail() {
  const { navigate, goBack, contextId } = useCCTVNavStore();
  const { toast } = useToast();
  const businessId = useCctvBusinessId();

  const [job, setJob] = useState<CCTVJobCard | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number | undefined>>({});
  const [saving, setSaving] = useState(false);

  // Status transition dialog
  const [transitionTarget, setTransitionTarget] = useState<{ status: string; label: string; color: string } | null>(null);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);

  // Deliver dialog fields
  const [collectorName, setCollectorName] = useState('');
  const [collectorPhone, setCollectorPhone] = useState('');
  const [collectorNid, setCollectorNid] = useState('');

  // Outsource dialog fields
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [vendorList, setVendorList] = useState<Array<{ id: string; name: string; phone?: string; specialization?: string }>>([]);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorSpec, setNewVendorSpec] = useState('');
  const [newVendorSaving, setNewVendorSaving] = useState(false);

  // 2D: OTP Delivery state
  const [otpStep, setOtpStep] = useState<'idle' | 'collector-info' | 'otp-input' | 'verified' | 'delivering'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpGenerated, setOtpGenerated] = useState(false);

  // Spare parts
  const [parts, setParts] = useState<CCTVJobCardPart[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [partResults, setPartResults] = useState<Array<{ id: string; serialNumber: string; product?: { name: string; brand: string } | null; costPrice: number | null }>>([]);
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partSearchLoading, setPartSearchLoading] = useState(false);
  const [partAdding, setPartAdding] = useState<string | null>(null);
  const [partRemoving, setPartRemoving] = useState<string | null>(null);
  const partSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchJob = async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}`);
      if (res.ok) {
        const data = await res.json();
        const jobData: CCTVJobCard = data.jobCard || data;
        setJob(jobData);
        setStatusHistory(data.statusHistory || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!contextId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const jobData: CCTVJobCard = data.jobCard || data;
          setJob(jobData);
          setStatusHistory(data.statusHistory || []);
          setParts((data.parts as CCTVJobCardPart[]) || []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contextId]);

  // ── Edit Mode Handlers ──

  const enterEditMode = () => {
    if (!job) return;
    setEditForm({
      diagnosis: job.diagnosis || '',
      repairNotes: job.repairNotes || '',
      estimatedCost: job.estimatedCost ?? '',
      finalCost: job.finalCost ?? '',
      laborCharge: job.laborCharge ?? '',
      assignedToName: job.assignedToName || '',
      priority: job.priority,
      internalNotes: job.internalNotes || '',
      conditionNotes: job.conditionNotes || '',
      photoUrls: job.photoUrls || '',
    });
    setEditMode(true);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!contextId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.diagnosis !== undefined) body.diagnosis = editForm.diagnosis || null;
      if (editForm.repairNotes !== undefined) body.repairNotes = editForm.repairNotes || null;
      if (editForm.estimatedCost !== undefined) body.estimatedCost = editForm.estimatedCost === '' ? null : Number(editForm.estimatedCost);
      if (editForm.finalCost !== undefined) body.finalCost = editForm.finalCost === '' ? null : Number(editForm.finalCost);
      if (editForm.laborCharge !== undefined) body.laborCharge = editForm.laborCharge === '' ? null : Number(editForm.laborCharge);
      if (editForm.assignedToName !== undefined) body.assignedToName = editForm.assignedToName || null;
      if (editForm.priority !== undefined) body.priority = editForm.priority as JobPriority;
      if (editForm.internalNotes !== undefined) body.internalNotes = editForm.internalNotes || null;
      if (editForm.conditionNotes !== undefined) body.conditionNotes = editForm.conditionNotes || null;
      if (editForm.photoUrls !== undefined) body.photoUrls = editForm.photoUrls || null;

      const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: 'Updated', description: 'Job card saved successfully.' });
        setEditMode(false);
        fetchJob();
      } else {
        toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Status Transition Handlers ──

  const openTransitionDialog = (transition: { status: string; label: string; color: string }) => {
    // For DELIVERED, redirect to OTP flow instead of simple dialog
    if (transition.status === 'DELIVERED') {
      setOtpStep(job?.otpVerified ? 'verified' : 'collector-info');
      setOtpCode('');
      setOtpError('');
      setOtpGenerated(!!job?.otpCode);
      return;
    }
    // For OUTSOURCED, fetch vendors and pre-fill
    if (transition.status === 'OUTSOURCED') {
      setTransitionTarget(transition);
      setTransitionNotes('');
      setVendorName('');
      setVendorPhone('');
      setVendorCost('');
      setExpectedReturn('');
      setSelectedVendorId('');
      setShowVendorPicker(false);
      setShowNewVendorForm(false);
      // Fetch vendor list for picker
      (async () => {
        try {
          const res = await fetch(`/api/businesses/${businessId}/cctv/outsourced-vendors`);
          if (res.ok) setVendorList(await res.json());
        } catch { /* silent */ }
      })();
      return;
    }
    setTransitionTarget(transition);
    setTransitionNotes('');
    setCollectorName('');
    setCollectorPhone('');
    setCollectorNid('');
    setVendorName('');
    setVendorPhone('');
    setVendorCost('');
    setExpectedReturn('');
  };

  // ── 2D: OTP Handlers ──

  const handleGenerateOtp = async () => {
    if (!contextId) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          collectorName: collectorName || undefined,
          collectorPhone: collectorPhone || undefined,
          collectorNid: collectorNid || undefined,
        }),
      });
      if (res.ok) {
        setOtpStep('otp-input');
        setOtpGenerated(true);
        toast({ title: 'OTP Generated', description: 'Enter the 6-digit code to verify delivery.' });
        fetchJob(); // refresh to get updated collector info
      } else {
        const err = await res.json();
        setOtpError(err.error || 'Failed to generate OTP');
      }
    } catch {
      setOtpError('Network error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!contextId || otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit OTP');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: otpCode }),
      });
      if (res.ok) {
        setOtpStep('verified');
        toast({ title: 'OTP Verified', description: 'Delivery authorized. You can now mark as delivered.' });
        fetchJob();
      } else {
        const err = await res.json();
        setOtpError(err.error || 'Verification failed');
      }
    } catch {
      setOtpError('Network error');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleFinalDeliver = async () => {
    if (!contextId) return;
    setOtpLoading(true);
    try {
      const statusRes = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' }),
      });
      if (statusRes.ok) {
        toast({ title: 'Delivered!', description: 'Job card marked as delivered successfully.' });
        setOtpStep('idle');
        fetchJob();
      } else {
        const err = await statusRes.json();
        toast({ title: 'Delivery Failed', description: err.error || 'Could not mark as delivered', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setOtpLoading(false);
    }
  };

  const cancelOtpFlow = () => {
    setOtpStep('idle');
    setOtpCode('');
    setOtpError('');
  };

  const handleConfirmTransition = async () => {
    if (!contextId || !transitionTarget) return;
    setDialogLoading(true);

    try {
      const statusRes = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: transitionTarget.status, notes: transitionNotes || undefined }),
      });

      if (!statusRes.ok) {
        toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
        setDialogLoading(false);
        return;
      }

      // Follow-up PUT for OUTSOURCED (vendor info)
      if (transitionTarget.status === 'OUTSOURCED') {
        await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorId: selectedVendorId || undefined,
            vendorName: vendorName || undefined,
            vendorPhone: vendorPhone || undefined,
            vendorCost: vendorCost ? Number(vendorCost) : undefined,
            expectedReturn: expectedReturn || undefined,
          }),
        });
      }

      toast({ title: 'Status Updated', description: `Job moved to ${transitionTarget.label}.` });
      setTransitionTarget(null);
      fetchJob();
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setDialogLoading(false);
    }
  };

  // ── Photo URL Parsing ──

  const parsePhotoUrls = (raw?: string): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((u: unknown) => typeof u === 'string');
      return [];
    } catch {
      return [];
    }
  };

  // ── Loading State ──

  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <div className="flex gap-2.5">
          <Skeleton className="flex-1 h-11 rounded-2xl" />
          <Skeleton className="flex-1 h-11 rounded-2xl" />
        </div>
      </motion.div>
    );
  }

  if (!job) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Job Card</h1>
        </div>
        <div className="text-center py-16">
          <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Job card not found</p>
        </div>
      </motion.div>
    );
  }

  const transitions = VALID_TRANSITIONS[job.status] || [];
  const photoUrls = parsePhotoUrls(job.photoUrls);
  const displayDeviceName = job.deviceName || job.serialItem?.product?.name || 'Unknown Device';

  return (
    <div className="pb-24">
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        {/* ─── 1. Header Row ─── */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-base font-bold text-gray-900 font-mono truncate">
            {job.jobCode}
          </span>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0', STATUS_COLORS[job.status])}>
            {job.status.replace(/_/g, ' ')}
          </span>
          {(job.priority === 'URGENT' || job.priority === 'HIGH') && (
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0',
              job.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
            )}>
              {job.priority}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={editMode ? exitEditMode : enterEditMode}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          >
            {editMode ? <X className="w-4 h-4 text-gray-500" /> : <Pencil className="w-4 h-4 text-gray-500" />}
          </button>
        </div>

        {/* ─── 2. Large Status Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn('rounded-2xl p-5 text-white', STATUS_BG[job.status])}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold tracking-wide">{job.status.replace(/_/g, ' ')}</p>
              <p className="text-white/70 text-xs mt-1 flex items-center gap-1.5">
                {TYPE_ICONS[job.jobType] || '📦'} {job.jobType}
                <span className="mx-1">·</span>
                <Clock className="w-3 h-3" />
                {formatDate(job.receivedAt)}
              </p>
            </div>
            <div className="text-3xl opacity-80">
              {TYPE_ICONS[job.jobType] || '📦'}
            </div>
          </div>

          {job.status === 'OUTSOURCED' && (
            <div className="mt-4 pt-3 border-t border-white/20 space-y-1.5 text-sm">
              {job.vendorName && <p className="text-white/90"><span className="text-white/60">Vendor:</span> {job.vendorName}{job.vendorPhone && ` (${job.vendorPhone})`}</p>}
              {job.vendorCost != null && <p className="text-white/90"><span className="text-white/60">Vendor Cost:</span> {formatBDT(job.vendorCost)}</p>}
              {job.expectedReturn && (
                <p className={cn(
                  'text-white/90 flex items-center gap-1.5',
                  job.expectedReturn && new Date(job.expectedReturn) < new Date() && 'text-yellow-200 font-semibold',
                )}>
                  {job.expectedReturn && new Date(job.expectedReturn) < new Date() && <AlertTriangle className="w-3.5 h-3.5" />}
                  <span className="text-white/60">Expected Return:</span> {new Date(job.expectedReturn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {job.expectedReturn && new Date(job.expectedReturn) < new Date() && ' (Overdue!)'}
                </p>
              )}
              {job.outsourcedAt && <p className="text-white/70 text-xs"><span className="text-white/50">Sent:</span> {formatDate(job.outsourcedAt)}</p>}
            </div>
          )}

          {job.status === 'DELIVERED' && (
            <div className="mt-4 pt-3 border-t border-white/20 space-y-1.5 text-sm">
              {job.deliveredAt && <p className="text-white/90"><span className="text-white/60">Delivered:</span> {formatDate(job.deliveredAt)}</p>}
              {job.collectorName && <p className="text-white/90"><span className="text-white/60">Collector:</span> {job.collectorName}{job.collectorPhone && ` (${job.collectorPhone})`}</p>}
              {job.otpVerified && (
                <p className="text-white/80 text-xs flex items-center gap-1 mt-1">
                  <ShieldCheck className="w-3 h-3" /> OTP Verified
                  {job.otpVerifiedAt && ` at ${formatDate(job.otpVerifiedAt)}`}
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* ─── 3. Status Transition Actions ─── */}
        {transitions.length > 0 && !editMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-2"
          >
            {transitions.map((t) => (
              <AlertDialog
                key={t.status}
                open={transitionTarget?.status === t.status}
                onOpenChange={(open) => {
                  if (!open) setTransitionTarget(null);
                }}
              >
                <button
                  onClick={() => openTransitionDialog(t)}
                  className={cn(
                    'px-4 py-2.5 rounded-2xl text-white text-xs font-semibold shadow-sm transition-colors active:scale-[0.97]',
                    t.color,
                  )}
                >
                  {t.label}
                </button>

                <AlertDialogContent className="rounded-2xl p-5 max-w-[calc(100vw-2rem)] w-full mx-auto">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base">
                      Move to {t.status.replace(/_/g, ' ')}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-gray-500">
                      This will update the job status from <span className="font-semibold text-gray-700">{job.status.replace(/_/g, ' ')}</span> to <span className="font-semibold text-gray-700">{t.status.replace(/_/g, ' ')}</span>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="mt-3 space-y-3">
                    <Textarea
                      placeholder="Optional notes for this transition..."
                      value={transitionNotes}
                      onChange={(e) => setTransitionNotes(e.target.value)}
                      className="min-h-[72px] text-sm rounded-xl"
                    />

                    {/* Extra fields for OUTSOURCED — 2E: Vendor Picker */}
                    {t.status === 'OUTSOURCED' && (
                      <div className="space-y-3 pt-1 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-600">Vendor Information</p>

                        {/* Vendor Picker / Manual toggle */}
                        {!showNewVendorForm && !showVendorPicker && vendorList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowVendorPicker(true)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-orange-500" />
                              {selectedVendorId
                                ? vendorList.find(v => v.id === selectedVendorId)?.name || 'Select Vendor'
                                : 'Select from saved vendors'}
                            </span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        )}

                        {/* Vendor dropdown list */}
                        {showVendorPicker && (
                          <div className="rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                            {vendorList.map(v => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVendorId(v.id);
                                  setVendorName(v.name);
                                  setVendorPhone(v.phone || '');
                                  setShowVendorPicker(false);
                                }}
                                className={cn(
                                  'w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0',
                                  selectedVendorId === v.id && 'bg-orange-50',
                                )}
                              >
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">{v.name}</p>
                                  {v.specialization && <p className="text-[10px] text-gray-400">{v.specialization}</p>}
                                </div>
                                {v.phone && <span className="text-[10px] text-gray-400">{v.phone}</span>}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => { setShowVendorPicker(false); setShowNewVendorForm(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-violet-600 font-semibold hover:bg-violet-50 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add New Vendor
                            </button>
                          </div>
                        )}

                        {/* New vendor inline form */}
                        {showNewVendorForm && (
                          <div className="space-y-2 p-3 rounded-xl bg-violet-50 border border-violet-100">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold text-violet-700">New Vendor</p>
                              <button type="button" onClick={() => setShowNewVendorForm(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <Input
                              placeholder="Vendor Name *"
                              value={newVendorName}
                              onChange={(e) => setNewVendorName(e.target.value)}
                              className="h-8 text-xs rounded-lg"
                            />
                            <Input
                              placeholder="Phone"
                              value={newVendorPhone}
                              onChange={(e) => setNewVendorPhone(e.target.value)}
                              className="h-8 text-xs rounded-lg"
                            />
                            <Input
                              placeholder="Specialization (e.g. Chip-level repair)"
                              value={newVendorSpec}
                              onChange={(e) => setNewVendorSpec(e.target.value)}
                              className="h-8 text-xs rounded-lg"
                            />
                            <button
                              type="button"
                              disabled={newVendorSaving || !newVendorName.trim()}
                              onClick={async () => {
                                setNewVendorSaving(true);
                                try {
                                  const res = await fetch(`/api/businesses/${businessId}/cctv/outsourced-vendors`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name: newVendorName, phone: newVendorPhone, specialization: newVendorSpec }),
                                  });
                                  if (res.ok) {
                                    const created = await res.json();
                                    setVendorList(prev => [created, ...prev]);
                                    setSelectedVendorId(created.id);
                                    setVendorName(created.name);
                                    setVendorPhone(created.phone || '');
                                    setNewVendorName('');
                                    setNewVendorPhone('');
                                    setNewVendorSpec('');
                                    setShowNewVendorForm(false);
                                    toast({ title: 'Vendor saved' });
                                  }
                                } catch { /* silent */ }
                                finally { setNewVendorSaving(false); }
                              }}
                              className="w-full text-[11px] font-semibold text-white bg-violet-500 rounded-lg py-1.5 disabled:opacity-50"
                            >
                              {newVendorSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Save Vendor'}
                            </button>
                          </div>
                        )}

                        {/* Manual entry or override */}
                        {(vendorList.length === 0 || selectedVendorId) && (
                          <div className="space-y-2">
                            {selectedVendorId && <p className="text-[10px] text-gray-400">Auto-filled from selected vendor. Edit to override.</p>}
                            <Input
                              placeholder="Vendor Name"
                              value={vendorName}
                              onChange={(e) => setVendorName(e.target.value)}
                              className="h-9 text-sm rounded-xl"
                            />
                            <Input
                              placeholder="Vendor Phone"
                              value={vendorPhone}
                              onChange={(e) => setVendorPhone(e.target.value)}
                              className="h-9 text-sm rounded-xl"
                            />
                          </div>
                        )}

                        {!showNewVendorForm && !showVendorPicker && (
                          <button
                            type="button"
                            onClick={() => setShowNewVendorForm(true)}
                            className="text-[11px] text-violet-600 font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add new vendor
                          </button>
                        )}

                        <Input
                          placeholder="Vendor Cost (৳)"
                          type="number"
                          value={vendorCost}
                          onChange={(e) => setVendorCost(e.target.value)}
                          className="h-9 text-sm rounded-xl"
                        />
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">Expected Return Date</p>
                          <Input
                            type="date"
                            value={expectedReturn}
                            onChange={(e) => setExpectedReturn(e.target.value)}
                            className="h-9 text-sm rounded-xl"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <AlertDialogFooter className="mt-4 gap-2">
                    <AlertDialogCancel className="rounded-xl h-10 text-sm">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleConfirmTransition}
                      disabled={dialogLoading}
                      className={cn('rounded-xl h-10 text-white text-sm font-semibold', t.color)}
                    >
                      {dialogLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirm ${t.label}`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
          </motion.div>
        )}

        {/* ─── Edit Mode Banner ─── */}
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-2xl p-3"
          >
            <Pencil className="w-4 h-4 text-violet-500 shrink-0" />
            <p className="text-xs text-violet-700 font-medium flex-1">Editing job card details</p>
            <button
              onClick={exitEditMode}
              className="text-[11px] text-violet-500 font-semibold px-3 py-1.5 rounded-xl bg-white border border-violet-200 active:bg-violet-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="text-[11px] text-white font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm flex items-center gap-1 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </motion.div>
        )}

        {/* ─── 5. Info Cards Grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Customer Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Customer</h3>
            </div>
            <p className="text-sm font-semibold text-gray-900">{job.customerName}</p>
            {job.customerPhone && (
              <a
                href={`tel:${job.customerPhone}`}
                className="text-xs text-violet-600 font-medium flex items-center gap-1 mt-1.5 active:text-violet-700"
              >
                <Phone className="w-3 h-3" />
                {job.customerPhone}
              </a>
            )}
          </motion.div>

          {/* Device Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Device</h3>
            </div>
            <p className="text-sm font-semibold text-gray-900">{displayDeviceName}</p>
            {job.serialNumber && (
              <p className="text-xs font-mono text-gray-500 mt-1">
                <Hash className="w-3 h-3 inline mr-1" />
                {job.serialNumber}
              </p>
            )}
            {job.imei && (
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                IMEI: {job.imei}
              </p>
            )}
            {job.serialItem?.grade && (
              <Badge className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-0 font-semibold">
                Grade {job.serialItem.grade}
              </Badge>
            )}
            {job.serialItem?.product && (
              <button
                onClick={() => navigate('serial-items')}
                className="text-[11px] text-violet-600 font-medium flex items-center gap-0.5 mt-1.5 active:text-violet-700"
              >
                {job.serialItem.product.brand} {job.serialItem.product.name}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </motion.div>

          {/* Condition Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm sm:col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Camera className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Condition</h3>
            </div>

            {editMode ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Condition notes..."
                  value={(editForm.conditionNotes as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, conditionNotes: e.target.value }))}
                  className="min-h-[60px] text-sm rounded-xl"
                />
                <div>
                  <p className="text-[10px] text-gray-400 mb-1 font-medium">Photo URLs (JSON array)</p>
                  <Textarea
                    placeholder='["https://example.com/photo1.jpg"]'
                    value={(editForm.photoUrls as string) || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, photoUrls: e.target.value }))}
                    className="min-h-[48px] text-xs font-mono rounded-xl"
                  />
                </div>
              </div>
            ) : (
              <>
                {!job.conditionNotes && photoUrls.length === 0 && (
                  <p className="text-xs text-gray-400">No condition documented</p>
                )}
                {job.conditionNotes && (
                  <p className="text-xs text-gray-600 leading-relaxed">{job.conditionNotes}</p>
                )}
                {photoUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {photoUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg font-medium hover:bg-violet-100 transition-colors truncate max-w-[200px] flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3 shrink-0" />
                        Photo {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* ─── 6. Fault & Repair Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Fault &amp; Repair</h3>
          </div>

          <div className="space-y-3">
            {/* Reported Fault */}
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Reported Fault</p>
              <p className="text-sm font-bold text-gray-900">{job.reportedFault || '—'}</p>
            </div>

            {/* Diagnosis */}
            {editMode ? (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Diagnosis</p>
                <Textarea
                  placeholder="Diagnosis findings..."
                  value={(editForm.diagnosis as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  className="min-h-[60px] text-sm rounded-xl"
                />
              </div>
            ) : (
              job.diagnosis && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Diagnosis</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{job.diagnosis}</p>
                </div>
              )
            )}

            {/* Repair Notes */}
            {editMode ? (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Repair Notes</p>
                <Textarea
                  placeholder="What was repaired..."
                  value={(editForm.repairNotes as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, repairNotes: e.target.value }))}
                  className="min-h-[60px] text-sm rounded-xl"
                />
              </div>
            ) : (
              job.repairNotes && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">Repair Notes</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{job.repairNotes}</p>
                </div>
              )
            )}
          </div>
        </motion.div>

        {/* ─── 6.5 Spare Parts Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.215 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Spare Parts</h3>
              {parts.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-violet-100 text-violet-700">
                  {parts.length}
                </Badge>
              )}
            </div>
            {(job.status === 'DIAGNOSING' || job.status === 'AWAITING_PARTS' || job.status === 'IN_PROGRESS') && (
              <button
                onClick={() => { setShowPartSearch(true); setPartSearch(''); setPartResults([]); }}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            )}
          </div>

          {/* Part Search (inline) */}
          {showPartSearch && (
            <div className="relative mb-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={partSearch}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPartSearch(v);
                    if (v.trim().length < 2) { setPartResults([]); return; }
                    if (partSearchTimer.current) clearTimeout(partSearchTimer.current);
                    partSearchTimer.current = setTimeout(async () => {
                      try {
                        setPartSearchLoading(true);
                        const res = await fetch(`/api/businesses/${businessId}/cctv/serial-items?search=${encodeURIComponent(v.trim())}&status=IN_STOCK&limit=10`);
                        if (res.ok) {
                          const d = await res.json();
                          setPartResults(d.items || d || []);
                        }
                      } catch { /* silent */ }
                      finally { setPartSearchLoading(false); }
                    }, 300);
                  }}
                  placeholder="Search by product name or serial..."
                  className="w-full h-9 pl-8 pr-8 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <button
                  onClick={() => { setShowPartSearch(false); setPartSearch(''); setPartResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dropdown Results */}
              {partSearch.trim().length >= 2 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                  {partSearchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    </div>
                  ) : partResults.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">No spare parts found in stock</div>
                  ) : (
                    partResults.map((item) => {
                      const label = item.product ? `${item.product.brand} ${item.product.name}` : 'Unknown';
                      const isAdding = partAdding === item.id;
                      return (
                        <button
                          key={item.id}
                          disabled={isAdding}
                          onClick={async () => {
                            setPartAdding(item.id);
                            try {
                              const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}/parts`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ serialItemId: item.id }),
                              });
                              if (res.ok) {
                                const newPart = await res.json();
                                setParts((prev) => [newPart, ...prev]);
                                setPartSearch('');
                                setPartResults([]);
                                setShowPartSearch(false);
                                toast({ title: 'Part added', description: `${label} added to job` });
                                // Refresh job to update costs
                                fetchJob();
                              } else {
                                const err = await res.json();
                                toast({ title: 'Failed', description: err.error || 'Could not add part', variant: 'destructive' });
                              }
                            } catch {
                              toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
                            } finally {
                              setPartAdding(null);
                            }
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-violet-50 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 truncate">{label}</p>
                            <p className="text-[10px] text-gray-400">SN: {item.serialNumber}{item.costPrice != null ? ` · ৳${item.costPrice.toLocaleString()}` : ''}</p>
                          </div>
                          {isAdding ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500 shrink-0" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Parts List */}
          {parts.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No spare parts used yet</p>
          ) : (
            <div className="space-y-1.5">
              {parts.map((part) => {
                const pName = part.serialItem?.product
                  ? `${part.serialItem.product.brand} ${part.serialItem.product.name}`
                  : 'Unknown Part';
                const lineTotal = (part.unitCost ?? 0) * part.quantity;
                return (
                  <div
                    key={part.id}
                    className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-xl bg-gray-50 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{pName}</p>
                      <p className="text-[10px] text-gray-400">
                        SN: {part.serialItem?.serialNumber || '—'}
                        {part.quantity > 1 && ` · Qty: ${part.quantity}`}
                      </p>
                      {part.notes && (
                        <p className="text-[10px] text-gray-500 mt-0.5">{part.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-gray-700">{formatBDT(lineTotal)}</span>
                      {(job.status === 'DIAGNOSING' || job.status === 'AWAITING_PARTS' || job.status === 'IN_PROGRESS') && (
                        <button
                          disabled={partRemoving === part.id}
                          onClick={async () => {
                            setPartRemoving(part.id);
                            try {
                              const res = await fetch(`/api/businesses/${businessId}/cctv/job-cards/${contextId}/parts/${part.id}`, {
                                method: 'DELETE',
                              });
                              if (res.ok) {
                                setParts((prev) => prev.filter((p) => p.id !== part.id));
                                toast({ title: 'Part removed', description: `${pName} returned to stock` });
                                fetchJob();
                              } else {
                                toast({ title: 'Failed', description: 'Could not remove part', variant: 'destructive' });
                              }
                            } catch {
                              toast({ title: 'Error', variant: 'destructive' });
                            } finally {
                              setPartRemoving(null);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                        >
                          {partRemoving === part.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Parts Total */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Parts Total</span>
                <span className="text-sm font-bold text-violet-600">
                  {formatBDT(parts.reduce((sum, p) => sum + (p.unitCost ?? 0) * p.quantity, 0))}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* ─── 6.6 Secure Delivery Card (2D: OTP) ─── */}
        {job.status === 'READY_FOR_DELIVERY' && !editMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-800">Secure Delivery</h3>
                {job.otpVerified && (
                  <Badge className="text-[9px] px-1.5 py-0 h-5 bg-emerald-100 text-emerald-700 border-0 font-semibold">
                    Verified
                  </Badge>
                )}
              </div>
              {otpStep === 'idle' && (
                <span className="text-[10px] text-gray-400">OTP required</span>
              )}
            </div>

            {otpStep === 'idle' && (
              <div>
                <p className="text-xs text-gray-500 mb-3">Verify collector identity with OTP before marking this job as delivered.</p>
                <button
                  onClick={() => {
                    // Pre-fill collector from job data if available
                    if (job.collectorName) setCollectorName(job.collectorName);
                    if (job.collectorPhone) setCollectorPhone(job.collectorPhone);
                    if (job.collectorNid) setCollectorNid(job.collectorNid);
                    setOtpStep('collector-info');
                    setOtpCode('');
                    setOtpError('');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-transform"
                >
                  <KeyRound className="w-4 h-4" />
                  Start Delivery Verification
                </button>
              </div>
            )}

            {otpStep === 'collector-info' && (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-500">Enter the collector's details, then generate OTP.</p>
                <Input
                  placeholder="Collector Name *"
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="h-9 text-sm rounded-xl"
                />
                <Input
                  placeholder="Collector Phone"
                  value={collectorPhone}
                  onChange={(e) => setCollectorPhone(e.target.value)}
                  className="h-9 text-sm rounded-xl"
                />
                <Input
                  placeholder="Collector NID"
                  value={collectorNid}
                  onChange={(e) => setCollectorNid(e.target.value)}
                  className="h-9 text-sm rounded-xl"
                />
                {otpError && <p className="text-[11px] text-red-500">{otpError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={cancelOtpFlow}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 active:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateOtp}
                    disabled={otpLoading || !collectorName.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-semibold shadow-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
                  >
                    {otpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                    Generate OTP
                  </button>
                </div>
              </div>
            )}

            {otpStep === 'otp-input' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Enter OTP Code</p>
                    <p className="text-[10px] text-gray-400">6-digit code sent to collector</p>
                  </div>
                </div>

                {/* OTP Input with individual digit boxes */}
                <div
                  className="flex justify-center gap-2 cursor-text"
                  onClick={() => {
                    const el = document.querySelector<HTMLInputElement>('[data-otp-input]');
                    el?.focus();
                  }}
                >
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-10 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all select-none',
                        otpCode.length > i
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-gray-50 text-gray-300',
                        otpCode.length === i && 'border-violet-400 ring-2 ring-violet-100',
                      )}
                    >
                      {otpCode[i] || '·'}
                    </div>
                  ))}
                </div>

                {/* Actual OTP input - visually hidden but focusable */}
                <input
                  data-otp-input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(val);
                    setOtpError('');
                    // Auto-verify when 6 digits entered
                    if (val.length === 6) {
                      setTimeout(() => handleVerifyOtp(), 200);
                    }
                  }}
                  className="opacity-0 absolute w-0 h-0 overflow-hidden"
                  aria-label="OTP code"
                  autoFocus
                />

                {otpError && (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {otpError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={cancelOtpFlow}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 active:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otpCode.length !== 6}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
                  >
                    {otpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Verify OTP
                  </button>
                </div>
              </div>
            )}

            {otpStep === 'verified' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-800">Identity Verified</p>
                    <p className="text-[10px] text-emerald-600">
                      {job.collectorName || 'Collector'} · {job.collectorPhone || 'No phone'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleFinalDeliver}
                  disabled={otpLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white text-sm font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {otpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Delivery
                </button>
                <button
                  onClick={cancelOtpFlow}
                  className="w-full text-center text-[11px] text-gray-400 font-medium py-1 active:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── 7. Cost Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.23 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Cost</h3>
          </div>

          {editMode ? (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Estimated (৳)</p>
                <Input
                  type="number"
                  value={editForm.estimatedCost ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, estimatedCost: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                  placeholder="0"
                />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Labor (৳)</p>
                <Input
                  type="number"
                  value={editForm.laborCharge ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, laborCharge: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                  placeholder="0"
                />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Final (৳)</p>
                <Input
                  type="number"
                  value={editForm.finalCost ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, finalCost: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                  placeholder="0"
                />
              </div>
            </div>
          ) : (
            <>
              {job.estimatedCost == null && job.laborCharge == null && job.finalCost == null ? (
                <p className="text-xs text-gray-400">Not estimated yet</p>
              ) : (
                <div className="space-y-2">
                  {job.estimatedCost != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Estimated</span>
                      <span className="text-sm font-semibold text-gray-800">{formatBDT(job.estimatedCost)}</span>
                    </div>
                  )}
                  {job.laborCharge != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Labor Charge</span>
                      <span className="text-sm font-semibold text-gray-800">{formatBDT(job.laborCharge)}</span>
                    </div>
                  )}
                  {job.finalCost != null && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500 font-semibold">Final Cost</span>
                      <span className="text-lg font-bold text-emerald-600">{formatBDT(job.finalCost)}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* ─── Edit: Assignment & Priority & Internal Notes ─── */}
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Assignment &amp; More</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Assigned To</p>
                <Input
                  placeholder="Technician name"
                  value={(editForm.assignedToName as string) || ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, assignedToName: e.target.value }))}
                  className="h-9 text-sm rounded-xl"
                />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Priority</p>
                <select
                  value={(editForm.priority as string) || 'NORMAL'}
                  onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full h-9 text-sm rounded-xl border border-gray-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-gray-400 mb-1">Internal Notes</p>
              <Textarea
                placeholder="Internal notes (not visible to customer)..."
                value={(editForm.internalNotes as string) || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, internalNotes: e.target.value }))}
                className="min-h-[60px] text-sm rounded-xl"
              />
            </div>
          </motion.div>
        )}

        {/* ─── Read-only: Assigned / Priority / Internal Notes ─── */}
        {!editMode && (job.assignedToName || job.priority !== 'NORMAL' || job.internalNotes) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-violet-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Details</h3>
            </div>
            <div className="space-y-2">
              {job.assignedToName && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Assigned:</span>
                  <span className="text-xs font-semibold text-gray-800">{job.assignedToName}</span>
                </div>
              )}
              {job.priority !== 'NORMAL' && (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Priority:</span>
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                    job.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                    job.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600',
                  )}>
                    {job.priority}
                  </span>
                </div>
              )}
              {job.internalNotes && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <p className="text-[10px] text-gray-400 font-medium">Internal Notes</p>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{job.internalNotes}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── 8. Timeline ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-cyan-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Timeline</h3>
          </div>

          {statusHistory.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No timeline events</p>
          ) : (
            <div className="relative pl-5 space-y-4">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-gray-200" />

              {statusHistory.map((entry, i) => (
                <div key={i} className="relative">
                  {/* Dot */}
                  <div className={cn(
                    'absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm',
                    STATUS_BG[entry.status] || 'bg-gray-400',
                  )} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        STATUS_COLORS[entry.status] || 'bg-gray-100 text-gray-600',
                      )}>
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400">{formatDate(entry.date)}</span>
                    </div>
                    {entry.notes && (
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ─── Timestamps Footer ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32 }}
          className="px-1 space-y-1.5"
        >
          {job.diagnosedAt && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>Diagnosed:</span> {formatDate(job.diagnosedAt)}
            </div>
          )}
          {job.startedAt && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>Repair started:</span> {formatDate(job.startedAt)}
            </div>
          )}
          {job.testedAt && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>Tested:</span> {formatDate(job.testedAt)}
            </div>
          )}
          {job.readyAt && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>Ready:</span> {formatDate(job.readyAt)}
            </div>
          )}
          {job.outsourcedAt && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>Outsourced:</span> {formatDate(job.outsourcedAt)}
            </div>
          )}
          <div className="text-[10px] text-gray-300 pt-1">
            Created: {formatDate(job.createdAt)}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}