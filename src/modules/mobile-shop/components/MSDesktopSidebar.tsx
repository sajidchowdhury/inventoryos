'use client';

// MSDesktopSidebar — left sidebar navigation for the MobileShop module on desktop.
// Visible on md: and above (768px+). Mirrors the MSBottomNav items in a
// vertical layout with cyan accent color.
// On mobile, this is hidden and MSBottomNav is shown instead.

import {
  Home, Package, ShoppingCart, Sparkles, MoreHorizontal, Smartphone,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import type { MSViewType } from '../types';
import { cn } from '@/lib/utils';

const navItems: { view: MSViewType; label: string; icon: typeof Home; primary?: boolean; hub?: boolean; isAI?: boolean }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: Home },
  { view: 'inventory-hub', label: 'Inventory', icon: Package, hub: true },
  { view: 'sell', label: 'Sell', icon: ShoppingCart, primary: true },
  { view: 'ai-hub', label: 'AI Center', icon: Sparkles, isAI: true, hub: true },
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

export function MSDesktopSidebar() {
  const { activeView, navigate } = useMSNavStore();

  const getIsActive = (view: MSViewType, item: typeof navItems[0]): boolean => {
    if (activeView === view) return true;
    if (item.hub && hubGroups[view]?.includes(activeView)) return true;
    return false;
  };

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-cyan-100 bg-white">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-cyan-50">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md">
          <Smartphone className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-gray-900">Mobile Shop</div>
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
              onClick={() => navigate(item.view)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full text-left',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-700'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-white' : 'text-cyan-400')} />
              <span className="flex-1">{item.label}</span>
              {item.isAI && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                  isActive ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-600'
                )}>
                  AI
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-cyan-50">
        <div className="text-xs text-gray-400 px-3">
          InventoryOS · MobileShop Module
        </div>
      </div>
    </aside>
  );
}
