'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Search,
  ShoppingCart,
  Bot,
  MoreHorizontal,
  FileText,
  Bell,
  Users,
  TrendingUp,
  Pill,
  ClipboardList,
  AlertTriangle,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Plus,
  Boxes,
  Clock,
  Heart,
  UserCircle,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ═══════════════════════════════════════════
   PHARMACY NAV STORE (lightweight, inline)
   ═══════════════════════════════════════════ */
type PharmacyView =
  | 'dashboard'
  | 'stock-hub'
  | 'dispensary'
  | 'ai-hub'
  | 'more-hub'
  | 'products'
  | 'add-medicine'
  | 'prescriptions'
  | 'expiry-alerts'
  | 'sales-history'
  | 'reports';

interface PharmacyNavState {
  activeView: PharmacyView;
  viewHistory: PharmacyView[];
}

/* Simple state management via module-level reactive store */
let navListeners: Array<() => void> = [];
const pharmacyNavState: PharmacyNavState = {
  activeView: 'dashboard',
  viewHistory: [],
};

function emitNavChange() {
  navListeners.forEach((l) => l());
}

export function usePharmacyNav() {
  const [, forceUpdate] = useState(0);

  React.useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    navListeners.push(listener);
    return () => {
      navListeners = navListeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    activeView: pharmacyNavState.activeView,
    navigate: (view: PharmacyView) => {
      pharmacyNavState.viewHistory.push(pharmacyNavState.activeView);
      pharmacyNavState.activeView = view;
      emitNavChange();
    },
    goBack: () => {
      const prev = pharmacyNavState.viewHistory.pop();
      if (prev) {
        pharmacyNavState.activeView = prev;
        emitNavChange();
      }
    },
  };
}

/* ═══════════════════════════════════════════
   PLACEHOLDER VIEW
   ═══════════════════════════════════════════ */
