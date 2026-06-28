"use client";

import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Boxes, Receipt, FileText,
  History, Database, ChevronRight, LayoutDashboard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavStore } from "@/lib/nav-store";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const sections = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Business Overview", desc: "Unified KPIs & financial position", view: "business-dashboard" as const, color: "text-primary", bg: "bg-primary/10" },
      { icon: BarChart3, label: "Sales Analytics", desc: "Trends, peak hours, top products", view: "analytics" as const, color: "text-pink-600", bg: "bg-pink-50" },
    ],
  },
  {
    title: "Financial Reports",
    items: [
      { icon: TrendingUp, label: "Profit & Loss", desc: "Revenue vs COGS, margins", view: "profit-loss" as const, color: "text-green-600", bg: "bg-green-50" },
      { icon: Boxes, label: "Inventory Valuation", desc: "Cost & MRP value of stock", view: "inventory-value" as const, color: "text-blue-600", bg: "bg-blue-50" },
      { icon: FileText, label: "VAT / Tax Report", desc: "Bangladesh VAT compliance", view: "tax-report" as const, color: "text-orange-600", bg: "bg-orange-50" },
      { icon: Receipt, label: "Business Report", desc: "Comprehensive printable report", view: "business-report" as const, color: "text-purple-600", bg: "bg-purple-50" },
    ],
  },
  {
    title: "Audit & Data",
    items: [
      { icon: History, label: "Audit Trail", desc: "Complete transaction history", view: "audit-trail" as const, color: "text-cyan-600", bg: "bg-cyan-50" },
      { icon: History, label: "Activity Log", desc: "Stock movements & events", view: "transactions" as const, color: "text-indigo-600", bg: "bg-indigo-50" },
      { icon: Database, label: "Data Export", desc: "Backup your data", view: "data-export" as const, color: "text-teal-600", bg: "bg-teal-50" },
    ],
  },
];

export function ReportsHub() {
  const setActiveView = useNavStore((s) => s.setActiveView);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <h1 className="text-lg font-bold">Reports & Analytics</h1>

      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">{section.title}</h2>
          <div className="space-y-1.5">
            {section.items.map((item) => (
              <Card key={item.view} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveView(item.view)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
