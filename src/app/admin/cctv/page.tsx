"use client";

// /admin/cctv — CCTV business module (consolidated).
// One menu per business: Overview tab + Catalog tab.
// The Catalog tab embeds the same CCTVCatalogContent component used by
// /admin/catalog/cctv, so the master product catalog lives inside the
// CCTV business instead of being a separate sidebar entry.

import { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, LayoutDashboard, Package, Activity, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CCTVCatalogContent } from "../catalog/cctv/CCTVCatalogContent";

type Tab = "overview" | "catalog";

export default function CCTVPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      {/* Header card with status + tab switcher */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 tracking-tight">
                <Camera className="h-5 w-5 text-primary" />
                CCTV Shop
                <Badge variant="success">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success-foreground/80 animate-pulse" />
                    Live
                  </span>
                </Badge>
              </CardTitle>
              <CardDescription>
                Security & surveillance equipment — inventory, purchases, sales, warranty, repairs, and reports.
              </CardDescription>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                size="sm"
                variant={tab === "overview" ? "default" : "ghost"}
                onClick={() => setTab("overview")}
                className={cn("gap-1.5", tab === "overview" && "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Overview
              </Button>
              <Button
                size="sm"
                variant={tab === "catalog" ? "default" : "ghost"}
                onClick={() => setTab("catalog")}
                className={cn("gap-1.5", tab === "catalog" && "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                <Package className="h-4 w-4" />
                Catalog
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Module Status</span>
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Live</div>
              <div className="text-xs text-muted-foreground">Production-ready</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs text-muted-foreground">DB Hardening</span>
              </div>
              <div className="text-lg font-bold">98/100</div>
              <div className="text-xs text-muted-foreground">Phase 1–10 complete</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs text-muted-foreground">Catalog</span>
              </div>
              <div className="text-lg font-bold">Master</div>
              <div className="text-xs text-muted-foreground">CSV import + manual entry</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Camera className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                <span className="text-xs text-muted-foreground">Features</span>
              </div>
              <div className="text-lg font-bold">Full</div>
              <div className="text-xs text-muted-foreground">Sales · Warranty · Repairs</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab content */}
      {tab === "overview" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CCTV Module Overview</CardTitle>
              <CardDescription>
                The CCTV business module is live with end-to-end inventory flow: purchases, serial-tracked
                sales, warranty management, repairs, supplier replacements, estimates, and a full reporting suite.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" /> Operational Features
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• Purchase entry with serial number scanning and warranty declaration</li>
                    <li>• Sales with serial auto-add, hidden cost price, invoice-level discounts</li>
                    <li>• Warranty system: declared at purchase, started at sale, auto-detected at repair</li>
                    <li>• Repair workflow: receive → repair → return, or send to supplier → receive replacement</li>
                    <li>• Estimates/quotes that convert into formal invoices on customer approval</li>
                    <li>• Supplier replacements with new serial number assignment</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Reports & Ledger
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• Daily summary and weekly health report</li>
                    <li>• Sales, purchases, profit & loss, due collection</li>
                    <li>• Cash book, expense summary, top products, stock report</li>
                    <li>• Product movement and serial history</li>
                    <li>• Double-entry ledger (CCTVLedgerEntry) with supplier/customer ledgers</li>
                    <li>• Stock movement audit trail (CCTVStockMovement)</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 p-3 bg-accent rounded-lg border border-border">
                <p className="text-xs text-accent-foreground">
                  <strong>Tip:</strong> Switch to the <strong>Catalog</strong> tab above to manage the CCTV
                  master product catalog — add products manually, import CSV in bulk, or download the
                  template file. The catalog feeds every CCTV business tenant that subscribes to products.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <CCTVCatalogContent />
      )}
    </>
  );
}
