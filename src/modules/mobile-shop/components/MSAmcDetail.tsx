'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, Shield,
  Edit3, Plus, Loader2, AlertTriangle, XCircle, CheckCircle2,
  User, Wrench, FileText, Timer, Hash, ChevronRight,
  Banknote, Eye,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import type {
  MSAmcContract,
  MSAmcVisit,
  AmcStatus,
  AmcCoverageType,
  AmcPaymentFrequency,
  AmcVisitType,
} from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const fadeChild = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return '৳0';
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG: Record<AmcStatus, { badge: string; label: string }> = {
  ACTIVE: { badge: 'bg-emerald-100 text-emerald-700', label: 'Active' },
  EXPIRING_SOON: { badge: 'bg-amber-100 text-amber-700', label: 'Expiring Soon' },
  EXPIRED: { badge: 'bg-red-100 text-red-700', label: 'Expired' },
  CANCELLED: { badge: 'bg-gray-100 text-gray-500', label: 'Cancelled' },
};

const COVERAGE_CONFIG: Record<AmcCoverageType, { badge: string; label: string }> = {
  Basic: { badge: 'bg-gray-100 text-gray-600', label: 'Basic' },
  Standard: { badge: 'bg-cyan-100 text-cyan-700', label: 'Standard' },
  Premium: { badge: 'bg-amber-100 text-amber-700', label: 'Premium' },
};

const FREQ_LABELS: Record<AmcPaymentFrequency, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

const VISIT_TYPE_CONFIG: Record<AmcVisitType, { badge: string; label: string }> = {
  SCHEDULED: { badge: 'bg-cyan-100 text-cyan-700', label: 'Scheduled' },
  EMERGENCY: { badge: 'bg-red-100 text-red-700', label: 'Emergency' },
  RENEWAL: { badge: 'bg-emerald-100 text-emerald-700', label: 'Renewal' },
};

const COVERAGE_BENEFITS: Record<AmcCoverageType, { items: string[]; color: string }> = {
  Basic: {
    color: 'text-gray-600',
    items: [
      'Scheduled maintenance visits',
      'Basic fault diagnosis',
      'Phone support during business hours',
      'Standard response time SLA',
    ],
  },
  Standard: {
    color: 'text-cyan-600',
    items: [
      'All Basic benefits',
      'Priority response time SLA',
      'Parts at discounted rates',
      'Extended phone support hours',
      'Performance monitoring & reports',
      'Quarterly system health check',
    ],
  },
  Premium: {
    color: 'text-amber-600',
    items: [
      'All Standard benefits',
      '24/7 emergency support',
      'Free parts for covered items',
      'Dedicated technician assignment',
      'Monthly comprehensive reports',
      'Remote monitoring & alerts',
      'Annual system upgrade consultation',
    ],
  },
};

type TabKey = 'overview' | 'visits' | 'sla';
const TABS: { key: TabKey; label: string; icon: typeof Eye }[] = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'visits', label: 'Visits', icon: Wrench },
  { key: 'sla', label: 'SLA', icon: Shield },
];

