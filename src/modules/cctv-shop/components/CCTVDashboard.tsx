'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  Hash,
  Shield,
  Wrench,
  TrendingUp,
  FileText,
  CreditCard,
  Building2,
  ArrowUpRight,
  Copy,
  Check,
  ShoppingCart,
  Plus,
  BarChart3,
  AlertTriangle,
  Clock,
  Activity,
  Banknote,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';

const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const recentActivities = [
  {
    id: 1,
    text: 'Sale completed — Hikvision DS-2CD2143',
    time: '2 min ago',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 2,
    text: 'New stock added — Dahua NVR 32ch ×5',
    time: '18 min ago',
    dotColor: 'bg-blue-500',
  },
  {
    id: 3,
    text: 'Job Card #47 — Installation at City Mall',
    time: '1 hr ago',
    dotColor: 'bg-amber-500',
  },
  {
    id: 4,
    text: 'Warranty claim filed — TP-Link Tapo C320WS',
    time: '3 hr ago',
    dotColor: 'bg-red-500',
  },
];

export function CCTVDashboard() {
  const session = useAuthStore((s) => s.session);
  const { navigate } = useCCTVNavStore();
  const [copied, setCopied] = React.useState(false);

  const shopCode = session?.business.shopCode || 'CCTV-001';
  const shopName = session?.business.name || 'My CCTV Shop';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shopCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: 'Products', value: '524', icon: Package, lightColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { label: 'Serial Items', value: '2,147', icon: Hash, lightColor: 'bg-violet-50', textColor: 'text-violet-600' },
    { label: 'Warranties', value: '89', icon: Shield, lightColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
    { label: 'Job Cards', value: '34', icon: Wrench, lightColor: 'bg-amber-50', textColor: 'text-amber-600' },
  ];

  const reportShortcuts = [
    { label: 'Sales Report', icon: TrendingUp, color: 'border-l-violet-500', bg: 'bg-violet-50', iconColor: 'text-violet-600' },
    { label: 'Mushak Report', icon: FileText, color: 'border-l-red-500', bg: 'bg-red-50', iconColor: 'text-red-600' },
    { label: 'EMI Report', icon: CreditCard, color: 'border-l-amber-500', bg: 'bg-amber-50', iconColor: 'text-amber-600' },
    { label: 'Project Report', icon: Building2, color: 'border-l-cyan-500', bg: 'bg-cyan-50', iconColor: 'text-cyan-600' },
  ];

  const quickActions = [
    { label: 'New Product', icon: Plus, view: 'add-product' as const, color: 'bg-blue-500' },
    { label: 'Job Card', icon: Wrench, view: 'create-job-card' as const, color: 'bg-amber-500' },
    { label: 'New AMC', icon: FileText, view: 'create-amc' as const, color: 'bg-teal-500' },
    { label: 'Projects', icon: Building2, view: 'projects' as const, color: 'bg-cyan-500' },
    { label: 'EMI Sales', icon: CreditCard, view: 'emi' as const, color: 'bg-pink-500' },
    { label: 'Warranties', icon: Shield, view: 'warranties' as const, color: 'bg-emerald-500' },
    { label: 'Customers', icon: Package, view: 'customers' as const, color: 'bg-orange-500' },
    { label: 'All Reports', icon: BarChart3, view: 'reports' as const, color: 'bg-purple-500' },
  ];

  const highlightCards = [
    {
      title: 'Active Projects',
      value: '5',
      subtitle: '2 nearing deadline',
      icon: Building2,
      gradient: 'from-cyan-500 to-blue-600',
      shadow: 'shadow-cyan-500/20',
      view: 'projects' as const,
    },
    {
      title: 'EMI Pending',
      value: '৳1.2L',
      subtitle: '18 installments due',
      icon: CreditCard,
      gradient: 'from-pink-500 to-rose-600',
      shadow: 'shadow-pink-500/20',
      view: 'emi' as const,
    },
    {
      title: 'Warranty Watch',
      value: '8',
      subtitle: 'Expiring this month',
      icon: AlertTriangle,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/20',
      view: 'warranties' as const,
    },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="pb-24"
    >
      {/* Header Banner */}
      <motion.div
        variants={fadeUp}
        className="cctv-bg relative overflow-hidden rounded-b-3xl px-5 pt-12 pb-8"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/70 text-xs font-medium">Welcome back</p>
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
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.lightColor)}>
                    <Icon className={cn('w-5 h-5', stat.textColor)} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* New Sale CTA + Today's Sales mini card */}
        <motion.div variants={fadeUp} className="flex gap-3">
          <button
            onClick={() => navigate('new-sale')}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-transform"
          >
            <ShoppingCart className="w-4 h-4" />
            New Sale
          </button>
          <div className="flex items-center gap-2.5 bg-white rounded-2xl px-4 border border-gray-100 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">৳24,500</p>
              <p className="text-[10px] text-gray-400 leading-tight">today · 8 orders</p>
            </div>
          </div>
        </motion.div>

        {/* Report Shortcuts */}
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

        {/* Quick Actions */}
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

        {/* Highlight Cards - Horizontal Scroll */}
        <motion.div variants={fadeUp}>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">CCTV Overview</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {highlightCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.title}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(card.view)}
                  className={cn(
                    'min-w-[200px] flex-shrink-0 rounded-2xl bg-gradient-to-br p-4 text-left shadow-lg',
                    card.gradient,
                    card.shadow,
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <Icon className="w-8 h-8 text-white/80" />
                    <ArrowUpRight className="w-4 h-4 text-white/50" />
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                  <p className="text-sm font-medium text-white/90 mt-0.5">{card.title}</p>
                  <p className="text-[11px] text-white/60 mt-1">{card.subtitle}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Inventory Health Card */}
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Inventory Health</h3>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="space-y-3">
            {[
              { label: 'Low Stock Items', value: 12, display: '12', color: 'bg-red-500', total: 100 },
              { label: 'Expiring Warranties', value: 8, display: '8', color: 'bg-amber-500', total: 89 },
              { label: 'Pending Deliveries', value: 5, display: '5', color: 'bg-blue-500', total: 34 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">{item.label}</span>
                  <span className="text-xs font-bold text-gray-900">{item.display}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / item.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className={cn('h-full rounded-full', item.color)}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Warranty Watch Widget */}
        <motion.div
          variants={fadeUp}
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Warranty Watch</h3>
          </div>
          <div className="space-y-2">
            {[
              { name: 'Hikvision DS-2CD2143', days: 3, serial: 'HK-2024-0891' },
              { name: 'Dahua IPC-HDW2431T', days: 7, serial: 'DH-2024-1234' },
              { name: 'TP-Link Tapo C320WS', days: 12, serial: 'TP-2024-0567' },
            ].map((item) => (
              <div
                key={item.serial}
                className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{item.serial}</p>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    item.days <= 3
                      ? 'bg-red-100 text-red-600'
                      : item.days <= 7
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-yellow-100 text-yellow-700',
                  )}
                >
                  {item.days}d left
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('warranties')}
            className="w-full text-center text-xs text-amber-700 font-semibold mt-3 py-1.5 rounded-xl bg-amber-100/50 active:bg-amber-100 transition-colors"
          >
            View All Warranties
          </button>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <CircleDot className="w-4 h-4 text-violet-400" />
          </div>
          <div className="space-y-0">
            {recentActivities.map((activity, i) => (
              <div key={activity.id} className="flex items-start gap-3">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center pt-1">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', activity.dotColor)} />
                  {i < recentActivities.length - 1 && (
                    <div className="w-px h-8 bg-gray-100 mt-1" />
                  )}
                </div>
                {/* Content */}
                <div className={cn('pb-4 flex-1 min-w-0', i === recentActivities.length - 1 && 'pb-0')}>
                  <p className="text-xs font-medium text-gray-800 truncate">{activity.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}