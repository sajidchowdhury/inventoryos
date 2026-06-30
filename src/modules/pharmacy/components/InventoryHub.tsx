"use client";

import { motion } from "framer-motion";
import {
  Package, Boxes, CalendarClock, Tag, Upload, ChevronRight,
  Plus, Search,
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
    title: "Stock & Batches",
    accentText: "text-orange-600",
    accentDot: "bg-orange-500",
    border: "border-l-orange-500",
    items: [
      { icon: Boxes, label: "All Batches", desc: "View stock by batch", view: "batches" as const, gradient: "from-orange-500 to-amber-600" },
    ],
  },
  {
    title: "Expiry Management",
    accentText: "text-rose-600",
    accentDot: "bg-rose-500",
    border: "border-l-rose-500",
    items: [
      { icon: CalendarClock, label: "Expiry Dashboard", desc: "Track & manage expiring stock", view: "expiry" as const, gradient: "from-rose-500 to-rose-600" },
    ],
  },
  {
    title: "Products",
    accentText: "text-blue-600",
    accentDot: "bg-blue-500",
    border: "border-l-blue-500",
    items: [
      { icon: Package, label: "All Products", desc: "View, search, manage products", view: "products" as const, gradient: "from-blue-500 to-blue-600" },
      { icon: Plus, label: "Add Product", desc: "Add a new medicine", view: "add-product" as const, gradient: "from-emerald-500 to-emerald-600" },
      { icon: Search, label: "Add from Catalog", desc: "Search 14K+ products & add in seconds", view: "catalog-picker" as const, gradient: "from-violet-500 to-purple-600" },
      { icon: Upload, label: "Import CSV", desc: "Bulk import products", view: "import" as const, gradient: "from-cyan-500 to-cyan-600" },
      { icon: Tag, label: "Categories", desc: "Manage product categories", view: "categories" as const, gradient: "from-purple-500 to-purple-600" },
    ],
  },
];

export function InventoryHub() {
  const setActiveView = useNavStore((s) => s.setActiveView);

  return (
    <motion.div {...fadeIn} className="space-y-5 pb-4 pharmacy-bg">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage your products, stock & expiry
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-pharmacy border-0"
          onClick={() => setActiveView("add-product")}
        >
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-2.5">
          {/* Section header */}
          <div className="flex items-center gap-2 px-1">
            <span className={`h-1.5 w-1.5 rounded-full ${section.accentDot}`} />
            <h2 className={`text-xs font-bold uppercase tracking-wider ${section.accentText}`}>
              {section.title}
            </h2>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {section.items.map((item) => (
              <Card
                key={item.view}
                className={`card-hover stagger-in cursor-pointer border-l-4 ${section.border} shadow-pharmacy`}
                onClick={() => setActiveView(item.view)}
              >
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div
                    className={`h-11 w-11 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
