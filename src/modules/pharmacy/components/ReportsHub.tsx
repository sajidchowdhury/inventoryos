"use client";

import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Boxes, Receipt, FileText,
  History, Database, ChevronRight, LayoutDashboard,
  ArrowLeft, Printer, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type ItemColor = "emerald" | "pink" | "green" | "blue" | "orange" | "purple" | "cyan" | "indigo" | "teal";

const colorMap: Record<ItemColor, { icon: string; bg: string; border: string }> = {
  emerald: { icon: "from-emerald-500 to-emerald-600", bg: "text-emerald-50", border: "border-l-emerald-500" },
  pink: { icon: "from-pink-500 to-rose-500", bg: "text-pink-50", border: "border-l-pink-500" },
  green: { icon: "from-green-500 to-emerald-600", bg: "text-green-50", border: "border-l-green-500" },
  blue: { icon: "from-blue-500 to-blue-600", bg: "text-blue-50", border: "border-l-blue-500" },
  orange: { icon: "from-orange-500 to-amber-500", bg: "text-orange-50", border: "border-l-orange-500" },
  purple: { icon: "from-purple-500 to-fuchsia-500", bg: "text-purple-50", border: "border-l-purple-500" },
  cyan: { icon: "from-cyan-500 to-sky-500", bg: "text-cyan-50", border: "border-l-cyan-500" },
  indigo: { icon: "from-indigo-500 to-violet-500", bg: "text-indigo-50", border: "border-l-indigo-500" },
  teal: { icon: "from-teal-500 to-emerald-500", bg: "text-teal-50", border: "border-l-teal-500" },
};

interface ReportItem {
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
  view: string;
  color: ItemColor;
}

interface ReportSection {
  title: string;
  accent: "blue" | "purple" | "sky";
  items: ReportItem[];
}

const sections: ReportSection[] = [
  {
    title: "Overview",
    accent: "blue",
    items: [
      { icon: LayoutDashboard, label: "Business Overview", desc: "Unified KPIs & financial position", view: "business-dashboard", color: "emerald" },
      { icon: BarChart3, label: "Sales Analytics", desc: "Trends, peak hours, top products", view: "analytics", color: "pink" },
    ],
  },
  {
    title: "Financial Reports",
    accent: "purple",
    items: [
      { icon: TrendingUp, label: "Profit & Loss", desc: "Revenue vs COGS, margins", view: "profit-loss", color: "green" },
      { icon: Boxes, label: "Inventory Valuation", desc: "Cost & MRP value of stock", view: "inventory-value", color: "blue" },
      { icon: FileText, label: "VAT / Tax Report", desc: "Bangladesh VAT compliance", view: "tax-report", color: "orange" },
      { icon: Receipt, label: "Business Report", desc: "Comprehensive printable report", view: "business-report", color: "purple" },
    ],
  },
  {
    title: "Audit & Data",
    accent: "sky",
    items: [
      { icon: History, label: "Audit Trail", desc: "Complete transaction history", view: "audit-trail", color: "cyan" },
      { icon: History, label: "Activity Log", desc: "Stock movements & events", view: "transactions", color: "indigo" },
      { icon: Database, label: "Data Export", desc: "Backup your data", view: "data-export", color: "teal" },
    ],
  },
];

const sectionAccentMap = {
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-fuchsia-500",
  sky: "from-sky-500 to-cyan-500",
};

export function ReportsHub() {
  const setActiveView = useNavStore((s) => s.setActiveView);

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Reports</h1>
          <p className="text-[11px] text-muted-foreground">Analytics & business insights</p>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title} className="space-y-2.5">
          {/* Colored section header */}
          <div className="flex items-center gap-2">
            <span className={cn("h-5 w-1.5 rounded-full bg-gradient-to-b", sectionAccentMap[section.accent])} />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{section.title}</h2>
          </div>

          <div className="space-y-2">
            {section.items.map((item) => {
              const c = colorMap[item.color];
              return (
                <Card
                  key={item.view}
                  className={cn(
                    "card-hover shadow-pharmacy cursor-pointer border-l-4 overflow-hidden",
                    c.border
                  )}
                  onClick={() => setActiveView(item.view as never)}
                >
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm", c.icon)}>
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <div className="h-7 w-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Printable Report Card */}
      <Card
        className="card-hover shadow-pharmacy-xl overflow-hidden border-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white"
        onClick={() => setActiveView("business-report" as never)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 shadow-lg">
            <Printer className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-100" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Quick Action</p>
            </div>
            <p className="text-base font-bold mt-0.5">Printable Business Report</p>
            <p className="text-[11px] text-emerald-50/90 mt-0.5">Generate a comprehensive one-page report</p>
          </div>
          <Button size="sm" className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shrink-0 shadow-md">
            Generate
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
