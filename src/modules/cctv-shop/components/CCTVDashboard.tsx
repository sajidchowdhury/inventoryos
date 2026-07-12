'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  FileText,
  CreditCard,
  Building2,
  ArrowUpRight,
  Copy,
  Check,
  Package,
  Truck,
  Users,
  ClipboardCheck,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Star,
  HardDrive,
  BookOpen,
  Receipt,
  Calculator,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { OfflinePill } from './OfflineIndicator';

const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export function CCTVDashboard() {
  const session = useAuthStore((s) => s.session);
  const { navigate } = useCCTVNavStore();
  const [copied, setCopied] = React.useState(false);

  // Overview carousel state
  const [overviewIndex, setOverviewIndex] = React.useState(0);

  // 2E: Outsourced job tracking
  const [outsourceAlerts, setOutsourceAlerts] = React.useState<{ total: number; overdue: number }>({ total: 0, overdue: 0 });

  // 3D: Warranty expiring alerts
  const [warrantyAlerts, setWarrantyAlerts] = React.useState<{ expiringSoon: number; expired: number; pendingClaims: number }>({ expiringSoon: 0, expired: 0, pendingClaims: 0 });

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${session.business.id}/cctv/job-cards?status=OUTSOURCED&limit=100`);
        if (res.ok) {
          const jobs = await res.json();
          const overdue = jobs.filter((j: { expectedReturn: string | null }) =>
            j.expectedReturn && new Date(j.expectedReturn) < new Date()
          ).length;
          setOutsourceAlerts({ total: jobs.length, overdue });
        }
      } catch { /* silent */ }

      try {
        const res = await fetch(`/api/businesses/${session.business.id}/cctv/warranties/summary`);
        if (res.ok) {
          const data = await res.json();
          setWarrantyAlerts({
            expiringSoon: data.expiringSoon || 0,
            expired: data.expired || 0,
            pendingClaims: data.claims?.pending || 0,
          });
        }
      } catch { /* silent */ }
    })();
  }, []);

  const shopCode = session?.business.shopCode || 'CCTV-001';
  const shopName = session?.business.name || 'My CCTV Shop';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shopCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Data ── */

  const reports = [
    { label: 'Sales Report', icon: TrendingUp, gradient: 'from-violet-500 to-purple-600', view: 'sales-history' as const },
    { label: 'Due Book', icon: BookOpen, gradient: 'from-rose-500 to-pink-600', view: 'due-book' as const },
    { label: 'Purchase Report', icon: Receipt, gradient: 'from-amber-500 to-orange-600', view: 'purchase-orders' as const },
  ];

  const row1 = [
    { label: 'Job Cards', icon: ClipboardCheck, view: 'job-cards' as const, gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-500/20' },
    { label: 'AMC', icon: ShieldCheck, view: 'amc' as const, gradient: 'from-teal-400 to-emerald-500', ring: 'ring-teal-500/20' },
    { label: 'Projects', icon: Building2, view: 'projects' as const, gradient: 'from-cyan-400 to-blue-500', ring: 'ring-cyan-500/20' },
    { label: 'Tasks', icon: Calculator, view: 'installation-tasks' as const, gradient: 'from-fuchsia-400 to-purple-500', ring: 'ring-fuchsia-500/20' },
  ];

  const row2 = [
    { label: 'EMI Sales', icon: CreditCard, view: 'emi' as const, gradient: 'from-pink-400 to-rose-500', ring: 'ring-pink-500/20' },
    { label: 'Warranties', icon: ShieldCheck, view: 'warranties' as const, gradient: 'from-emerald-400 to-green-500', ring: 'ring-emerald-500/20' },
    { label: 'Loyalty', icon: Star, view: 'loyalty-center' as const, gradient: 'from-yellow-400 to-amber-500', ring: 'ring-yellow-500/20' },
    { label: 'Storage Calc', icon: HardDrive, view: 'storage-calculator' as const, gradient: 'from-slate-400 to-gray-500', ring: 'ring-slate-500/20' },
  ];

  const overviewCards = [
    {
      title: 'Active Projects',
      description: 'Track ongoing installations & maintenance',
      icon: Building2,
      gradient: 'from-cyan-500 to-blue-600',
      shadow: 'shadow-cyan-500/20',
      view: 'projects' as const,
      tag: 'Manage',
    },
    {
      title: 'Client Dues',
      description: 'View pending client payments & follow ups',
      icon: Users,
      gradient: 'from-pink-500 to-rose-600',
      shadow: 'shadow-pink-500/20',
      view: 'emi' as const,
      tag: 'Follow Up',
    },
    {
      title: 'Supplier Orders',
      description: 'Track purchase orders & expected deliveries',
      icon: Truck,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/20',
      view: 'purchase-orders' as const,
      tag: 'Track',
    },
    {
      title: 'Warranty Status',
      description: 'Check expiring warranties & claims',
      icon: ShieldCheck,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/20',
      view: 'warranties' as const,
      tag: 'Review',
    },
    {
      title: 'AMC Renewals',
      description: 'Upcoming contract renewals & visits',
      icon: ClipboardCheck,
      gradient: 'from-violet-500 to-purple-600',
      shadow: 'shadow-violet-500/20',
      view: 'amc' as const,
      tag: 'Renew',
    },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="pb-24"
    >
      {/* ── Header Banner ── */}
      <motion.div
        variants={fadeUp}
        className="cctv-bg relative overflow-hidden rounded-b-3xl px-5 pt-12 pb-8"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white/70 text-xs font-medium">Welcome back</p>
                <OfflinePill />
              </div>
              <h1 className="text-xl font-bold text-white mt-0.5">{shopName}</h1>
            </div>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
              <span className="text-[10px] text-white/60 font-medium">SHOP CODE</span>
              <span className="text-xs font-mono font-bold text-white">{shopCode}</span>
              <button onClick={handleCopyCode} className="text-white/70 hover:text-white">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-10 w-20 h-20 bg-white/5 rounded-full translate-y-1/2" />
      </motion.div>

      <div className="px-4 pt-5 space-y-6">

        {/* ── Quick Reports ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">Quick Reports</h2>
            <div className="flex-1 h-px bg-gray-100" />
            <button onClick={() => navigate('reports')} className="text-[11px] text-violet-600 font-semibold flex items-center gap-0.5">
              All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {reports.map((r) => {
              const Icon = r.icon;
              return (
                <motion.button
                  key={r.label}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(r.view)}
                  className="group relative flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  {/* Hover glow */}
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 group-active:opacity-100 transition-opacity duration-200', r.gradient)} />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', r.gradient)}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-gray-800 group-active:text-white">{r.label}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Row 1: Operations ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">Operations</h2>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {row1.map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => navigate(item.view)}
                  className="flex flex-col items-center gap-2.5 py-4 rounded-2xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] active:shadow-md transition-all"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md ring-1',
                    item.gradient,
                    item.ring,
                  )}>
                    <Icon className="w-5.5 h-5.5 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 leading-tight">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Row 2: Management ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">Management</h2>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {row2.map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => navigate(item.view)}
                  className="flex flex-col items-center gap-2.5 py-4 rounded-2xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] active:shadow-md transition-all"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-md ring-1',
                    item.gradient,
                    item.ring,
                  )}>
                    <Icon className="w-5.5 h-5.5 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 leading-tight">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── 2E: Outsourced Repair Alert ── */}
        {outsourceAlerts.total > 0 && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('job-cards')}
              className={cn(
                'w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left active:scale-[0.98] transition-transform',
                outsourceAlerts.overdue > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                outsourceAlerts.overdue > 0 ? 'bg-red-100' : 'bg-orange-100',
              )}>
                {outsourceAlerts.overdue > 0
                  ? <AlertTriangle className="w-5 h-5 text-red-600" />
                  : <Building2 className="w-5 h-5 text-orange-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900">
                  {outsourceAlerts.overdue > 0
                    ? `${outsourceAlerts.overdue} Overdue Vendor Return${outsourceAlerts.overdue > 1 ? 's' : ''}`
                    : `${outsourceAlerts.total} Job${outsourceAlerts.total > 1 ? 's' : ''} Outsourced`}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {outsourceAlerts.overdue > 0
                    ? `Expected return date passed for ${outsourceAlerts.overdue > 1 ? 'some jobs' : 'a job'}`
                    : 'Track vendor repair progress'}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          </motion.div>
        )}

        {/* ── 3D: Warranty Alerts ── */}
        {(warrantyAlerts.expiringSoon > 0 || warrantyAlerts.expired > 0 || warrantyAlerts.pendingClaims > 0) && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('warranties')}
              className={cn(
                'w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left active:scale-[0.98] transition-transform',
                warrantyAlerts.expired > 0 || warrantyAlerts.pendingClaims > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                warrantyAlerts.expired > 0 || warrantyAlerts.pendingClaims > 0 ? 'bg-red-100' : 'bg-amber-100',
              )}>
                <ShieldCheck className={cn('w-5 h-5', warrantyAlerts.expired > 0 || warrantyAlerts.pendingClaims > 0 ? 'text-red-600' : 'text-amber-600')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900">
                  {warrantyAlerts.pendingClaims > 0
                    ? `${warrantyAlerts.pendingClaims} Pending Warranty Claim${warrantyAlerts.pendingClaims > 1 ? 's' : ''}`
                    : warrantyAlerts.expired > 0
                      ? `${warrantyAlerts.expired} Expired Warranty${warrantyAlerts.expired > 1 ? 'ies' : 'y'}`
                      : `${warrantyAlerts.expiringSoon} Warranty Expiring Soon`}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {warrantyAlerts.pendingClaims > 0
                    ? 'Action required on pending claims'
                    : warrantyAlerts.expired > 0
                      ? `${warrantyAlerts.expired} item${warrantyAlerts.expired > 1 ? 's have' : ' has'} expired warranty`
                      : 'Review and notify customers'}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          </motion.div>
        )}

        {/* ── CCTV Overview — Single Row Carousel ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-cyan-500 to-blue-600" />
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">Overview</h2>
            <div className="flex-1 h-px bg-gray-100" />
            {/* Dots indicator */}
            <div className="flex items-center gap-1">
              {overviewCards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setOverviewIndex(i)}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all',
                    i === overviewIndex ? 'bg-violet-500 w-4' : 'bg-gray-300 hover:bg-gray-400'
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Left arrow */}
            <button
              onClick={() => setOverviewIndex((prev) => (prev === 0 ? overviewCards.length - 1 : prev - 1))}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>

            {/* Card viewport */}
            <div className="flex-1 overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out gap-3"
                style={{ transform: `translateX(-${overviewIndex * 100}%)` }}
              >
                {overviewCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="min-w-full"
                    >
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(card.view)}
                        className="w-full rounded-2xl text-left active:scale-[0.97] transition-transform"
                      >
                        <div className={cn('rounded-2xl bg-gradient-to-br p-4 shadow-lg relative overflow-hidden', card.gradient)}>
                          {/* Decorative circle */}
                          <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
                          <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-white/5 rounded-full" />

                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-5">
                              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <span className="text-[10px] font-semibold text-white/80 bg-white/15 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                {card.tag}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-white leading-tight">{card.title}</p>
                            <p className="text-[11px] text-white/70 mt-1 leading-relaxed">{card.description}</p>
                            <div className="flex items-center gap-1 mt-3">
                              <span className="text-[11px] font-semibold text-white/90">Open</span>
                              <ArrowRight className="w-3 h-3 text-white/70" />
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right arrow */}
            <button
              onClick={() => setOverviewIndex((prev) => (prev === overviewCards.length - 1 ? 0 : prev + 1))}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </motion.div>

        {/* ── Inventory Quick Access ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600" />
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">Inventory</h2>
            <div className="flex-1 h-px bg-gray-100" />
            <button onClick={() => navigate('inventory-hub')} className="text-[11px] text-violet-600 font-semibold flex items-center gap-0.5">
              All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[
              { label: 'Products', desc: 'Manage catalog', icon: Package, gradient: 'from-blue-500 to-indigo-600', view: 'products' as const },
              { label: 'Serial Items', desc: 'Track by serial', icon: Sparkles, gradient: 'from-violet-500 to-purple-600', view: 'serial-items' as const },
              { label: 'Suppliers', desc: 'Vendor management', icon: Truck, gradient: 'from-amber-500 to-orange-600', view: 'suppliers' as const },
              { label: 'Categories', desc: 'Organize items', icon: BarChart3, gradient: 'from-emerald-500 to-teal-600', view: 'inventory-hub' as const },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(item.view)}
                  className="group relative flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-left overflow-hidden"
                >
                  {/* Hover glow */}
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 group-active:opacity-100 transition-opacity duration-200', item.gradient)} />
                  <div className="relative z-10 flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', item.gradient)}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 group-active:text-white">{item.label}</p>
                      <p className="text-[10px] text-gray-400 group-active:text-white/70">{item.desc}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}