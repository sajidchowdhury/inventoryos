"use client";

import {
  LayoutDashboard, Package, ShoppingCart, Boxes, User,
} from "lucide-react";
import { useNavStore, type PharmacyView } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const navItems: { view: PharmacyView; label: string; icon: typeof LayoutDashboard; primary?: boolean }[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard },
  { view: "products", label: "Products", icon: Package },
  { view: "dispense", label: "Dispense", icon: ShoppingCart, primary: true },
  { view: "batches", label: "Stock", icon: Boxes },
  { view: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const { activeView, setActiveView } = useNavStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-around h-14">
        {navItems.map((item) => {
          // Treat product-related views as "Products" active state
          const isActive =
            activeView === item.view ||
            (item.view === "products" && (activeView === "product-detail" || activeView === "edit-product" || activeView === "add-product" || activeView === "add-batch" || activeView === "edit-batch")) ||
            (item.view === "batches" && activeView === "edit-batch") ||
            (item.view === "dispense" && activeView === "dispense");

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
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveView(item.view)}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area for phones with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
