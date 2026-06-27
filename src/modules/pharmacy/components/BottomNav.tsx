"use client";

import {
  LayoutDashboard, Package, PlusCircle, Tag, User,
} from "lucide-react";
import { useNavStore, type PharmacyView } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const navItems: { view: PharmacyView; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard },
  { view: "products", label: "Products", icon: Package },
  { view: "add-product", label: "Add", icon: PlusCircle },
  { view: "categories", label: "Categories", icon: Tag },
  { view: "profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const { activeView, setActiveView } = useNavStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = activeView === item.view ||
            (item.view === "products" && activeView === "edit-product");

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
              <item.icon className={cn("h-5 w-5", item.view === "add-product" && "h-6 w-6")} />
              <span className={cn(
                "text-[10px] font-medium",
                item.view === "add-product" && "text-[11px]"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area for phones with home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
