'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';

export default function CCTVInventoryHub() {
  const { navigate } = useCCTVNavStore();

  return (
    <div className="px-4 py-6 pb-24">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-gray-900 mb-4"
      >
        Inventory Hub
      </motion.h2>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search products, serial numbers..."
          className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
      </div>

      <div className="space-y-3">
        {[
          { label: 'Products', desc: 'Manage product catalog', view: 'products' as const, icon: '📦', color: 'bg-blue-50 border-blue-200' },
          { label: 'Serial Items', desc: 'Track individual items', view: 'serial-items' as const, icon: '🔢', color: 'bg-violet-50 border-violet-200' },
          { label: 'Purchase Orders', desc: 'Supplier orders', view: 'purchase-orders' as const, icon: '🛒', color: 'bg-amber-50 border-amber-200' },
          { label: 'Suppliers', desc: 'Manage suppliers', view: 'suppliers' as const, icon: '🏭', color: 'bg-emerald-50 border-emerald-200' },
        ].map((item, i) => (
          <motion.button
            key={item.view}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(item.view)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${item.color} text-left active:scale-[0.98] transition-transform`}
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        ))}
      </div>
    </div>
  );
}