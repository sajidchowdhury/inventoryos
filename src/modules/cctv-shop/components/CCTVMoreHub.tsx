'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingDown,
  Settings,
  User,
  Crown,
  HelpCircle,
  LogOut,
  ChevronRight,
  BookOpen,
  BookCheck,
  TrendingUp,
  BarChart3,
  Banknote,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import type { CCTVViewType } from '../types';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  view: CCTVViewType;
  color: string;
}

interface QuickStatsData {
  todaySalesRevenue: number;
  todaySalesCount: number;
  pendingJobs: number;
  activeAmc: number;
}

function formatCompactBDT(n: number): string {
  if (n >= 100000) return `৳${(n / 1000).toFixed(0)}K`;
  if (n >= 10000) return `৳${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `৳${(n / 1000).toFixed(1)}K`;
  return `৳${n.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

export function CCTVMoreHub() {
  const { navigate } = useCCTVNavStore();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const businessId = useCctvBusinessId();
  const [quickStats, setQuickStats] = useState<QuickStatsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/businesses/${businessId}/mobile-shop/quick-stats`,
          { signal: controller.signal },
        );
        if (res.ok && !cancelled) {
          const json = await res.json();
          if (json.success) setQuickStats(json);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [businessId]);

  const statsRow = [
    {
      label: 'Today Sales',
      value: quickStats ? formatCompactBDT(quickStats.todaySalesRevenue) : '...',
      icon: Banknote,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Pending Jobs',
      value: quickStats ? String(quickStats.pendingJobs) : '...',
      icon: ClipboardList,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Active AMC',
      value: quickStats ? String(quickStats.activeAmc) : '...',
      icon: BarChart3,
      color: 'bg-violet-50 text-violet-600',
    },
  ];

  const quickActions: MenuItem[] = [
    { label: 'Expense', icon: <TrendingDown className="w-5 h-5" />, view: 'expenses', color: 'bg-rose-50 text-rose-600' },
    { label: 'Due Book', icon: <BookOpen className="w-5 h-5" />, view: 'due-book', color: 'bg-red-50 text-red-600' },
    { label: 'Financial Ledger', icon: <BookCheck className="w-5 h-5" />, view: 'ledger', color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Profit & Loss', icon: <TrendingUp className="w-5 h-5" />, view: 'profit-loss', color: 'bg-emerald-50 text-emerald-600' },
    { label: 'All Reports', icon: <BarChart3 className="w-5 h-5" />, view: 'reports', color: 'bg-violet-50 text-violet-600' },
  ];

  const account: MenuItem[] = [
    { label: 'Profile', icon: <User className="w-5 h-5" />, view: 'profile', color: 'bg-violet-50 text-violet-600' },
    { label: 'Settings', icon: <Settings className="w-5 h-5" />, view: 'settings', color: 'bg-gray-100 text-gray-600' },
    { label: 'Subscription', icon: <Crown className="w-5 h-5" />, view: 'subscription', color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Help & Support', icon: <HelpCircle className="w-5 h-5" />, view: 'help', color: 'bg-green-50 text-green-600' },
  ];

  const renderSection = (title: string, items: MenuItem[], sectionIndex: number) => (
    <motion.div
      key={title}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + sectionIndex * 0.08 }}
      className="mb-5"
    >
      <div className="flex items-center gap-2.5 mb-2.5 px-1">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-purple-600" />
        <h3 className="text-[13px] font-bold text-gray-900 tracking-tight">{title}</h3>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {items.map((item, i) => (
          <button
            key={item.view}
            onClick={() => navigate(item.view)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors',
              i !== items.length - 1 && 'border-b border-gray-50',
            )}
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', item.color)}>
              {item.icon}
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div className="px-4 py-6 pb-24">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-gray-900 mb-6"
      >
        More
      </motion.h2>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 mb-4 text-white"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
            {session?.user.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{session?.user.name || 'User Name'}</p>
            <p className="text-xs text-white/70">{session?.business.name || 'My CCTV Shop'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60 uppercase tracking-wider">Code</p>
            <p className="text-sm font-mono font-bold">{session?.business.shopCode || 'CCTV001'}</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="grid grid-cols-3 gap-2.5 mb-5"
      >
        {statsRow.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2.5"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', stat.color.split(' ')[0])}>
                <Icon className={cn('w-4 h-4', stat.color.split(' ')[1])} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 leading-tight">{stat.value}</p>
                <p className="text-[10px] text-gray-400 leading-tight truncate">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Quick Action */}
      {renderSection('Quick Action', quickActions, 0)}

      {/* Account */}
      {renderSection('Account', account, 1)}

      {/* Logout */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-2xl border border-red-200 text-red-500 font-medium text-sm active:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Log Out
      </motion.button>
    </div>
  );
}