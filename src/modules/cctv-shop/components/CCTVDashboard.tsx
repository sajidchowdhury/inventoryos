'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Plus,
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
  Landmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { OfflinePill } from './OfflineIndicator';

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVDashboard() {
  const session = useAuthStore((s) => s.session);
  const { navigate } = useCCTVNavStore();
  const [copied, setCopied] = React.useState(false);

  // 2E: Outsourced job tracking
  const [outsourceAlerts, setOutsourceAlerts] = React.useState<{ total: number; overdue: number }>({ total: 0, overdue: 0 });

  // 3D: Warranty expiring alerts
  const [warrantyAlerts, setWarrantyAlerts] = React.useState<{ expiringSoon: number; expired: number; pendingClaims: number }>({ expiringSoon: 0, expired: 0, pendingClaims: 0 });

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/businesses/bus_placeholder/cctv/job-cards?status=OUTSOURCED&limit=100');
        if (res.ok) {
          const jobs = await res.json();
          const overdue = jobs.filter((j: { expectedReturn: string | null }) =>
            j.expectedReturn && new Date(j.expectedReturn) < new Date()
          ).length;
          setOutsourceAlerts({ total: jobs.length, overdue });
        }
      } catch { /* silent */ }

      try {
        const res = await fetch('/api/businesses/bus_placeholder/cctv/warranties/summary');
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

  const reportShortcuts = [
    { label: 'Sales Report', icon: TrendingUp, color: 'border-l-violet-500', bg: 'bg-violet-50', iconColor: 'text-violet-600' },
    { label: 'Mushak Report', icon: FileText, color: 'border-l-red-500', bg: 'bg-red-50', iconColor: 'text-red-600' },
    { label: 'EMI Report', icon: CreditCard, color: 'border-l-amber-500', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
    { label: 'Project Report', icon: Building2, color: 'border-l-cyan-500', bg: 'bg-cyan-50', iconColor: 'text-cyan-600' },
  ];

  const quickActions = [
    { label: 'New Sale', icon: ShoppingCart, view: 'new-sale' as const, color: 'bg-green-500' },
    { label: 'Sales History', icon: TrendingUp, view: 'sales-history' as const, color: 'bg-violet-500' },
    { label: 'New Product', icon: Plus, view: 'add-product' as const, color: 'bg-blue-500' },
    { label: 'Job Card', icon: ClipboardCheck, view: 'create-job-card' as const, color: 'bg-amber-500' },
    { label: 'New AMC', icon: ShieldCheck, view: 'create-amc' as const, color: 'bg-teal-500' },
    { label: 'Projects', icon: Building2, view: 'projects' as const, color: 'bg-cyan-500' },
    { label: 'Tasks', icon: ClipboardCheck, view: 'installation-tasks' as const, color: 'bg-indigo-500' },
    { label: 'EMI Sales', icon: CreditCard, view: 'emi' as const, color: 'bg-pink-500' },
    { label: 'Warranties', icon: ShieldCheck, view: 'warranties' as const, color: 'bg-emerald-500' },
    { label: 'Customers', icon: Users, view: 'customers' as const, color: 'bg-orange-500' },
    { label: 'Loyalty', icon: Star, view: 'loyalty-center' as const, color: 'bg-fuchsia-500' },
    { label: 'Storage Calc', icon: HardDrive, view: 'storage-calculator' as const, color: 'bg-slate-500' },
    { label: 'NBR Setup', icon: Landmark, view: 'nbr-setup' as const, color: 'bg-amber-600' },
    { label: 'All Reports', icon: BarChart3, view: 'reports' as const, color: 'bg-purple-500' },
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

      <div className="px-4 -mt-4 space-y-5">
        {/* ── New Sale CTA ── */}
        <motion.div variants={fadeUp}>
          <button
            onClick={() => navigate('sell')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-transform"
          >
            <ShoppingCart className="w-4 h-4" />
            New Sale
          </button>
        </motion.div>

        {/* ── Quick Reports ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Quick Reports</h2>
            <button onClick={() => navigate('reports')} className="text-xs text-violet-600 font-medium">
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {reportShortcuts.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.label}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-l-4 text-left active:scale-[0.97] transition-transform',
                    report.bg,
                    report.color,
                  )}
                >
                  <Icon className={cn('w-4 h-4', report.iconColor)} />
                  <span className="text-xs font-semibold text-gray-800">{report.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Quick Actions ── */}
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.view)}
                  className="flex flex-col items-center gap-2 py-3 active:scale-95 transition-transform"
                >
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm', action.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 leading-tight text-center">
                    {action.label}
                  </span>
                </button>
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

        {/* ── CCTV Overview — Scrollable Cards ── */}
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Overview</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.title}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(card.view)}
                  className="min-w-[180px] flex-shrink-0 rounded-2xl bg-gradient-to-br p-4 text-left shadow-lg active:scale-[0.97] transition-transform"
                  style={{ boxShadow: `0 8px 24px var(--tw-shadow-opacity, 0.15)` }}
                >
                  <div className={cn('rounded-2xl bg-gradient-to-br p-4 text-left shadow-lg relative overflow-hidden', card.gradient)}>
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
              );
            })}
          </div>
        </motion.div>

        {/* ── Quick Stock Access ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Inventory</h2>
            <button onClick={() => navigate('inventory-hub')} className="text-xs text-violet-600 font-medium">
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Products', desc: 'Manage catalog', icon: Package, bg: 'bg-blue-50', iconColor: 'text-blue-600', view: 'products' as const },
              { label: 'Serial Items', desc: 'Track by serial', icon: Sparkles, bg: 'bg-violet-50', iconColor: 'text-violet-600', view: 'serial-items' as const },
              { label: 'Suppliers', desc: 'Vendor management', icon: Truck, bg: 'bg-amber-50', iconColor: 'text-amber-600', view: 'suppliers' as const },
              { label: 'Categories', desc: 'Organize items', icon: BarChart3, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', view: 'inventory-hub' as const },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.view)}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm text-left active:scale-[0.97] transition-transform"
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', item.bg)}>
                    <Icon className={cn('w-4 h-4', item.iconColor)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}