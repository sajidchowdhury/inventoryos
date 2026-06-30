"use client";

// AdminSidebar — left sidebar navigation for the super admin panel.
// 5 sections: Global Dashboard, API Setup, Pharmacy, CC Camera, Others (placeholder).
// On mobile, collapses to a bottom tab bar.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Settings, Pill, Cctv, MoreHorizontal,
  ShieldCheck, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Global Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Cross-project metrics & platform health",
  },
  {
    label: "API Setup",
    href: "/admin/api-setup",
    icon: Settings,
    description: "SMTP, Z.ai, Database, Cron, Alerts",
  },
  {
    label: "Deploy",
    href: "/admin/deploy",
    icon: Rocket,
    description: "Deployment checklist & Hostinger guide",
  },
  {
    label: "Pharmacy",
    href: "/admin/pharmacy",
    icon: Pill,
    description: "Pharmacy-specific dashboard",
    badge: "Active",
  },
  {
    label: "CC Camera",
    href: "/admin/cctv",
    icon: Cctv,
    description: "CCTV inventory (coming soon)",
    badge: "Soon",
    disabled: true,
  },
  {
    label: "More Projects",
    href: "/admin/projects",
    icon: MoreHorizontal,
    description: "Grocery, Restaurant, Mobile, etc.",
    badge: "Soon",
    disabled: true,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-slate-950 text-slate-300 fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">InventoryOS</div>
            <div className="text-xs text-slate-500">Super Admin</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 cursor-not-allowed"
                  title={item.description}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{item.badge}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-purple-600 text-white font-medium"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
                title={item.description}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    item.badge === "Active" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800">
          <div className="text-xs text-slate-600 px-3">
            v1.5.0 · Phase 1 Redesign
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t bg-slate-950 text-slate-400 px-1 py-1">
        {NAV_ITEMS.filter((_, i) => i < 4).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          if (item.disabled) {
            return (
              <div key={item.href} className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-slate-700">
                <Icon className="h-4 w-4" />
                <span className="text-[9px]">{item.label.split(" ")[0]}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors",
                isActive ? "text-purple-400" : "text-slate-500"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[9px]">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
