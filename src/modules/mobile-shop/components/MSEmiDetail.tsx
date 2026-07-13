'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Package, Calendar, Percent, Clock,
  CreditCard, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Hash, ChevronDown, ChevronUp, Banknote,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { MSEmiPlan, MSEmiInstallment } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const INST_STATUS: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  PENDING: { color: 'bg-slate-100 text-slate-600', icon: Clock, label: 'Pending' },
  PAID: { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Paid' },
  OVERDUE: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Overdue' },
  WAIVED: { color: 'bg-amber-100 text-amber-700', icon: XCircle, label: 'Waived' },
};

const PLAN_STATUS_BG: Record<string, string> = {
  ACTIVE: 'bg-gradient-to-br from-cyan-500 to-blue-600',
  COMPLETED: 'bg-gradient-to-br from-green-500 to-emerald-600',
  DEFAULTED: 'bg-gradient-to-br from-red-500 to-rose-600',
  CANCELLED: 'bg-gradient-to-br from-slate-400 to-slate-500',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MSEmiDetail() {
  const { contextId, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();
  const { toast } = useToast();
  const [plan, setPlan] = useState<(MSEmiPlan & { overdueCount?: number; nextDueDate?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showInstallments, setShowInstallments] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!contextId) return;
      try {
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/emi-plans/${contextId}`);
        if (res.ok && !cancelled) setPlan(await res.json());
      } catch {}
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [contextId]);

  const handleCollect = async (installment: MSEmiInstallment) => {
    setCollectingId(installment.id);
    setCollectAmount(String(installment.dueAmount));
  };

  const submitCollect = async () => {
    if (!collectingId) return;
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setCollecting(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/emi-plans/${contextId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installmentId: collectingId, amount }),
      });
      if (res.ok) {
        toast({ title: 'Payment collected!' });
        setCollectingId(null);
        // Refresh plan data
        try {
          const ref = await fetch(`/api/businesses/${businessId}/mobile-shop/emi-plans/${contextId}`);
          if (ref.ok) setPlan(await ref.json());
        } catch {}
      } else {
        const err = await res.json();
        toast({ title: err.error || 'Failed to collect', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setCollecting(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-gray-400">EMI plan not found</p>
      </div>
    );
  }

  const progress = plan.months > 0 ? (plan.paidInstallments / plan.months) * 100 : 0;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">{plan.customerName}</h1>
      </div>

      {/* Status card */}
      <div className={cn('rounded-2xl p-4 text-white shadow-lg', PLAN_STATUS_BG[plan.status] || 'bg-slate-500')}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">{plan.status}</span>
          {plan.status === 'COMPLETED' && plan.completedAt && (
            <span className="text-[10px] text-white/70">Completed {fmtDate(plan.completedAt)}</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-white/60">Total</p>
            <p className="text-sm font-bold">৳{plan.grandTotal.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/60">Paid</p>
            <p className="text-sm font-bold text-green-200">৳{plan.paidAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/60">Remaining</p>
            <p className="text-sm font-bold">{plan.status === 'COMPLETED' ? '৳0' : `৳${plan.remainingAmount.toLocaleString()}`}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-white/60 mb-1">
            <span>{plan.paidInstallments} of {plan.months} installments</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.6 }}
              className="h-full rounded-full bg-white/80"
            />
          </div>
        </div>
      </div>

      {/* Plan info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Plan Details</h3>
          <span className="text-[10px] text-gray-400">{plan.months} months</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-500 truncate">{plan.productBrand ? `${plan.productBrand} ` : ''}{plan.productName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            <a href={`tel:${plan.customerPhone}`} className="text-cyan-600 font-medium">{plan.customerPhone}</a>
          </div>
          {plan.interestRate > 0 && (
            <div className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-600">{plan.interestRate}% interest</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-600 font-semibold">৳{plan.monthlyPayment.toLocaleString()}/mo</span>
          </div>
          {plan.downPayment > 0 && (
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-600">Down: ৳{plan.downPayment.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-600">Started {fmtDate(plan.startDate)}</span>
          </div>
        </div>
        {plan.totalInterest > 0 && (
          <p className="text-[11px] text-gray-400 border-t border-gray-50 pt-2">
            Total interest: ৳{plan.totalInterest.toLocaleString()} | Financed: ৳{plan.financedAmount.toLocaleString()}
          </p>
        )}
        {plan.notes && (
          <p className="text-[11px] text-gray-400 italic">{plan.notes}</p>
        )}
      </div>

      {/* Installment schedule */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowInstallments(!showInstallments)}
          className="w-full flex items-center justify-between p-4"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            Installment Schedule ({plan.months} months)
          </h3>
          {showInstallments ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showInstallments && plan.installments && (
          <div className="px-4 pb-4 max-h-80 overflow-y-auto space-y-2">
            {plan.installments.map((inst) => {
              const st = INST_STATUS[inst.status] || INST_STATUS.PENDING;
              const StIcon = st.icon;
              const isCollectible = inst.status === 'PENDING' || inst.status === 'OVERDUE';

              return (
                <motion.div
                  key={inst.id}
                  layout
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    isCollectible ? 'border-cyan-100 bg-cyan-50/30' : 'border-gray-50 bg-gray-50/50',
                    collectingId === inst.id && 'ring-2 ring-cyan-400'
                  )}
                >
                  {collectingId === inst.id ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Collect #{inst.installmentNo} — ৳{inst.dueAmount.toLocaleString()}</p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={collectAmount}
                          onChange={(e) => setCollectAmount(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Amount"
                        />
                        <button
                          onClick={submitCollect}
                          disabled={collecting}
                          className="h-8 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shrink-0 disabled:opacity-50"
                        >
                          {collecting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Collect'}
                        </button>
                        <button
                          onClick={() => setCollectingId(null)}
                          className="h-8 px-2 rounded-lg bg-gray-200 text-gray-600 text-xs shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                          <Hash className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">#{inst.installmentNo}</span>
                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-semibold', st.color)}>
                              <StIcon className="w-2.5 h-2.5 inline -mt-0.5" /> {st.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400">{fmtDate(inst.dueDate)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-900">৳{inst.dueAmount.toLocaleString()}</p>
                          {inst.status === 'PAID' && inst.paidAt && (
                            <p className="text-[9px] text-gray-400">
                              Paid {fmtDate(inst.paidAt)}{inst.receivedBy ? ` by ${inst.receivedBy}` : ''}
                            </p>
                          )}
                        </div>
                        {isCollectible && (
                          <button
                            onClick={() => handleCollect(inst)}
                            className="px-2 py-1 rounded-lg bg-cyan-100 text-cyan-700 text-[10px] font-semibold hover:bg-cyan-200 transition-colors"
                          >
                            Collect
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions for ACTIVE */}
      {plan.status === 'ACTIVE' && (
        <div className="space-y-2">
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-3 rounded-2xl border border-red-200 text-red-600 text-sm font-semibold active:bg-red-50 transition-colors"
          >
            Cancel EMI Plan
          </button>
        </div>
      )}

      {/* Cancel dialog */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel EMI Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the EMI plan for {plan.customerName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => toast({ title: 'Cancel not implemented yet (API pending)' })}>
              Cancel Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}