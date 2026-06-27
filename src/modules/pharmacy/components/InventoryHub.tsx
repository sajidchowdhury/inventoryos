"use client";

import { motion } from "framer-motion";
import {
  Package, Boxes, CalendarClock, Tag, Upload, ChevronRight,
  Plus, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavStore } from "@/lib/nav-store";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const sections = [
  {
    title: "Products",
    items: [
      { icon: Package, label: "All Products", desc: "View, search, manage products", view: "products" as const, color: "text-blue-600", bg: "bg-blue-50" },
      { icon: Plus, label: "Add Product", desc: "Add a new medicine", view: "add-product" as const, color: "text-green-600", bg: "bg-green-50" },
      { icon: Upload, label: "Import CSV", desc: "Bulk import products", view: "import" as const, color: "text-cyan-600", bg: "bg-cyan-50" },
      { icon: Tag, label: "Categories", desc: "Manage product categories", view: "categories" as const, color: "text-purple-600", bg: "bg-purple-50" },
    ],
  },
  {
    title: "Stock & Batches",
    items: [
      { icon: Boxes, label: "All Batches", desc: "View stock by batch", view: "batches" as const, color: "text-orange-600", bg: "bg-orange-50" },
    ],
  },
  {
    title: "Expiry Management",
    items: [
      { icon: CalendarClock, label: "Expiry Dashboard", desc: "Track & manage expiring stock", view: "expiry" as const, color: "text-red-600", bg: "bg-red-50" },
    ],
  },
];

export function InventoryHub() {
  const setActiveView = useNavStore((s) => s.setActiveView);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Inventory</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setActiveView("add-product")}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

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
