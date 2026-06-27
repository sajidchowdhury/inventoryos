"use client";

import { motion } from "framer-motion";
import {
  Users, Truck, PackagePlus, DollarSign, RotateCcw,
  Percent, Shield, Bell, Sparkles, MessageSquare,
  Brain, Zap, LineChart, ChevronRight, LogOut,
  UserCog, FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const sections = [
  {
    title: "People",
    items: [
      { icon: Users, label: "Customers", desc: "Customer profiles & credit", view: "customers" as const, color: "text-blue-600", bg: "bg-blue-50" },
      { icon: Truck, label: "Suppliers", desc: "Vendor management", view: "suppliers" as const, color: "text-orange-600", bg: "bg-orange-50" },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { icon: PackagePlus, label: "New Purchase", desc: "Record stock receipt", view: "add-purchase" as const, color: "text-green-600", bg: "bg-green-50" },
      { icon: Truck, label: "Purchase History", desc: "All purchase orders", view: "purchases" as const, color: "text-lime-600", bg: "bg-lime-50" },
    ],
  },
  {
    title: "Sales & Payments",
    items: [
      { icon: DollarSign, label: "Payments", desc: "Record & track payments", view: "payments" as const, color: "text-emerald-600", bg: "bg-emerald-50" },
      { icon: RotateCcw, label: "Returns", desc: "Process returns & refunds", view: "returns" as const, color: "text-red-600", bg: "bg-red-50" },
      { icon: Percent, label: "Discount Rules", desc: "Auto-discount rules", view: "discount-rules" as const, color: "text-teal-600", bg: "bg-teal-50" },
    ],
  },
  {
    title: "AI Features",
    items: [
      { icon: Sparkles, label: "AI Insights", desc: "Business health analysis", view: "ai-insights" as const, color: "text-primary", bg: "bg-primary/10" },
      { icon: MessageSquare, label: "AI Assistant", desc: "Ask questions about your data", view: "ai-chat" as const, color: "text-purple-600", bg: "bg-purple-50" },
      { icon: Brain, label: "Smart Reorder", desc: "AI stock predictions", view: "ai-reorder" as const, color: "text-teal-600", bg: "bg-teal-50" },
      { icon: LineChart, label: "Demand Forecast", desc: "Predict future sales", view: "ai-forecast" as const, color: "text-indigo-600", bg: "bg-indigo-50" },
      { icon: Zap, label: "Expiry Optimizer", desc: "AI action recommendations", view: "ai-expiry-opt" as const, color: "text-amber-600", bg: "bg-amber-50" },
    ],
  },
  {
    title: "Settings",
    items: [
      { icon: UserCog, label: "User Management", desc: "Roles & permissions", view: "users" as const, color: "text-stone-600", bg: "bg-stone-50" },
      { icon: Shield, label: "Alert Settings", desc: "Configure thresholds", view: "alert-settings" as const, color: "text-yellow-600", bg: "bg-yellow-50" },
      { icon: Bell, label: "Alerts Center", desc: "View all alerts", view: "alerts" as const, color: "text-red-600", bg: "bg-red-50" },
      { icon: FileText, label: "Expiry Report", desc: "Printable expiry report", view: "report" as const, color: "text-cyan-600", bg: "bg-cyan-50" },
    ],
  },
];

export function MoreHub() {
  const { reset, session } = useAuthStore();
  const setActiveView = useNavStore((s) => s.setActiveView);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <h1 className="text-lg font-bold">More</h1>

      {/* User Card */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{session?.user?.fullName || session?.user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">{session?.user?.role} · {session?.business?.name}</p>
          </div>
        </CardContent>
      </Card>

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

      {/* Logout */}
      <Button variant="destructive" className="w-full gap-2 h-11" onClick={reset}>
        <LogOut className="h-4 w-4" /> Log Out
      </Button>
    </motion.div>
  );
}
