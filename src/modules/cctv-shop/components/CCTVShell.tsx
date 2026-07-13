'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CCTVPurchase } from './CCTVPurchase';
import { CCTVProductsList } from './CCTVProductsList';
import { CCTVProductForm } from './CCTVProductForm';
import { CCTVSales } from './CCTVSales';
import { CCTVCashBook } from './CCTVCashBook';
import { CCTVLedger } from './CCTVLedger';
import {
  Home, Package, ShoppingCart, Users, Building2, Receipt,
  BarChart3, Settings, Camera, Plus, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVShell() {
  const { activeView, navigate } = useCCTVNavStore();
  const session = useAuthStore((s) => s.session);
  const businessName = session?.business?.name || 'CCTV Shop';

  return (
    <div className="ms-shell-wrap min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-violet-100 bg-white">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-violet-50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{businessName}</div>
            <div className="text-xs text-gray-400">CCTV Shop</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {[
            { view: 'dashboard' as const, label: 'Dashboard', icon: Home },
            { view: 'products' as const, label: 'Products', icon: Package },
            { view: 'purchase' as const, label: 'Buy Products', icon: ShoppingCart },
            { view: 'sales' as const, label: 'Sell Products', icon: TrendingUp },
            { view: 'customers' as const, label: 'Customers', icon: Users },
            { view: 'suppliers' as const, label: 'Suppliers', icon: Building2 },
            { view: 'expenses' as const, label: 'Expenses', icon: Receipt },
            { view: 'reports' as const, label: 'Cash Book', icon: BarChart3 },
            { view: 'settings' as const, label: 'Settings', icon: Settings },
          ].map((item) => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full text-left',
                  isActive
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20'
                    : 'text-gray-600 hover:bg-violet-50 hover:text-violet-700'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-violet-400')} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-violet-50">
          <div className="text-xs text-gray-400 px-3">InventoryOS · CCTV Module</div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-around h-16">
          {[
            { view: 'dashboard' as const, label: 'Home', icon: Home },
            { view: 'products' as const, label: 'Products', icon: Package },
            { view: 'purchase' as const, label: 'Buy', icon: ShoppingCart },
            { view: 'sales' as const, label: 'Sell', icon: TrendingUp },
            { view: 'reports' as const, label: 'Cash', icon: BarChart3 },
          ].map((item) => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2',
                  isActive ? 'text-violet-600' : 'text-gray-400'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col min-h-0 flex-1 md:pl-64">
        <div className="flex-1 pb-20 md:pb-4 px-4 pt-4 max-w-[1200px] mx-auto w-full">
          {activeView === 'dashboard' && <CCTVDashboard />}
          {activeView === 'products' && <CCTVProductsList />}
          {activeView === 'add-product' && <CCTVProductForm />}
          {activeView === 'edit-product' && <CCTVProductForm />}
          {activeView === 'purchase' && <CCTVPurchase />}
          {activeView === 'sales' && <CCTVSales />}
          {activeView === 'customers' && <CCTVLedger type="customer" />}
          {activeView === 'suppliers' && <CCTVLedger type="supplier" />}
          {activeView === 'expenses' && <PlaceholderView title="Expenses" desc="Daily expense tracking — coming soon" />}
          {activeView === 'reports' && <CCTVCashBook />}
          {activeView === 'settings' && <PlaceholderView title="Settings" desc="Business settings — coming soon" />}
        </div>
      </div>
    </div>
  );
}

function CCTVDashboard() {
  const { navigate } = useCCTVNavStore();
  const session = useAuthStore((s) => s.session);
  const businessName = session?.business?.name || 'CCTV Shop';

  return (
    <motion.div {...fadeUp} className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-500/20">
        <h1 className="text-xl font-bold">{businessName}</h1>
        <p className="text-sm text-white/80 mt-1">Welcome back! Here's your business overview.</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Buy Products', icon: ShoppingCart, view: 'purchase' as const, gradient: 'from-blue-500 to-indigo-600' },
          { label: 'Sell Products', icon: TrendingUp, view: 'sales' as const, gradient: 'from-emerald-500 to-teal-600' },
          { label: 'Add Product', icon: Plus, view: 'add-product' as const, gradient: 'from-violet-500 to-purple-600' },
          { label: 'Reports', icon: BarChart3, view: 'reports' as const, gradient: 'from-amber-500 to-orange-600' },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.view)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br text-white shadow-md active:scale-95 transition-transform',
              action.gradient
            )}
          >
            <action.icon className="w-6 h-6" />
            <span className="text-xs font-semibold">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Total Products</span>
            <Package className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-400 mt-1">No products yet</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Today's Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">৳0</p>
          <p className="text-xs text-gray-400 mt-1">No sales today</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">0</p>
          <p className="text-xs text-gray-400 mt-1">All stock levels OK</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Camera className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-bold text-gray-900">CCTV Module — Under Construction</h3>
        </div>
        <p className="text-xs text-gray-500">
          This is a clean, simple CCTV module being built specifically for Bangladeshi CCTV shops.
          Features will be added in phases: Products → Purchase → Sales → Reports → Customer/Supplier Ledger.
          Designed desktop-first with mobile responsive support.
        </p>
      </div>
    </motion.div>
  );
}

function PlaceholderView({ title, desc }: { title: string; desc: string }) {
  const { navigate } = useCCTVNavStore();
  return (
    <motion.div {...fadeUp} className="space-y-4">
      <div className="flex items-center gap-3 pt-1">
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
        <Camera className="w-12 h-12 text-violet-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1">{desc}</p>
        <button
          onClick={() => navigate('dashboard')}
          className="mt-4 px-4 py-2 rounded-xl bg-violet-50 text-violet-600 text-xs font-semibold hover:bg-violet-100 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </motion.div>
  );
}
