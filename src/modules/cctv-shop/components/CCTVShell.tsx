'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CCTVPurchase } from './CCTVPurchase';
import { CCTVProductsList } from './CCTVProductsList';
import { CCTVProductForm } from './CCTVProductForm';
import { CCTVSales } from './CCTVSales';
import { CCTVCashBook } from './CCTVCashBook';
import { CCTVLedger } from './CCTVLedger';
import { CCTVStockReport } from './CCTVStockReport';
import { CCTVProductMovement } from './CCTVProductMovement';
import { CCTVExpenses } from './CCTVExpenses';
import { CCTVSerialSearch } from './CCTVSerialSearch';
import { CCTVRepairs } from './CCTVRepairs';
import { CCTVSupplierReplacements } from './CCTVSupplierReplacements';
import { CCTVWarrantyDashboard } from './CCTVWarrantyDashboard';
import { CCTVRepairToken } from './CCTVRepairToken';
import { CCTVEstimates } from './CCTVEstimates';
import { CCTVCategories } from './CCTVCategories';
import { CCTVImportProducts } from './CCTVImportProducts';
import { CCTVReportsHub } from './CCTVReportsHub';
import { CCTVDailySummary } from './CCTVDailySummary';
import { CCTVWeeklyHealth } from './CCTVWeeklyHealth';
import {
  Home, Package, ShoppingCart, Users, Building2, Receipt,
  BarChart3, Settings, Camera, Plus, TrendingUp, AlertTriangle, Boxes, ArrowLeftRight,
  Search, Wrench, RefreshCw, Shield, FileText, Tag, Upload, ChevronDown, ChevronRight,
  Calendar, Heart,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Sidebar menu groups ──
interface MenuItem {
  view: any;
  label: string;
  icon: any;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    items: [
      { view: 'products', label: 'Products', icon: Package },
      { view: 'categories', label: 'Categories', icon: Tag },
      { view: 'import-products', label: 'Import CSV', icon: Upload },
      { view: 'purchase', label: 'Buy Products', icon: ShoppingCart },
      { view: 'stock-report', label: 'Stock Report', icon: Boxes },
      { view: 'product-movement', label: 'Product Movement', icon: ArrowLeftRight },
      { view: 'serial-search', label: 'Serial Search', icon: Search },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Service',
    icon: TrendingUp,
    items: [
      { view: 'sales', label: 'Sell Products', icon: TrendingUp },
      { view: 'estimates', label: 'Estimates', icon: FileText },
      { view: 'warranties', label: 'Warranty', icon: Shield },
      { view: 'repairs', label: 'Repairs', icon: Wrench },
      { view: 'replacements', label: 'Replacements', icon: RefreshCw },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Users,
    items: [
      { view: 'customers', label: 'Customers', icon: Users },
      { view: 'suppliers', label: 'Suppliers', icon: Building2 },
      { view: 'expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    items: [
      { view: 'daily-summary', label: 'Daily Summary', icon: Calendar },
      { view: 'weekly-health', label: 'Weekly Health', icon: Heart },
      { view: 'reports', label: 'Cash Book', icon: Receipt },
    ],
  },
];

function isViewInGroup(view: string, group: MenuGroup): boolean {
  return group.items.some((item) => item.view === view);
}

export function CCTVShell() {
  const { activeView, navigate } = useCCTVNavStore();
  const session = useAuthStore((s) => s.session);
  const businessName = session?.business?.name || 'CCTV Shop';

  // Auto-expand the group containing the active view
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    for (const group of MENU_GROUPS) {
      if (isViewInGroup(activeView, group)) {
        setExpandedGroups((prev) => ({ ...prev, [group.id]: true }));
        break;
      }
    }
  }, [activeView]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div className="cctv-shell-wrap min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-violet-100 bg-white">
        {/* Shop header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-violet-50">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
            <Camera className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{businessName}</div>
            <div className="text-xs text-gray-400">CCTV Shop</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {/* Dashboard — single item */}
          <button
            onClick={() => navigate('dashboard')}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full text-left mb-1',
              activeView === 'dashboard'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20'
                : 'text-gray-600 hover:bg-violet-50 hover:text-violet-700'
            )}
          >
            <Home className={cn('h-5 w-5 shrink-0', activeView === 'dashboard' ? 'text-white' : 'text-violet-400')} />
            Dashboard
          </button>

          {/* Groups */}
          {MENU_GROUPS.map((group) => {
            const isExpanded = expandedGroups[group.id] || isViewInGroup(activeView, group);
            const hasActiveChild = isViewInGroup(activeView, group);
            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors w-full text-left',
                    hasActiveChild ? 'text-violet-700' : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <group.icon className={cn('h-4 w-4 shrink-0', hasActiveChild ? 'text-violet-500' : 'text-gray-400')} />
                  <span className="flex-1">{group.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-2 pt-1 space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = activeView === item.view;
                          return (
                            <button
                              key={item.view}
                              onClick={() => navigate(item.view)}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full text-left',
                                isActive
                                  ? 'bg-violet-100 text-violet-700'
                                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                              )}
                            >
                              <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-violet-500' : 'text-gray-400')} />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Settings — single item */}
          <button
            onClick={() => navigate('settings')}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full text-left mt-1',
              activeView === 'settings'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-violet-50 hover:text-violet-700'
            )}
          >
            <Settings className={cn('h-5 w-5 shrink-0', activeView === 'settings' ? 'text-white' : 'text-violet-400')} />
            Settings
          </button>
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
            { view: 'reports-hub' as const, label: 'Reports', icon: BarChart3 },
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
          {activeView === 'categories' && <CCTVCategories />}
          {activeView === 'import-products' && <CCTVImportProducts />}
          {activeView === 'purchase' && <CCTVPurchase />}
          {activeView === 'sales' && <CCTVSales />}
          {activeView === 'estimates' && <CCTVEstimates />}
          {activeView === 'serial-search' && <CCTVSerialSearch />}
          {activeView === 'warranties' && <CCTVWarrantyDashboard />}
          {activeView === 'repairs' && <CCTVRepairs />}
          {activeView === 'repair-detail' && <CCTVRepairs />}
          {activeView === 'repair-token' && <CCTVRepairToken />}
          {activeView === 'replacements' && <CCTVSupplierReplacements />}
          {activeView === 'customers' && <CCTVLedger type="customer" />}
          {activeView === 'suppliers' && <CCTVLedger type="supplier" />}
          {activeView === 'expenses' && <CCTVExpenses />}
          {activeView === 'reports-hub' && <CCTVReportsHub />}
          {activeView === 'reports' && <CCTVCashBook />}
          {activeView === 'stock-report' && <CCTVStockReport />}
          {activeView === 'product-movement' && <CCTVProductMovement />}
          {activeView === 'daily-summary' && <CCTVDailySummary />}
          {activeView === 'weekly-health' && <CCTVWeeklyHealth />}
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
  const [stats, setStats] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.business?.id) return;
    fetch(`/api/businesses/${session.business.id}/cctv/dashboard`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats || null);
        setRecentSales(data.recentSales || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.business?.id]);

  const formatBDT = (n: number) => `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <motion.div {...fadeUp} className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-violet-500/20">
        <h1 className="text-xl font-bold">{businessName}</h1>
        <p className="text-sm text-white/80 mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Buy Products', icon: ShoppingCart, view: 'purchase' as const, gradient: 'from-blue-500 to-indigo-600' },
          { label: 'Sell Products', icon: TrendingUp, view: 'sales' as const, gradient: 'from-emerald-500 to-teal-600' },
          { label: 'New Repair', icon: Wrench, view: 'repairs' as const, gradient: 'from-amber-500 to-orange-600' },
          { label: 'Daily Summary', icon: Calendar, view: 'daily-summary' as const, gradient: 'from-violet-500 to-purple-600' },
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium">Products</span>
            <Package className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xl font-bold text-gray-900">{loading ? '...' : stats?.totalProducts || 0}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            Stock value: {loading ? '...' : formatBDT(stats?.totalStockValue || 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium">Today's Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-600">{loading ? '...' : formatBDT(stats?.todaySalesTotal || 0)}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            {loading ? '...' : `${stats?.todaySaleCount || 0} sale(s) today`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-600">{loading ? '...' : stats?.lowStockCount || 0}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            {(stats?.lowStockCount || 0) === 0 ? 'All OK' : 'Need restock'}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium">Today's Expenses</span>
            <Receipt className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-xl font-bold text-red-600">{loading ? '...' : formatBDT(stats?.todayExpensesTotal || 0)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Spent today</p>
        </div>
      </div>

      {/* Recent Sales */}
      {!loading && recentSales.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Recent Sales</h3>
            <button onClick={() => navigate('sales')} className="text-xs text-violet-600 font-semibold">
              View All
            </button>
          </div>
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{sale.customerName || 'Walk-in Customer'}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(sale.saleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {sale.paymentType === 'credit' && ' · Credit'}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{formatBDT(sale.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Weekly Health', icon: Heart, view: 'weekly-health' as const },
          { label: 'Estimates', icon: FileText, view: 'estimates' as const },
          { label: 'Warranty Dashboard', icon: Shield, view: 'warranties' as const },
          { label: 'Serial Search', icon: Search, view: 'serial-search' as const },
          { label: 'Repairs', icon: Wrench, view: 'repairs' as const },
          { label: 'Replacements', icon: RefreshCw, view: 'replacements' as const },
          { label: 'Customers', icon: Users, view: 'customers' as const },
          { label: 'Suppliers', icon: Building2, view: 'suppliers' as const },
          { label: 'Categories', icon: Tag, view: 'categories' as const },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.view)}
            className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:bg-violet-50 transition-colors text-left"
          >
            <item.icon className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-medium text-gray-700">{item.label}</span>
          </button>
        ))}
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
