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
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type { CCTVViewType } from '../types';

interface NavTab {
  id: CCTVViewType;
  label: string;
  icon: React.ReactNode;
  isHub?: boolean;
  hubChildren?: CCTVViewType[];
}

const tabs: NavTab[] = [
  { id: 'dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
  {
    id: 'inventory-hub',
    label: 'Stock',
    icon: <Package className="w-5 h-5" />,
    isHub: true,
    hubChildren: [
      'products',
      'serial-items',
      'add-product',
      'edit-product',
      'product-detail',
      'purchase-orders',
      'suppliers',
    ],
  },
  {
    id: 'sell',
    label: 'Sell',
    icon: <ShoppingCart className="w-6 h-6" />,
  },
  {
    id: 'ai-hub',
    label: 'AI',
    icon: <Sparkles className="w-5 h-5" />,
    isHub: true,
    hubChildren: ['ai-chat', 'ai-insights'],
  },
  {
    id: 'more-hub',
    label: 'More',
    icon: <MoreHorizontal className="w-5 h-5" />,
    isHub: true,
    hubChildren: [
      'job-cards',
      'warranties',
      'projects',
      'emi',
      'amc',
      'mushak-report',
      'customers',
      'sales-history',
      'reports',
      'settings',
      'profile',
      'subscription',
      'help',
    ],
  },
];

export default function CCTVBottomNav() {
  const { activeView, navigate } = useCCTVNavStore();

  const getIsActive = (tab: NavTab): boolean => {
    if (tab.id === activeView) return true;
    if (tab.hubChildren?.includes(activeView)) return true;
    return false;
  };

  const handleTap = (tab: NavTab) => {
    if (tab.isHub && getIsActive(tab) && tab.id !== activeView) {
      navigate(tab.id);
    } else if (!getIsActive(tab)) {
      navigate(tab.id);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100 safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto h-16 px-2">
        {tabs.map((tab) => {
          const active = getIsActive(tab);
          const isSell = tab.id === 'sell';

          if (isSell) {
            return (
              <button
                key={tab.id}
                onClick={() => handleTap(tab)}
                className="relative -mt-5 flex flex-col items-center"
              >
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 flex items-center justify-center text-white"
                >
                  {tab.icon}
                </motion.div>
                <span
                  className={`text-[10px] mt-1 font-medium ${
                    active ? 'text-violet-600' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleTap(tab)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 min-w-[60px]"
            >
              <motion.div
                animate={{ scale: active ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={active ? 'text-violet-600' : 'text-gray-400'}
              >
                {tab.icon}
              </motion.div>
              <span
                className={`text-[10px] font-medium ${
                  active ? 'text-violet-600' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
              {active && (
                <motion.div
                  layoutId="cctv-nav-indicator"
                  className="absolute -top-0.5 w-5 h-0.5 bg-violet-500 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}