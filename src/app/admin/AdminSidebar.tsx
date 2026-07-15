"use client";

// AdminSidebar — left sidebar navigation for the super admin panel.
// Soft warm-neutral palette optimized for long admin sessions.
// Structure: Command Center → Clients → Business Modules (1 menu each) → System.
// On mobile, collapses to a bottom tab bar.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Settings, Pill, Rocket, Package, Users, ShieldCheck, Smartphone, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

interface NavSection {
  heading?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Command Center",
        href: "/admin",
        icon: LayoutDashboard,
        description: "Platform overview + system health",
      },
      {
        label: "Clients",
        href: "/admin/clients",
        icon: Users,
        description: "Subscriptions + revenue tracking",
      },
    ],
  },
  {
    heading: "Business Modules",
    items: [
      {
        label: "CCTV Shop",
        href: "/admin/cctv",
        icon: Camera,
        description: "CCTV business — overview + master catalog",
        badge: "Live",
      },
      {
        label: "Pharmacy",
        href: "/admin/pharmacy",
        icon: Pill,
        description: "Pharmacy business — overview + 14K catalog",
        badge: "Live",
      },
      {
        label: "Mobile Shop",
        href: "/admin/mobile-shop",
        icon: Smartphone,
        description: "Mobile shop business module",
        badge: "Soon",
        disabled: true,
      },
      {
        label: "Grocery",
        href: "/admin/grocery",
        icon: Package,
        description: "Grocery shop module",
        badge: "Soon",
        disabled: true,
      },
      {
        label: "Restaurant",
        href: "/admin/restaurant",
        icon: Package,
        description: "Restaurant module",
        badge: "Soon",
        disabled: true,
      },
    ],
  },
  {
    heading: "System",
    items: [
      {
        label: "System Config",
        href: "/admin/api-setup",
        icon: Settings,
        description: "AI, SMTP, Cron, Kill Switches",
      },
      {
        label: "Deploy",
        href: "/admin/deploy",
        icon: Rocket,
        description: "Build + deploy guide",
      },
    ],
  },
];

// Flatten sections for the mobile bottom tab bar (first 4 items only)
const FLAT_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function BadgePill({ badge }: { badge?: string }) {
  if (!badge) return null;
  if (badge === "Live" || badge === "Active") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-success text-success-foreground border border-success-border">
        <span className="h-1 w-1 rounded-full bg-success-foreground animate-pulse" />
        {badge}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
      {badge}
    </span>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col fixed inset-y-0 left-0 z-30 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">InventoryOS</div>
            <div className="text-xs text-muted-foreground">Super Admin</div>
          </div>
        </div>

        {/* Nav items — grouped by section */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {section.heading && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {section.heading}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed"
                      title={item.description}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <BadgePill badge={item.badge} />
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ease-out",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                    title={item.description}
                  >
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )} />
                    <span className="flex-1">{item.label}</span>
                    <BadgePill badge={item.badge} />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="text-[11px] text-muted-foreground/70 px-3">
            v1.7.0 · Soft neutral theme
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur-md px-1 py-1 safe-area-bottom">
        {FLAT_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          if (item.disabled) {
            return (
              <div key={item.href} className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground/40">
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
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors duration-200 ease-out",
                active ? "text-primary" : "text-muted-foreground"
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
