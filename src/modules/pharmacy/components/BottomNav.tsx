"use client";

import {
  LayoutDashboard, Package, ShoppingCart, Sparkles, MoreHorizontal,
} from "lucide-react";
import { useNavStore, type PharmacyView } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

// ── Phase 1: New 5-tab navigation ──
// Home, Stock, Sell, AI (NEW — purple glow), More
// Reports hub moved to More tab — AI gets its own tab
const navItems: { view: PharmacyView; label: string; icon: typeof LayoutDashboard; primary?: boolean; hub?: boolean; isAI?: boolean }[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard },
  { view: "inventory-hub", label: "Stock", icon: Package, hub: true },
  { view: "dispense", label: "Sell", icon: ShoppingCart, primary: true },
  { view: "ai-hub", label: "AI", icon: Sparkles, isAI: true, hub: true },
  { view: "more-hub", label: "More", icon: MoreHorizontal, hub: true },
];

// Views that belong to each hub tab
const hubGroups: Record<string, PharmacyView[]> = {
  "inventory-hub": ["products", "product-detail", "add-product", "edit-product", "batches", "add-batch", "edit-batch", "expiry", "categories", "import", "shelf-scanner"],
  "ai-hub": ["ai-insights", "ai-chat", "ai-reorder", "ai-forecast", "ai-expiry-opt"],
  "more-hub": ["customers", "customer-detail", "add-customer", "edit-customer", "customer-credit", "suppliers", "supplier-detail", "purchases", "purchase-detail", "add-purchase", "payments", "returns", "discount-rules", "users", "sessions", "login-activity", "alerts", "alert-settings", "reports-hub", "report", "profile", "analytics", "business-dashboard", "profit-loss", "inventory-value", "business-report", "tax-report", "audit-trail", "data-export", "transactions"],
};

export function BottomNav() {
  const { activeView, setActiveView } = useNavStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/90 backdrop-blur-xl shadow-nav">
      <div className="max-w-md mx-auto flex items-center justify-around h-14">
        {navItems.map((item) => {
          // Check if current view belongs to this hub
          let isActive = activeView === item.view;
          if (item.hub && hubGroups[item.view]) {
            isActive = isActive || hubGroups[item.view].includes(activeView);
          }

          // ── Primary button (Sell) — elevated circle ──
          if (item.primary) {
            return (
              <button
                key={item.view}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive ? "text-emerald-600" : "text-gray-400 hover:text-gray-700"
                )}
                onClick={() => setActiveView(item.view)}
              >
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center -mt-3 shadow-md transition-all active:scale-95",
                  isActive
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25"
                    : "bg-emerald-50 text-emerald-600"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium -mt-0.5">{item.label}</span>
              </button>
            );
          }

          // ── AI tab — special purple glow ──
          if (item.isAI) {
            return (
              <button
                key={item.view}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all",
                  isActive ? "text-purple-600" : "text-gray-400 hover:text-purple-500"
                )}
                onClick={() => setActiveView(item.view)}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-gradient-to-r from-purple-400 to-purple-600 rounded-b-full" />
                )}
                <div className={cn(
                  "relative h-7 w-7 flex items-center justify-center transition-all",
                  isActive && "animate-pulse-soft"
                )}>
                  {/* Glow background */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-lg bg-purple-100 blur-sm" />
                  )}
                  <item.icon className={cn(
                    "h-5 w-5 relative z-10 transition-colors",
                    isActive ? "text-purple-600" : "text-gray-400"
                  )} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-purple-600 font-semibold" : "text-gray-400"
                )}>{item.label}</span>
              </button>
            );
          }

          // ── Standard nav items ──
          return (
            <button
              key={item.view}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all",
                isActive ? "text-emerald-600" : "text-gray-400 hover:text-gray-700"
              )}
              onClick={() => setActiveView(item.view)}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-emerald-500 rounded-b-full" />
              )}
              <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-emerald-600 font-semibold" : "text-gray-400"
              )}>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