export function MSAmcDetail() {
  const { contextId, goBack, navigate } = useMSNavStore();
  const businessId = useMSBusinessId();
  const { toast } = useToast();
  const [contract, setContract] = useState<(MSAmcContract & { daysRemaining?: number }) | null>(null);
  const [visits, setVisits] = useState<MSAmcVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Visit form state
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [technicianName, setTechnicianName] = useState('');
  const [visitType, setVisitType] = useState<AmcVisitType>('SCHEDULED');
  const [workPerformed, setWorkPerformed] = useState('');
  const [findings, setFindings] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  // Fetch contract
  useEffect(() => {
    if (!contextId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/amc-contracts/${contextId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setContract(data);
          if (data.visits) setVisits(data.visits);
        }
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [contextId]);

  const fetchVisits = async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/amc-contracts/${contextId}/visits`);
      if (res.ok) setVisits(await res.json());
    } catch { /* silent */ }
  };

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate) return;
    setSubmittingVisit(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/amc-contracts/${contextId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate,
          technicianName: technicianName.trim() || null,
          visitType,
          workPerformed: workPerformed.trim() || null,
          findings: findings.trim() || null,
          partsCost: Number(partsCost) || 0,
          visitNotes: visitNotes.trim() || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Visit logged successfully' });
        // Reset form
        setTechnicianName('');
        setVisitType('SCHEDULED');
        setWorkPerformed('');
        setFindings('');
        setPartsCost('');
        setVisitNotes('');
        setSheetOpen(false);
        // Refresh visits
        await fetchVisits();
        // Also refresh contract to update totalVisitsUsed
        const contractRes = await fetch(`/api/businesses/${businessId}/mobile-shop/amc-contracts/${contextId}`);
        if (contractRes.ok) setContract(await contractRes.json());
      } else {
        const err = await res.json();
        toast({ title: 'Failed to log visit', description: err.error || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmittingVisit(false);
  };

  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="flex-1 h-9 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!contract) {
    return (
      <motion.div {...fadeUp} className="text-center py-16">
        <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Contract not found</p>
        <button onClick={goBack} className="text-cyan-600 text-sm font-semibold mt-3">Go Back</button>
      </motion.div>
    );
  }

  const statusCfg = STATUS_CONFIG[contract.status as AmcStatus] || { badge: 'bg-gray-100 text-gray-500', label: contract.status };
  const coverageCfg = COVERAGE_CONFIG[contract.coverageType as AmcCoverageType] || { badge: 'bg-gray-100 text-gray-600', label: contract.coverageType };
  const revenuePercent = contract.totalAmount > 0 ? Math.min(100, (contract.totalRevenue / contract.totalAmount) * 100) : 0;

  // Visits summary
  const now = new Date();
  const thisMonthVisits = visits.filter((v) => {
    const vd = new Date(v.visitDate);
    return vd.getMonth() === now.getMonth() && vd.getFullYear() === now.getFullYear();
  });

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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900 truncate">{contract.contractCode}</h1>
            <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap', statusCfg.badge)}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{contract.clientName}</p>
        </div>
      </div>

      {/* Expiring Soon alert */}
      {contract.status === 'EXPIRING_SOON' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } }}
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3.5"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">Contract Expiring Soon</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {contract.daysRemaining != null && contract.daysRemaining > 0
                ? `${contract.daysRemaining} days remaining — ${fmtDate(contract.endDate)}`
                : `Expires on ${fmtDate(contract.endDate)}`}
            </p>
          </div>
        </motion.div>
      )}

      {/* Expired alert */}
      {contract.status === 'EXPIRED' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } }}
          className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-3.5"
        >
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Contract Expired</p>
            <p className="text-[11px] text-red-600 mt-0.5">
              Expired on {fmtDate(contract.endDate)}
            </p>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
                activeTab === tab.key
                  ? 'bg-white text-cyan-700 shadow-sm'
                  : 'text-gray-500',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* Client info card */}
          <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Information</h3>
              <button
                onClick={() => navigate('create-amc', contract.id)}
                className="text-cyan-600 active:scale-95 transition-transform"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-gray-800">{contract.clientName}</span>
              </div>
              {contract.clientPhone && (
                <a
                  href={`tel:${contract.clientPhone.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center gap-2.5"
                >
                  <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-sm text-gray-700">{contract.clientPhone}</span>
                </a>
              )}
              {contract.clientEmail && (
                <a
                  href={`mailto:${contract.clientEmail}`}
                  className="flex items-center gap-2.5"
                >
                  <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{contract.clientEmail}</span>
                </a>
              )}
              {contract.clientAddress && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{contract.clientAddress}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Contract details card */}
          <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contract Details</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <p className="text-[10px] text-gray-400">Coverage Type</p>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold mt-0.5 inline-block', coverageCfg.badge)}>
                  {coverageCfg.label}
                </span>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Payment Frequency</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{FREQ_LABELS[contract.paymentFrequency as AmcPaymentFrequency]}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Contract Period</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{fmtDate(contract.startDate)} — {fmtDate(contract.endDate)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Visits / Month</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{contract.visitsIncluded}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Contract Value</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{formatBDT(contract.totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Payment Amount</p>
                <p className="text-sm font-bold text-cyan-700 mt-0.5">{formatBDT(contract.paymentAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Response Time</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{contract.responseHours} hours</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Visits Used</p>
                <p className="text-xs font-medium text-gray-700 mt-0.5">{contract.totalVisitsUsed}</p>
              </div>
            </div>
          </motion.div>

          {/* Revenue tracking */}
          <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue Tracking</h3>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-[10px] text-gray-400">Collected</p>
                <p className="text-base font-bold text-gray-900">{formatBDT(contract.totalRevenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400">Contract Value</p>
                <p className="text-sm font-semibold text-gray-500">{formatBDT(contract.totalAmount)}</p>
              </div>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${revenuePercent}%`, transition: { duration: 0.6, ease: 'easeOut' as const } }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-gray-400">{revenuePercent.toFixed(0)}% collected</span>
              <span className="text-[10px] text-gray-400">{formatBDT(contract.totalAmount - contract.totalRevenue)} remaining</span>
            </div>
          </motion.div>

          {/* Edit button */}
          <Button
            onClick={() => navigate('create-amc', contract.id)}
            className={cn(
              'w-full h-11 rounded-2xl text-sm font-bold shadow-lg transition-all',
              'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/20',
              'hover:shadow-cyan-500/30 active:scale-[0.98]',
            )}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Contract
          </Button>
        </div>
      )}

      {/* ===== VISITS TAB ===== */}
      {activeTab === 'visits' && (
        <div className="space-y-3">
          {/* Visits summary */}
          <motion.div {...fadeChild} className="grid grid-cols-2 gap-2.5">
            <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
              <Wrench className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{visits.length}</p>
              <p className="text-[10px] text-gray-400 font-medium">Total Visits</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
              <Calendar className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{thisMonthVisits.length}</p>
              <p className="text-[10px] text-gray-400 font-medium">This Month</p>
            </div>
          </motion.div>

          {/* Visits list */}
          <div className="space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto ms-scrollbar">
            {visits.length === 0 ? (
              <div className="text-center py-10">
                <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No visits logged yet</p>
                <p className="text-xs text-gray-300 mt-1">Tap the + button to log a visit</p>
              </div>
            ) : (
              visits.map((visit, i) => {
                const vtCfg = VISIT_TYPE_CONFIG[visit.visitType as AmcVisitType] || { badge: 'bg-gray-100 text-gray-500', label: visit.visitType };
                return (
                  <motion.div
                    key={visit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03, ease: 'easeOut' as const } }}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{fmtDate(visit.visitDate)}</span>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', vtCfg.badge)}>
                            {vtCfg.label}
                          </span>
                        </div>
                        {visit.technicianName && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {visit.technicianName}
                          </p>
                        )}
                      </div>
                      {visit.partsCost > 0 && (
                        <span className="text-xs font-bold text-gray-600 shrink-0">
                          {formatBDT(visit.partsCost)}
                        </span>
                      )}
                    </div>
                    {visit.workPerformed && (
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">{visit.workPerformed}</p>
                    )}
                    {visit.findings && (
                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <p className="text-[10px] text-gray-400 font-medium mb-0.5">Findings</p>
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{visit.findings}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Log Visit FAB + Sheet */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1, transition: { delay: 0.2, duration: 0.3, ease: 'easeOut' as const } }}
                className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 flex items-center justify-center active:scale-95 transition-transform z-40"
              >
                <Plus className="w-6 h-6" />
              </motion.button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Log Visit</SheetTitle>
              </SheetHeader>
              <form onSubmit={handleSubmitVisit} className="space-y-4 px-4 pb-8">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-gray-500 mb-1 block">Visit Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="date"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-500 mb-1 block">Technician</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Name"
                        value={technicianName}
                        onChange={(e) => setTechnicianName(e.target.value)}
                        className="pl-10 h-10 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1.5 block">Visit Type</Label>
                  <div className="flex gap-2">
                    {(Object.entries(VISIT_TYPE_CONFIG) as [AmcVisitType, { badge: string; label: string }][]).map(([val, cfg]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setVisitType(val)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-semibold transition-all border-2',
                          visitType === val
                            ? cn(cfg.badge, 'border-current ring-2 ring-offset-1')
                            : 'bg-gray-50 text-gray-500 border-gray-100',
                        )}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Work Performed</Label>
                  <Textarea
                    placeholder="Summary of work done during the visit..."
                    value={workPerformed}
                    onChange={(e) => setWorkPerformed(e.target.value)}
                    className="min-h-[72px] text-sm rounded-xl resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Findings</Label>
                  <Textarea
                    placeholder="Any issues or observations found..."
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    className="min-h-[56px] text-sm rounded-xl resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Parts Cost (BDT)</Label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={partsCost}
                      onChange={(e) => setPartsCost(e.target.value)}
                      className="pl-14 h-10 rounded-xl"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    className="min-h-[48px] text-sm rounded-xl resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submittingVisit || !visitDate}
                  className={cn(
                    'w-full h-12 rounded-2xl text-sm font-bold shadow-lg transition-all',
                    'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-cyan-500/20',
                    'hover:shadow-cyan-500/30 active:scale-[0.98]',
                    (submittingVisit || !visitDate) && 'opacity-60 pointer-events-none',
                  )}
                >
                  {submittingVisit ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Log Visit'
                  )}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ===== SLA TAB ===== */}
      {activeTab === 'sla' && (
        <div className="space-y-3">
          {/* Response time */}
          <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                <Timer className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Response Time SLA</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Maximum <span className="font-bold text-cyan-600">{contract.responseHours} hours</span> response time
                </p>
              </div>
            </div>
          </motion.div>

          {/* Coverage benefits */}
          <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {coverageCfg.label} Coverage Benefits
              </h3>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', coverageCfg.badge)}>
                {coverageCfg.label}
              </span>
            </div>
            <div className="space-y-2">
              {COVERAGE_BENEFITS[contract.coverageType as AmcCoverageType]?.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* SLA terms */}
          {contract.slaTerms ? (
            <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SLA Terms</h3>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{contract.slaTerms}</p>
            </motion.div>
          ) : (
            <motion.div {...fadeChild} className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No SLA terms defined</p>
              <p className="text-xs text-gray-300 mt-1">Edit the contract to add SLA terms</p>
            </motion.div>
          )}

          {/* Service details */}
          <motion.div {...fadeChild} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Service Parameters</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Visits per month</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{contract.visitsIncluded}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Response time</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{contract.responseHours}h</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Payment frequency</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{FREQ_LABELS[contract.paymentFrequency as AmcPaymentFrequency]}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Payment amount</span>
                </div>
                <span className="text-sm font-bold text-cyan-700">{formatBDT(contract.paymentAmount)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}