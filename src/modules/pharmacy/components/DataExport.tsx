"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Database, Check, Loader2,
  FileJson, FileSpreadsheet, Package, ShoppingCart,
  ShoppingBag, Users, Truck, Boxes, Tag,
  Layers, Wallet, RotateCcw, ArrowRightLeft,
  Percent, AlertCircle, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface ExportModule {
  id: string;
  label: string;
  desc: string;
  icon: typeof Package;
  gradient: string;
  text: string;
}

const exportModules: ExportModule[] = [
  { id: "products", label: "Products", desc: "Product master data", icon: Package, gradient: "from-blue-500 to-blue-600", text: "text-blue-600" },
  { id: "categories", label: "Categories", desc: "Category hierarchy", icon: Tag, gradient: "from-blue-400 to-cyan-500", text: "text-blue-600" },
  { id: "batches", label: "Batches", desc: "Batch records with expiry", icon: Boxes, gradient: "from-cyan-500 to-teal-500", text: "text-cyan-600" },
  { id: "inventory", label: "Inventory", desc: "Stock levels per product", icon: Layers, gradient: "from-teal-500 to-emerald-500", text: "text-teal-600" },
  { id: "sales", label: "Sales", desc: "Invoices + line items", icon: ShoppingCart, gradient: "from-emerald-500 to-green-600", text: "text-emerald-600" },
  { id: "customers", label: "Customers", desc: "Customer profiles", icon: Users, gradient: "from-purple-500 to-fuchsia-500", text: "text-purple-600" },
  { id: "suppliers", label: "Suppliers", desc: "Supplier profiles", icon: Truck, gradient: "from-rose-500 to-pink-500", text: "text-rose-600" },
  { id: "purchases", label: "Purchases", desc: "Purchase orders + items", icon: ShoppingBag, gradient: "from-amber-500 to-orange-500", text: "text-amber-600" },
  { id: "payments", label: "Payments", desc: "Payment records", icon: Wallet, gradient: "from-orange-500 to-red-500", text: "text-orange-600" },
  { id: "returns", label: "Returns", desc: "Return records", icon: RotateCcw, gradient: "from-rose-500 to-red-500", text: "text-rose-600" },
  { id: "transactions", label: "Transactions", desc: "Stock movement log", icon: ArrowRightLeft, gradient: "from-indigo-500 to-violet-500", text: "text-indigo-600" },
  { id: "discountRules", label: "Discount Rules", desc: "Discount rule configs", icon: Percent, gradient: "from-violet-500 to-purple-500", text: "text-violet-600" },
];

