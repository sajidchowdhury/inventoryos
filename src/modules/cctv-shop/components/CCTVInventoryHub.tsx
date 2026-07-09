'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Hash,
  Camera,
  HardDrive,
  Cable,
  Plug,
  AlertTriangle,
  ChevronRight,
  Download,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const categoryCards = [
  { label: 'Cameras', count: 120, icon: Camera, color: 'bg-violet-50 text-violet-600', border: 'border-violet-100' },
  { label: 'DVR / NVR', count: 45, icon: HardDrive, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' },
  { label: 'Accessories', count: 280, icon: Plug, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
  { label: 'Cables', count: 79, icon: Cable, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
];

const lowStockItems = [
  { name: 'Hikvision DS-2CD2143G2', stock: 3, threshold: 10, color: 'bg-red-500' },
  { name: 'Cat6 Ethernet Cable 100m', stock: 5, threshold: 15, color: 'bg-red-500' },
  { name: 'Dahua 4K Bullet Camera', stock: 8, threshold: 12, color: 'bg-amber-500' },
];

export function CCTVInventoryHub() {
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

      {/* Serial Items Highlight Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={() => navigate('serial-items')}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 p-4 mb-5 cursor-pointer active:scale-[0.98] transition-transform shadow-lg shadow-violet-500/20"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-8 w-16 h-16 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">Serial Items Tracked</p>
            <p className="text-3xl font-bold text-white mt-1">2,147</p>
            <p className="text-white/60 text-[11px] mt-0.5">items across all categories</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Hash className="w-6 h-6 text-white" />
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => navigate('stock-in')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-left active:scale-[0.98] transition-transform shadow-lg shadow-emerald-500/20"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <Download className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">Stock In</span>
          </div>
          <p className="text-white/70 text-[11px]">Scan serials & IMEI</p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate('add-product')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-left active:scale-[0.98] transition-transform shadow-lg shadow-violet-500/20"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">Add Product</span>
          </div>
          <p className="text-white/70 text-[11px]">New item to catalog</p>
        </motion.button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search products, serial numbers..."
          className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
      </div>

      {/* Category Breakdown */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Categories</h3>
          <button
            onClick={() => navigate('categories')}
            className="text-xs text-violet-600 font-medium"
          >
            View All
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {categoryCards.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <motion.button
                key={cat.label}
                variants={fadeUp}
                onClick={() => navigate('categories')}
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border text-left active:scale-[0.97] transition-transform bg-white',
                  cat.border,
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cat.color.split(' ')[0])}>
                  <Icon className={cn('w-5 h-5', cat.color.split(' ')[1])} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">{cat.label}</p>
                  <p className="text-[11px] text-gray-400">{cat.count} items</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Menu Items */}
      <div className="space-y-3 mb-6">
        {[
          { label: 'Products', desc: 'Manage product catalog', view: 'products' as const, icon: '📦', color: 'bg-blue-50 border-blue-200' },
          { label: 'Serial Items', desc: 'Track individual items', view: 'serial-items' as const, icon: '🔢', color: 'bg-violet-50 border-violet-200' },
          { label: 'Categories', desc: 'Organize by type & brand', view: 'categories' as const, icon: '🏷️', color: 'bg-purple-50 border-purple-200' },
          { label: 'Purchase Orders', desc: 'Supplier orders', view: 'purchase-orders' as const, icon: '🛒', color: 'bg-amber-50 border-amber-200' },
          { label: 'Suppliers', desc: 'Manage suppliers', view: 'suppliers' as const, icon: '🏭', color: 'bg-emerald-50 border-emerald-200' },
        ].map((item, i) => (
          <motion.button
            key={item.view}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(item.view)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform',
              item.color,
            )}
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>
        ))}
      </div>

      {/* Low Stock Alert */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">Low Stock Alert</h3>
          </div>
          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            3 items
          </span>
        </div>
        <div className="space-y-2.5">
          {lowStockItems.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-400">Threshold: {item.threshold} units</p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    item.color,
                  )}
                />
                <span className={cn(
                  'text-xs font-bold',
                  item.stock <= 5 ? 'text-red-600' : 'text-amber-600',
                )}>
                  {item.stock} left
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}