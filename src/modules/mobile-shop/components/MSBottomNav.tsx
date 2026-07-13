'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Package,
  ShoppingCart,
  Sparkles,
  MoreHorizontal,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import type { MSViewType } from '../types';
import { cn } from '@/lib/utils';

const navItems: { view: MSViewType; label: string; icon: typeof Home; primary?: boolean; hub?: boolean; isAI?: boolean }[] = [
  { view: 'dashboard', label: 'Home', icon: Home },
  { view: 'inventory-hub', label: 'Stock', icon: Package, hub: true },
  { view: 'sell', label: 'Sell', icon: ShoppingCart, primary: true },
  { view: 'ai-hub', label: 'AI', icon: Sparkles, isAI: true, hub: true },
  { view: 'more-hub', label: 'More', icon: MoreHorizontal, hub: true },
];

const hubGroups: Record<string, MSViewType[]> = {
  'inventory-hub': ['products', 'serial-items', 'stock-in', 'add-product', 'edit-product', 'product-detail', 'purchase-orders', 'suppliers', 'branches', 'branch-detail', 'transfers', 'create-transfer', 'transfer-detail', 'kits', 'kit-detail', 'create-kit', 'edit-kit'],
  'ai-hub': ['ai-chat', 'ai-insights'],
  'more-hub': [
    'job-cards', 'job-card-detail', 'create-job-card',
    'warranties', 'warranty-detail',
    'projects', 'project-detail', 'create-project',
    'emi', 'emi-detail',
    'amc', 'amc-detail', 'create-amc',
    'mushak-report',
    'customers', 'customer-detail',
    'sales-history', 'sale-detail',
    'reports', 'settings', 'profile', 'subscription', 'help',
  ],
};

export function MSBottomNav() {
  const { activeView, navigate } = useMSNavStore();

  const getIsActive = (view: MSViewType, item: typeof navItems[0]): boolean => {
    if (activeView === view) return true;
    if (item.hub && hubGroups[view]?.includes(activeView)) return true;
    return false;
  };

  const handleTap = (item: typeof navItems[0]) => {
    if (item.hub && getIsActive(item.view, item) && item.view !== activeView) {
      navigate(item.view);
    } else if (!getIsActive(item.view, item)) {
      navigate(item.view);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100/80 bg-white/95 backdrop-blur-xl shadow-nav">
      <div className="max-w-[480px] mx-auto flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = getIsActive(item.view, item);

          // Primary button (Sell) — elevated circle
          if (item.primary) {
            return (
              <button key={item.view}
                className={cn("flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive ? "text-violet-600" : "text-gray-400 hover:text-gray-600")}
                onClick={() => navigate(item.view)}>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center -mt-4 shadow-lg transition-all active:scale-95",
                  isActive ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-500/30" : "bg-violet-50 text-violet-600")}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium -mt-0.5">{item.label}</span>
              </button>
            );
          }

          // AI tab — special purple glow
          if (item.isAI) {
            return (
              <button key={item.view}
                className={cn("relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all",
                  isActive ? "text-violet-600" : "text-gray-400 hover:text-violet-500")}
                onClick={() => handleTap(item)}>
                {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-gradient-to-r from-violet-400 to-purple-600 rounded-b-full" />}
                <div className={cn("relative h-7 w-7 flex items-center justify-center transition-all", isActive && "animate-pulse-soft")}>
                  {isActive && <div className="absolute inset-0 rounded-lg bg-violet-100 blur-sm" />}
                  <item.icon className={cn("h-5 w-5 relative z-10 transition-colors", isActive ? "text-violet-600" : "text-gray-400")} />
                </div>
                <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-violet-600 font-semibold" : "text-gray-400")}>{item.label}</span>
              </button>
            );
          }

          // Standard nav items
          return (
            <button key={item.view}
              className={cn("relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all",
                isActive ? "text-violet-600" : "text-gray-400 hover:text-gray-600")}
              onClick={() => handleTap(item)}>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-violet-500 rounded-b-full" />}
              <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-violet-600 font-semibold" : "text-gray-400")}>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}