export function DataExport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [selected, setSelected] = useState<string[]>(exportModules.map((m) => m.id));
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentExports, setRecentExports] = useState<Array<{ format: string; modules: number; timestamp: string }>>([]);

  const toggleModule = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelected(exportModules.map((m) => m.id));
  const deselectAll = () => setSelected([]);

  const handleExport = (format: "json" | "csv") => {
    if (!businessId || selected.length === 0) {
      setError("Select at least one module to export");
      return;
    }
    setExporting(true);
    setError(null);

    const url = `/api/businesses/${businessId}/export?format=${format}&modules=${selected.join(",")}`;
    window.open(url, "_blank");

    setTimeout(() => {
      setExporting(false);
      setSuccess(true);
      setRecentExports((prev) => [
        { format: format.toUpperCase(), modules: selected.length, timestamp: new Date().toLocaleString("en-GB") },
        ...prev.slice(0, 2),
      ]);
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Data Export</h1>
          <p className="text-[11px] text-muted-foreground">Backup your business data</p>
        </div>
      </div>

      {/* Success */}
      {success && (
        <Card className="card-hover shadow-pharmacy border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 stagger-in">
          <CardContent className="p-3.5 flex items-center gap-2.5 text-sm text-emerald-700">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Check className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">Export downloaded successfully!</span>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="card-hover shadow-pharmacy border-rose-200 bg-gradient-to-r from-rose-50 to-red-50">
          <CardContent className="p-3.5 flex items-center gap-2.5 text-sm text-rose-700">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-white" />
            </div>
            <span className="font-medium">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="card-hover shadow-pharmacy bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 stagger-in">
        <CardContent className="p-3.5 flex items-start gap-2.5 text-xs">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
            <Database className="h-4 w-4 text-white" />
          </div>
          <div className="text-blue-800">
            <p className="font-bold">Data Backup &amp; Export</p>
            <p className="mt-0.5 text-blue-700/90 leading-relaxed">
              Download all your business data as JSON (full backup with relationships) or CSV (spreadsheet summary).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Format Selector - 2 large cards */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Choose Format</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            className={cn(
              "card-hover shadow-pharmacy rounded-2xl p-4 text-left transition-all border-2 relative overflow-hidden",
              exportFormat === "json" ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent"
            )}
            onClick={() => setExportFormat("json")}
          >
            <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -translate-y-8 translate-x-8 blur-xl" />
            <div className="relative">
              <div className="flex items-start justify-between mb-2">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <FileJson className="h-6 w-6 text-white" />
                </div>
                {exportFormat === "json" && (
                  <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-blue-700">JSON Backup</p>
              <p className="text-[10px] text-blue-600/80 mt-0.5">Full data with relationships</p>
            </div>
          </button>

          <button
            className={cn(
              "card-hover shadow-pharmacy rounded-2xl p-4 text-left transition-all border-2 relative overflow-hidden",
              exportFormat === "csv" ? "border-emerald-500 ring-2 ring-emerald-200" : "border-transparent"
            )}
            onClick={() => setExportFormat("csv")}
          >
            <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full -translate-y-8 translate-x-8 blur-xl" />
            <div className="relative">
              <div className="flex items-start justify-between mb-2">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                  <FileSpreadsheet className="h-6 w-6 text-white" />
                </div>
                {exportFormat === "csv" && (
                  <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <p className="text-sm font-bold text-emerald-700">CSV Summary</p>
              <p className="text-[10px] text-emerald-600/80 mt-0.5">Spreadsheet record counts</p>
            </div>
          </button>
        </div>
      </div>

      {/* Module Selection - toggle cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Select Modules</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>Select All</Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={deselectAll}>Clear</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {exportModules.map((mod) => {
            const isSelected = selected.includes(mod.id);
            return (
              <button
                key={mod.id}
                className={cn(
                  "card-hover shadow-pharmacy rounded-xl p-3 text-left transition-all border-2 relative overflow-hidden",
                  isSelected ? "border-emerald-300 bg-emerald-50/30" : "border-transparent opacity-80"
                )}
                onClick={() => toggleModule(mod.id)}
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    "h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm transition-all",
                    mod.gradient,
                    !isSelected && "grayscale opacity-50"
                  )}>
                    <mod.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-semibold truncate", isSelected ? mod.text : "text-muted-foreground")}>{mod.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{mod.desc}</p>
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                    isSelected ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="font-medium">{selected.length} of {exportModules.length} modules selected</span>
          <Badge variant="secondary" className="font-semibold">Full backup</Badge>
        </div>
      </div>

      {/* Export button - gradient emerald full-width */}
      <Button
        size="lg"
        className="h-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-pharmacy-xl font-bold gap-2.5 text-base stagger-in"
        onClick={() => handleExport(exportFormat)}
        disabled={exporting || selected.length === 0}
      >
        {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {exporting ? "Preparing Export..." : `Export as ${exportFormat.toUpperCase()}`}
      </Button>

      {/* Recent Exports */}
      {recentExports.length > 0 && (
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-0">
            <div className="p-3.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Recent Exports</p>
            </div>
            <div className="divide-y">
              {recentExports.map((exp, idx) => (
                <div key={idx} className="p-3.5 flex items-center gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                    exp.format === "JSON" ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-emerald-500 to-teal-600"
                  )}>
                    {exp.format === "JSON" ? <FileJson className="h-4 w-4 text-white" /> : <FileSpreadsheet className="h-4 w-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{exp.format} Export · {exp.modules} modules</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{exp.timestamp}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">Downloaded</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Restore Info */}
      <Card className="card-hover shadow-pharmacy bg-gradient-to-br from-muted/30 to-muted/10 stagger-in">
        <CardContent className="p-3.5 space-y-1.5">
          <p className="text-xs font-bold">Restore / Import</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            To restore from a backup, use the CSV import feature for products.
            Full JSON restore requires database access (server-side operation).
          </p>
          <Button variant="outline" size="sm" className="mt-2 gap-1.5 shadow-pharmacy" onClick={() => setActiveView("import")}>
            <Package className="h-3.5 w-3.5" /> Go to CSV Import
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
