'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  Shield,
  Building2,
  CreditCard,
  FileText,
  Users,
  BarChart3,
  Settings,
  User,
  Crown,
  HelpCircle,
  LogOut,
  ChevronRight,
  Package,
  Hash,
  Factory,
  ShoppingCart,
  Sparkles,
  Banknote,
  ClipboardList,
  Receipt,
  FileBarChart,
  Landmark,
  BookOpen,
  TrendingDown,
  BookCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import type { CCTVViewType } from '../types';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  view: CCTVViewType;
  color: string;
  badge?: string;
}

const quickStats = [
  { label: 'Today Sales', value: '৳24.5K', icon: Banknote, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'Pending Jobs', value: '12', icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
  { label: 'Active AMC', value: '15', icon: Shield, color: 'bg-violet-50 text-violet-600' },
];

export function CCTVMoreHub() {
  const { navigate } = useCCTVNavStore();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  const cctvOperations: MenuItem[] = [
    { label: 'Job Cards', icon: <Wrench className="w-5 h-5" />, view: 'job-cards', color: 'bg-blue-50 text-blue-600', badge: '12' },
    { label: 'Projects', icon: <Building2 className="w-5 h-5" />, view: 'projects', color: 'bg-orange-50 text-orange-600', badge: '5' },
    { label: 'AMC Management', icon: <FileText className="w-5 h-5" />, view: 'amc', color: 'bg-teal-50 text-teal-600', badge: '15' },
    { label: 'EMI Tracking', icon: <CreditCard className="w-5 h-5" />, view: 'emi', color: 'bg-pink-50 text-pink-600' },
  ];

  const inventory: MenuItem[] = [
    { label: 'Products', icon: <Package className="w-5 h-5" />, view: 'products', color: 'bg-blue-50 text-blue-600', badge: '524' },
    { label: 'Serial Items', icon: <Hash className="w-5 h-5" />, view: 'serial-items', color: 'bg-violet-50 text-violet-600', badge: '2,147' },
    { label: 'Suppliers', icon: <Factory className="w-5 h-5" />, view: 'suppliers', color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Purchase Orders', icon: <ShoppingCart className="w-5 h-5" />, view: 'purchase-orders', color: 'bg-amber-50 text-amber-600', badge: '3' },
  ];

  const salesCustomers: MenuItem[] = [
    { label: 'Due Book', icon: <BookOpen className="w-5 h-5" />, view: 'due-book', color: 'bg-red-50 text-red-600' },
    { label: 'Expenses', icon: <TrendingDown className="w-5 h-5" />, view: 'expenses', color: 'bg-rose-50 text-rose-600' },
    { label: 'Customers', icon: <Users className="w-5 h-5" />, view: 'customers', color: 'bg-emerald-50 text-emerald-600', badge: '186' },
    { label: 'Sales History', icon: <FileBarChart className="w-5 h-5" />, view: 'sales-history', color: 'bg-amber-50 text-amber-600' },
    { label: 'Mushak Report', icon: <FileText className="w-5 h-5" />, view: 'mushak-report', color: 'bg-red-50 text-red-600' },
  ];

  const tools: MenuItem[] = [
    { label: 'Financial Ledger', icon: <BookCheck className="w-5 h-5" />, view: 'ledger', color: 'bg-indigo-50 text-indigo-600' },
    { label: 'NBR & Tax Setup', icon: <Landmark className="w-5 h-5" />, view: 'nbr-setup', color: 'bg-amber-50 text-amber-600' },
    { label: 'Mushak 6.3 Invoices', icon: <FileText className="w-5 h-5" />, view: 'mushak-invoices', color: 'bg-red-50 text-red-600' },
    { label: 'Mushak Registers (6.1/6.2)', icon: <ClipboardList className="w-5 h-5" />, view: 'mushak-registers', color: 'bg-orange-50 text-orange-600' },
    { label: 'VAT Return (Mushak 9.1)', icon: <Receipt className="w-5 h-5" />, view: 'vat-return', color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Cloud Dashboard', icon: <BarChart3 className="w-5 h-5" />, view: 'cloud-dashboard', color: 'bg-sky-50 text-sky-600' },
    { label: 'AI Hub', icon: <Sparkles className="w-5 h-5" />, view: 'ai-hub', color: 'bg-purple-50 text-purple-600' },
    { label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, view: 'reports', color: 'bg-cyan-50 text-cyan-600' },
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
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
            {item.badge && (
              <span className="text-[10px] font-bold text-white bg-violet-500 px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
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
        {quickStats.map((stat) => {
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

      {/* Sections */}
      {renderSection('CCTV Operations', cctvOperations, 0)}
      {renderSection('Inventory', inventory, 1)}
      {renderSection('Sales & Customers', salesCustomers, 2)}
      {renderSection('Tools', tools, 3)}
      {renderSection('Account', account, 4)}

      {/* Logout */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-2xl border border-red-200 text-red-500 font-medium text-sm active:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Log Out
      </motion.button>
    </div>
  );
}