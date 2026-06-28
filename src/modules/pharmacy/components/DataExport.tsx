"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Database, Check, Loader2,
  FileJson, FileText, Package, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const exportModules = [
  { id: "products", label: "Products", desc: "All product master data" },
  { id: "categories", label: "Categories", desc: "Category hierarchy" },
  { id: "batches", label: "Batches", desc: "All batch records with expiry" },
  { id: "inventory", label: "Inventory", desc: "Stock levels per product" },
  { id: "sales", label: "Sales", desc: "All invoices + line items" },
  { id: "customers", label: "Customers", desc: "Customer profiles" },
  { id: "suppliers", label: "Suppliers", desc: "Supplier profiles" },
  { id: "purchases", label: "Purchases", desc: "All purchase orders + items" },
  { id: "payments", label: "Payments", desc: "All payment records" },
  { id: "returns", label: "Returns", desc: "All return records" },
  { id: "transactions", label: "Transactions", desc: "Stock movement audit log" },
  { id: "discountRules", label: "Discount Rules", desc: "Configured discount rules" },
];

export function DataExport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [selected, setSelected] = useState<string[]>(exportModules.map((m) => m.id));
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Data Export</h1>
      </div>

      {success && (
        <Card className="border-green-500/50 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> Export downloaded successfully!
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 flex items-start gap-2 text-xs text-blue-700">
          <Database className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Data Backup & Export</p>
            <p className="mt-0.5">
              Download all your business data as JSON (full backup) or CSV (summary).
              JSON includes all records with relationships — use for backups.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Module Selection */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Select Modules to Export</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-xs" onClick={selectAll}>Select All</Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={deselectAll}>Clear</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {exportModules.map((mod) => (
              <button
                key={mod.id}
                className={cn(
                  "flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors",
                  selected.includes(mod.id)
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:bg-muted/30"
                )}
                onClick={() => toggleModule(mod.id)}
              >
                <Checkbox checked={selected.includes(mod.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{mod.label}</p>
                  <p className="text-[10px] text-muted-foreground">{mod.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>{selected.length} of {exportModules.length} modules selected</span>
            <Badge variant="secondary">Full backup</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          className="h-14 gap-2"
          onClick={() => handleExport("json")}
          disabled={exporting || selected.length === 0}
        >
          {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileJson className="h-5 w-5" />}
          <div className="text-left">
            <p className="text-sm font-bold">JSON Backup</p>
            <p className="text-[10px] opacity-80">Full data with relationships</p>
          </div>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 gap-2"
          onClick={() => handleExport("csv")}
          disabled={exporting || selected.length === 0}
        >
          <FileText className="h-5 w-5" />
          <div className="text-left">
            <p className="text-sm font-bold">CSV Summary</p>
            <p className="text-[10px] opacity-80">Record counts overview</p>
          </div>
        </Button>
      </div>

      {/* Restore Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-3 space-y-1">
          <p className="text-xs font-semibold">Restore / Import</p>
          <p className="text-[11px] text-muted-foreground">
            To restore from a backup, use the CSV import feature for products.
            Full JSON restore requires database access (server-side operation).
          </p>
          <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setActiveView("import")}>
            <Package className="h-3.5 w-3.5" /> Go to CSV Import
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