function PlaceholderView({ title, icon }: { title: string; icon: string }) {
  const { goBack } = usePharmacyNav();
  return (
    <div className="px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
          <span className="text-2xl">{icon}</span>
        </div>
        <p className="text-sm font-semibold text-gray-800">Coming Soon</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
          This feature is being built. Stay tuned!
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PHARMACY DASHBOARD
   ═══════════════════════════════════════════ */
function PharmacyDashboard() {
  const session = useAuthStore((s) => s.session);
  const { navigate } = usePharmacyNav();
  const business = session?.business;

  const stats = [
    { label: 'Medicines', value: '1,248', icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Today Sales', value: '৳24,500', icon: Receipt, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Prescriptions', value: '34', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Expiring Soon', value: '12', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const quickActions = [
    { label: 'New Sale', icon: ShoppingCart, color: 'from-emerald-500 to-teal-600', view: 'dispensary' as PharmacyView },
    { label: 'Add Medicine', icon: Plus, color: 'from-teal-500 to-cyan-600', view: 'add-medicine' as PharmacyView },
    { label: 'Prescriptions', icon: FileText, color: 'from-amber-500 to-orange-600', view: 'prescriptions' as PharmacyView },
    { label: 'Expiry Alerts', icon: Bell, color: 'from-red-500 to-rose-600', view: 'expiry-alerts' as PharmacyView },
    { label: 'Sales History', icon: BarChart3, color: 'from-violet-500 to-purple-600', view: 'sales-history' as PharmacyView },
    { label: 'All Reports', icon: TrendingUp, color: 'from-blue-500 to-indigo-600', view: 'reports' as PharmacyView },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 pt-5 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-emerald-100 text-xs font-medium">Welcome back</p>
              <h1 className="text-xl font-bold text-white">{business?.name || 'My Pharmacy'}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1">
                <p className="text-[10px] text-emerald-100">Code</p>
                <p className="text-xs font-bold text-white">{business?.shopCode || 'PHA-0000'}</p>
              </div>
            </div>
          </div>

          {/* New Sale CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('dispensary')}
            className="w-full bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">New Sale</p>
                <p className="text-[10px] text-emerald-100">Start dispensing</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/70" />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg shadow-black/5 p-4 grid grid-cols-4 gap-2">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="text-center"
            >
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-1.5`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
              <p className="text-[9px] text-gray-400 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(action.view)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-sm`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-medium text-gray-700">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Expiry Watch */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Expiry Watch</h2>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-red-700">12 medicines expiring within 30 days</span>
          </div>
          {['Paracetamol 500mg', 'Amoxicillin 250mg', 'Omeprazole 20mg'].map((med) => (
            <div key={med} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
              <span className="text-xs text-gray-700">{med}</span>
              <span className="text-[10px] font-medium text-red-500">Exp. soon</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sales */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Recent Sales</h2>
          <button onClick={() => navigate('sales-history')} className="text-[11px] text-emerald-600 font-medium">View All</button>
        </div>
        <div className="space-y-2">
          {[
            { id: 'INV-1042', customer: 'Rahim Ahmed', amount: '৳1,250', time: '10 min ago' },
            { id: 'INV-1041', customer: 'Fatima Begum', amount: '৳850', time: '32 min ago' },
            { id: 'INV-1040', customer: 'Kamal Hossain', amount: '৳2,100', time: '1 hr ago' },
          ].map((sale) => (
            <div key={sale.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-900">{sale.customer}</p>
                <p className="text-[10px] text-gray-400">{sale.id} · {sale.time}</p>
              </div>
              <p className="text-sm font-bold text-emerald-600">{sale.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STOCK HUB
   ═══════════════════════════════════════════ */
function StockHub() {
  const { navigate } = usePharmacyNav();
  const categories = [
    { label: 'Medicines', icon: Pill, count: '1,248 items', color: 'from-emerald-500 to-teal-600', view: 'products' as PharmacyView },
    { label: 'Prescriptions', icon: ClipboardList, count: '34 today', color: 'from-amber-500 to-orange-600', view: 'prescriptions' as PharmacyView },
    { label: 'Expiry Alerts', icon: AlertTriangle, count: '12 items', color: 'from-red-500 to-rose-600', view: 'expiry-alerts' as PharmacyView },
    { label: 'Suppliers', icon: Users, count: '8 active', color: 'from-blue-500 to-indigo-600', view: 'products' as PharmacyView },
  ];

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Stock & Inventory</h1>
      <p className="text-sm text-gray-500 mb-5">Manage your pharmacy inventory</p>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search medicines, batches..." className="h-12 rounded-xl bg-gray-50 border-gray-200 pl-10" />
      </div>

      <div className="space-y-3">
        {categories.map((cat, i) => (
          <motion.button
            key={cat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(cat.view)}
            className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 text-left shadow-sm active:bg-gray-50 transition-colors"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-sm flex-shrink-0`}>
              <cat.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{cat.label}</p>
              <p className="text-xs text-gray-400">{cat.count}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DISPENSARY (Point of Sale)
   ═══════════════════════════════════════════ */
function DispensaryView() {
  const { goBack } = usePharmacyNav();
  return <PlaceholderView title="Dispensary / POS" icon="💊" />;
}

/* ═══════════════════════════════════════════
   AI HUB
   ═══════════════════════════════════════════ */
function AIHub() {
  const { navigate } = usePharmacyNav();
  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">AI Assistant</h1>
      <p className="text-sm text-gray-500 mb-5">Smart tools for your pharmacy</p>

      <div className="space-y-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-left shadow-lg"
        >
          <Bot className="w-8 h-8 text-white/90 mb-3" />
          <p className="text-sm font-bold text-white">AI Chat</p>
          <p className="text-xs text-emerald-100 mt-0.5">Ask about drug interactions, stock insights</p>
        </motion.button>

        {[
          { label: 'Drug Interaction Checker', icon: Activity, desc: 'Check medicine compatibility' },
          { label: 'Demand Forecast', icon: TrendingUp, desc: 'AI-powered stock predictions' },
          { label: 'Smart Reorder', icon: Boxes, desc: 'Auto-generate purchase orders' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 opacity-60"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
              <item.icon className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600">{item.label}</p>
              <p className="text-[10px] text-gray-400">{item.desc}</p>
            </div>
            <span className="ml-auto text-[9px] text-gray-400 font-medium bg-gray-200 rounded-full px-2 py-0.5">Soon</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MORE HUB
   ═══════════════════════════════════════════ */
function MoreHub() {
  const { navigate } = usePharmacyNav();
  const session = useAuthStore((s) => s.session);
  const { logout } = useAuthStore();

  const sections = [
    {
      title: 'Operations',
      items: [
        { label: 'Suppliers', icon: Users, view: 'products' as PharmacyView },
        { label: 'Purchase Orders', icon: FileText, view: 'products' as PharmacyView },
        { label: 'Reports & Analytics', icon: BarChart3, view: 'reports' as PharmacyView },
      ],
    },
    {
      title: 'Pharmacy Specific',
      items: [
        { label: 'Expiry Management', icon: Clock, view: 'expiry-alerts' as PharmacyView },
        { label: 'Prescription Archive', icon: ClipboardList, view: 'prescriptions' as PharmacyView },
        { label: 'Drug Database', icon: Heart, view: 'products' as PharmacyView },
      ],
    },
  ];

  return (
    <div className="px-4 py-6 pb-24">
      {/* Profile Card */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <UserCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{session?.user.name || 'User'}</p>
            <p className="text-xs text-gray-500">{session?.business.name}</p>
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{section.title}</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {section.items.map((item, i) => (
              <button
                key={item.label}
                onClick={() => navigate(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors ${
                  i < section.items.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <item.icon className="w-4.5 h-4.5 text-gray-500" />
                <span className="text-sm text-gray-700 flex-1">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Admin */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Admin</p>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
            <Settings className="w-4.5 h-4.5 text-gray-500" />
            <span className="text-sm text-gray-700 flex-1">Settings</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-red-50 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5 text-red-500" />
            <span className="text-sm text-red-600 flex-1">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   BOTTOM NAVIGATION
   ═══════════════════════════════════════════ */
function PharmacyBottomNav() {
  const { activeView, navigate } = usePharmacyNav();

  const isHubView = (hub: PharmacyView) =>
    activeView === hub ||
    (hub === 'stock-hub' && ['products', 'add-medicine', 'prescriptions', 'expiry-alerts'].includes(activeView)) ||
    (hub === 'ai-hub' && false) ||
    (hub === 'more-hub' && ['reports', 'sales-history'].includes(activeView));

  const tabs: { view: PharmacyView; label: string; icon: typeof Package; isCenter?: boolean }[] = [
    { view: 'dashboard', label: 'Home', icon: Package },
    { view: 'stock-hub', label: 'Stock', icon: Boxes },
    { view: 'dispensary', label: 'Sell', icon: ShoppingCart, isCenter: true },
    { view: 'ai-hub', label: 'AI', icon: Bot },
    { view: 'more-hub', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-area-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = tab.isCenter
            ? activeView === tab.view
            : isHubView(tab.view);

          if (tab.isCenter) {
            return (
              <motion.button
                key={tab.view}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate(tab.view)}
                className={`relative -mt-5 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
                    : 'bg-gray-100'
                }`}
              >
                <tab.icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-500'}`} />
              </motion.button>
            );
          }

          return (
            <button
              key={tab.view}
              onClick={() => navigate(tab.view)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px]"
            >
              <tab.icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-gray-400'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PHARMACY SHELL (Main Router)
   ═══════════════════════════════════════════ */
export function PharmacyShell() {
  const { activeView } = usePharmacyNav();

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <PharmacyDashboard />;
      case 'stock-hub':
        return <StockHub />;
      case 'dispensary':
        return <DispensaryView />;
      case 'ai-hub':
        return <AIHub />;
      case 'more-hub':
        return <MoreHub />;
      default:
        const labels: Record<string, string> = {
          'products': 'Medicines',
          'add-medicine': 'Add Medicine',
          'prescriptions': 'Prescriptions',
          'expiry-alerts': 'Expiry Alerts',
          'sales-history': 'Sales History',
          'reports': 'Reports',
        };
        return <PlaceholderView title={labels[activeView] || activeView} icon="💊" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
      <PharmacyBottomNav />
    </div>
  );
}

export default PharmacyShell;