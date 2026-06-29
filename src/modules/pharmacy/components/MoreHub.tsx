"use client";

import { motion } from "framer-motion";
import {
  Users, DollarSign, RotateCcw, Percent, ChevronRight, LogOut,
  UserCog, Shield, Bell, User, CreditCard, Pencil,
  LayoutDashboard, TrendingUp, Boxes, Receipt, History, Database,
  FileText, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore, type PharmacyView } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type SectionAccent = "blue" | "emerald" | "amber" | "sky" | "gray";

const accentMap: Record<SectionAccent, { bar: string; dot: string }> = {
  blue:    { bar: "from-blue-500 to-blue-600",       dot: "bg-blue-500" },
  emerald: { bar: "from-emerald-500 to-emerald-600", dot: "bg-emerald-500" },
  amber:   { bar: "from-amber-500 to-orange-500",    dot: "bg-amber-500" },
  sky:     { bar: "from-sky-500 to-cyan-500",        dot: "bg-sky-500" },
  gray:    { bar: "from-slate-400 to-slate-500",     dot: "bg-slate-400" },
};

interface MoreItem {
  icon: typeof Users;
  label: string;
  desc: string;
  view: PharmacyView;
  gradient: string;
  badge?: string;
}

interface MoreSection {
  title: string;
  accent: SectionAccent;
  items: MoreItem[];
}

// ── Reorganized: Admin → Operations → Reports (top to bottom) ──
// Purchasing removed (accessible from Home quick actions)
// All settings consolidated under Admin section
// All reports listed individually (not just a hub link)
const sections: MoreSection[] = [
  {
    title: "Admin",
    accent: "blue",
    items: [
      { icon: Users, label: "Customers", desc: "Customer profiles & credit", view: "customers", gradient: "from-blue-500 to-blue-600" },
      { icon: UserCog, label: "User Management", desc: "Roles & permissions", view: "users", gradient: "from-slate-500 to-slate-600" },
      { icon: Shield, label: "Alert Settings", desc: "Configure thresholds", view: "alert-settings", gradient: "from-stone-500 to-slate-500" },
      { icon: Bell, label: "Alerts Center", desc: "View all alerts", view: "alerts", gradient: "from-red-500 to-rose-500" },
      { icon: User, label: "Profile", desc: "Business & account info", view: "profile", gradient: "from-emerald-500 to-emerald-600" },
      { icon: CreditCard, label: "Subscription", desc: "Plan & AI usage", view: "subscription", gradient: "from-violet-500 to-purple-600" },
    ],
  },
  {
    title: "Operations",
    accent: "amber",
    items: [
      { icon: DollarSign, label: "Payments", desc: "Record & track payments", view: "payments", gradient: "from-amber-500 to-orange-500" },
      { icon: RotateCcw, label: "Returns", desc: "Process returns & refunds", view: "returns", gradient: "from-rose-500 to-red-500" },
      { icon: Percent, label: "Discount Rules", desc: "Auto-discount rules", view: "discount-rules", gradient: "from-orange-500 to-amber-500" },
    ],
  },
  {
    title: "Reports",
    accent: "sky",
    items: [
      { icon: LayoutDashboard, label: "Business Dashboard", desc: "Unified KPIs & financial position", view: "business-dashboard", gradient: "from-sky-500 to-blue-500" },
      { icon: TrendingUp, label: "Profit & Loss", desc: "Revenue vs COGS, margin analysis", view: "profit-loss", gradient: "from-emerald-500 to-teal-500" },
      { icon: Boxes, label: "Inventory Valuation", desc: "Cost & MRP value of stock", view: "inventory-value", gradient: "from-blue-500 to-indigo-500" },
      { icon: Receipt, label: "Tax Report", desc: "VAT / tax compliance", view: "tax-report", gradient: "from-amber-500 to-orange-500" },
      { icon: FileText, label: "Expiry Report", desc: "Printable expiry report", view: "report", gradient: "from-cyan-500 to-blue-500" },
      { icon: History, label: "Audit Trail", desc: "Transaction history & logs", view: "audit-trail", gradient: "from-cyan-500 to-sky-500" },
      { icon: Database, label: "Data Export", desc: "Backup & export your data", view: "data-export", gradient: "from-teal-500 to-cyan-500" },
    ],
  },
];

function getInitials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MoreHub() {
  const { reset, session } = useAuthStore();
  const setActiveView = useNavStore((s) => s.setActiveView);

  const fullName = session?.user?.fullName || session?.user?.username || "User";
  const role = session?.user?.role || "";
  const businessName = session?.business?.name || "";

  return (
    <motion.div
      {...fadeIn}
      className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-5 pb-6"
    >
      <h1 className="text-xl font-bold tracking-tight">More</h1>

      {/* ── Profile Card — gradient emerald header ── */}
      <Card className="stagger-in overflow-hidden border-0 shadow-pharmacy-lg">
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5">
          {/* Decorative bubbles */}
          <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur ring-2 ring-white/30 flex items-center justify-center shrink-0">
              <span className="text-white text-lg font-bold tracking-wide">{getInitials(fullName)}</span>
            </div>
            <div className="flex-1 min-w-0 text-white">
              <p className="text-base font-bold leading-tight truncate">{fullName}</p>
              <p className="text-[11px] text-emerald-50/90 capitalize mt-0.5">{role}</p>
              {businessName && (
                <p className="text-[10px] text-emerald-100/80 truncate mt-0.5">{businessName}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur shrink-0 gap-1.5"
              onClick={() => setActiveView("profile")}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Grouped Sections ── */}
      {sections.map((section) => {
        const accent = accentMap[section.accent];
        return (
          <div key={section.title} className="space-y-2.5">
            {/* Colored section header */}
            <div className="flex items-center gap-2">
              <span className={cn("h-5 w-1.5 rounded-full bg-gradient-to-b", accent.bar)} />
              <span className={cn("h-1.5 w-1.5 rounded-full", accent.dot)} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h2>
            </div>

            <div className="space-y-2">
              {section.items.map((item) => (
                <Card
                  key={`${section.title}-${item.label}`}
                  className="card-hover shadow-pharmacy cursor-pointer border-0 overflow-hidden stagger-in"
                  onClick={() => setActiveView(item.view)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div
                      className={cn(
                        "h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
                        item.gradient
                      )}
                    >
                      <item.icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold leading-tight">{item.label}</p>
                        {item.badge && (
                          <Badge className="text-[8px] h-4 px-1.5 py-0 bg-purple-100 text-purple-700 hover:bg-purple-100">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Logout — gradient rose ── */}
      <Button
        className="w-full gap-2 h-11 mt-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-0 shadow-md shadow-rose-500/20"
        onClick={reset}
      >
        <LogOut className="h-4 w-4" /> Log Out
      </Button>

      <p className="text-center text-[10px] text-muted-foreground pt-1">
        InventoryOS · Pharmacy Management
      </p>
    </motion.div>
  );
}
