'use client';

// PharmacyDesktopSidebar — left sidebar navigation for the pharmacy module on desktop.
// Visible on md: and above (768px+). Mirrors the BottomNav items in a
// vertical layout with emerald accent color.
// On mobile, this is hidden and BottomNav is shown instead.

import {
  LayoutDashboard, Package, ShoppingCart, Sparkles, MoreHorizontal, Pill,
} from 'lucide-react';
import { useNavStore, type PharmacyView } from '@/lib/nav-store';
import { cn } from '@/lib/utils';

const navItems: { view: PharmacyView; label: string; icon: typeof LayoutDashboard; primary?: boolean; hub?: boolean; isAI?: boolean }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'inventory-hub', label: 'Inventory', icon: Package, hub: true },
  { view: 'dispense', label: 'Dispense', icon: ShoppingCart, primary: true },
  { view: 'ai-hub', label: 'AI Center', icon: Sparkles, isAI: true, hub: true },
  { view: 'more-hub', label: 'More', icon: MoreHorizontal, hub: true },
];

const hubGroups: Record<string, PharmacyView[]> = {
  'inventory-hub': ['products', 'product-detail', 'add-product', 'edit-product', 'batches', 'add-batch', 'edit-batch', 'expiry', 'categories', 'import', 'shelf-scanner', 'stock-count-day', 'catalog-picker'],
  'ai-hub': ['ai-insights', 'ai-chat', 'ai-reorder', 'ai-forecast', 'ai-expiry-opt'],
  'more-hub': ['customers', 'customer-detail', 'add-customer', 'edit-customer', 'customer-credit', 'suppliers', 'supplier-detail', 'purchases', 'purchase-detail', 'add-purchase', 'payments', 'returns', 'discount-rules', 'users', 'sessions', 'login-activity', 'alerts', 'alert-settings', 'reports-hub', 'report', 'profile', 'analytics', 'business-dashboard', 'profit-loss', 'inventory-value', 'business-report', 'tax-report', 'audit-trail', 'data-export', 'transactions', 'subscription'],
};

export function PharmacyDesktopSidebar() {
  const { activeView, setActiveView } = useNavStore();

  const getIsActive = (view: PharmacyView, item: typeof navItems[0]): boolean => {
    if (activeView === view) return true;
    if (item.hub && hubGroups[view]?.includes(activeView)) return true;
    return false;
  };

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-emerald-100 bg-white">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-emerald-50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md">
          <Pill className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900">Pharmacy</div>
          <div className="text-xs text-gray-400">InventoryOS</div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = getIsActive(item.view, item);
          const Icon = item.icon;

          return (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full text-left',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-emerald-400')} />
              <span className="flex-1">{item.label}</span>
              {item.isAI && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'
                )}>
                  AI
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-emerald-50">
        <div className="text-xs text-gray-400 px-3">
          InventoryOS · Pharmacy Module
        </div>
      </div>
    </aside>
  );
}
