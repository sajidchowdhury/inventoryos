"use client";

import {
  LayoutDashboard, Package, ShoppingCart, FileBarChart, MoreHorizontal,
} from "lucide-react";
import { useNavStore, type PharmacyView } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const navItems: { view: PharmacyView; label: string; icon: typeof LayoutDashboard; primary?: boolean; hub?: boolean }[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard },
  { view: "inventory-hub", label: "Stock", icon: Package, hub: true },
  { view: "dispense", label: "Sell", icon: ShoppingCart, primary: true },
  { view: "reports-hub", label: "Reports", icon: FileBarChart, hub: true },
  { view: "more-hub", label: "More", icon: MoreHorizontal, hub: true },
];

// Views that belong to each hub tab
const hubGroups: Record<string, PharmacyView[]> = {
  "inventory-hub": ["products", "product-detail", "add-product", "edit-product", "batches", "add-batch", "edit-batch", "expiry", "categories", "import"],
  "reports-hub": ["analytics", "business-dashboard", "profit-loss", "inventory-value", "business-report", "tax-report", "audit-trail", "data-export", "transactions"],
  "more-hub": ["customers", "customer-detail", "add-customer", "edit-customer", "customer-credit", "suppliers", "supplier-detail", "purchases", "purchase-detail", "add-purchase", "payments", "returns", "discount-rules", "users", "sessions", "login-activity", "alerts", "alert-settings", "ai-insights", "ai-chat", "ai-reorder", "ai-forecast", "ai-expiry-opt", "report", "profile"],
};

export function BottomNav() {
  const { activeView, setActiveView } = useNavStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-around h-14">
        {navItems.map((item) => {
          // Check if current view belongs to this hub
          let isActive = activeView === item.view;
          if (item.hub && hubGroups[item.view]) {
            isActive = isActive || hubGroups[item.view].includes(activeView);
          }

          if (item.primary) {
            return (
              <button
                key={item.view}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveView(item.view)}
              >
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center -mt-3 shadow-md transition-transform active:scale-95",
                  isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium -mt-0.5">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.view}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveView(item.view)}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
