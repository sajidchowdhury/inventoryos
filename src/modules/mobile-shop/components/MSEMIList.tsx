'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Search, ChevronRight, Calendar, Phone,
  CreditCard, AlertTriangle, Clock, CheckCircle2, XCircle, TrendingUp,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { MSEmiPlan, EmiStatus } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Defaulted', value: 'DEFAULTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-cyan-100 text-cyan-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DEFAULTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MSEMIList() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();
  const [allPlans, setAllPlans] = useState<MSEmiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchPlans = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeFilter && !['OVERDUE'].includes(activeFilter)) params.set('status', activeFilter);
        if (search) params.set('search', search);
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/emi-plans?${params}`);
        if (res.ok && !cancelled) setAllPlans(await res.json());
      } catch {}
      if (!cancelled) setLoading(false);
    };
    fetchPlans();
    return () => { cancelled = true; };
  }, [activeFilter, search]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Client-side filter for OVERDUE (needs installment-level check)
  const plans = useMemo(() => {
    let filtered = allPlans;
    if (activeFilter === 'OVERDUE') {
      filtered = filtered.filter((p) => p.status === 'ACTIVE');
      // Plans with overdueCount > 0 will be shown — the API returns this
    }
    return filtered;
  }, [allPlans, activeFilter]);

  const activePlans = allPlans.filter((p) => p.status === 'ACTIVE');
  const totalRemaining = activePlans.reduce((s, p) => s + p.remainingAmount, 0);
  const overdueCount = allPlans.filter((p) => {
    // Count plans that have overdue installments
    return (p as MSEmiPlan & { overdueCount?: number }).overdueCount > 0;
  }).length;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">EMI Plans</h1>
        <span className="text-xs text-gray-400 font-medium">{allPlans.length}</span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('create-emi')}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Stats banner */}
      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-cyan-500/20">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-bold">{activePlans.length}</p>
            <p className="text-[10px] text-white/70">Active</p>
          </div>
          <div>
            <p className="text-xl font-bold">
              {totalRemaining >= 1000
                ? `৳${(totalRemaining / 1000).toFixed(1)}k`
                : `৳${totalRemaining.toLocaleString()}`}
            </p>
            <p className="text-[10px] text-white/70">Remaining</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{overdueCount}</p>
            <p className="text-[10px] text-white/70">Overdue</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search customer, product..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === tab.value
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plan list */}
      <div className="space-y-2.5 max-h-[calc(100vh-340px)] overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))
        ) : plans.length === 0 ? (
          <div className="text-center py-10">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No EMI plans found</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeFilter || search ? 'Try a different filter' : 'Create your first EMI plan'}
            </p>
            {!activeFilter && !search && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('create-emi')}
                className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20"
              >
                Create EMI Plan
              </motion.button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {plans.map((plan, i) => {
              const progress = plan.months > 0 ? (plan.paidInstallments / plan.months) * 100 : 0;
              const isOverdue = (plan as MSEmiPlan & { overdueCount?: number }).overdueCount > 0;

              return (
                <motion.button
                  key={plan.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03 } }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => navigate('emi-detail', plan.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', STATUS_COLORS[plan.status])}>
                          {isOverdue && plan.status === 'ACTIVE' ? 'OVERDUE' : plan.status}
                        </span>
                        {isOverdue && plan.status === 'ACTIVE' && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">{plan.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{plan.productBrand ? `${plan.productBrand} ` : ''}{plan.productName}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400">
                        {plan.paidInstallments}/{plan.months} paid
                      </span>
                      <span className="text-[10px] text-gray-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                        className={cn(
                          'h-full rounded-full',
                          plan.status === 'COMPLETED' ? 'bg-green-500' :
                          isOverdue ? 'bg-red-500' :
                          'bg-cyan-500'
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-gray-400" />
                      <span className="text-[11px] font-semibold text-gray-700">৳{plan.monthlyPayment.toLocaleString()}/mo</span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-900">
                      ৳{plan.remainingAmount.toLocaleString()} left
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}