"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Search, X, Clock, AlertTriangle,
  XCircle, CheckCircle2, ShieldAlert, ChevronRight, Calendar,
  Pill, DollarSign, Filter, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { ExpiryTimelineChart } from "./ExpiryTimelineChart";
import { BulkActionBar } from "./BulkActionBar";
import { cn } from "@/lib/utils";

interface BatchListItem {
  id: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  mrp: number | null;
  purchasePrice: number | null;
  status: string;
  daysUntilExpiry: number;
  product: {
    id: string;
    name: string;
    genericName: string | null;
    strength: string | null;
    manufacturer: string | null;
    unit: string;
    mrp: number | null;
    category: { name: string; color: string } | null;
  };
}

interface ExpiryStats {
  windowDays: number;
  summary: {
    totalBatches: number;
    totalUnits: number;
    totalUnitsAtRisk: number;
    totalValueAtRisk: number;
    totalValue: number;
  };
  buckets: {
    expired: { count: number; quantity: number; value: number };
    critical_7d: { count: number; quantity: number; value: number };
    critical_30d: { count: number; quantity: number; value: number };
    warning_90d: { count: number; quantity: number; value: number };
    safe: { count: number; quantity: number; value: number };
    quarantined: { count: number; quantity: number; value: number };
  };
  timeline: Array<{ weekLabel: string; weekStart: string; weekEnd: string; count: number; quantity: number; value: number }>;
  manufacturerBreakdown: Array<{ name: string; count: number; quantity: number; value: number }>;
  categoryBreakdown: Array<{ name: string; color: string; count: number; quantity: number; value: number }>;
  batches: BatchListItem[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type SeverityFilter = "all" | "expired" | "critical_7d" | "critical_30d" | "warning_90d" | "safe" | "quarantined";

const severityTabs: { value: SeverityFilter; label: string; icon: typeof Clock; color: string }[] = [
  { value: "all", label: "All", icon: Clock, color: "text-blue-600" },
  { value: "expired", label: "Expired", icon: XCircle, color: "text-red-700" },
  { value: "critical_7d", label: "< 7 days", icon: AlertTriangle, color: "text-red-600" },
  { value: "critical_30d", label: "< 30 days", icon: AlertTriangle, color: "text-orange-600" },
  { value: "warning_90d", label: "< 90 days", icon: Clock, color: "text-yellow-600" },
  { value: "quarantined", label: "Quarantined", icon: ShieldAlert, color: "text-purple-600" },
  { value: "safe", label: "Safe", icon: CheckCircle2, color: "text-green-600" },
];

function getBatchSeverity(batch: BatchListItem): SeverityFilter {
  if (batch.status === "quarantined") return "quarantined";
  if (batch.daysUntilExpiry < 0) return "expired";
  if (batch.daysUntilExpiry <= 7) return "critical_7d";
  if (batch.daysUntilExpiry <= 30) return "critical_30d";
  if (batch.daysUntilExpiry <= 90) return "warning_90d";
  return "safe";
}

export function ExpiryDashboard() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [stats, setStats] = useState<ExpiryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<SeverityFilter>("all");
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      // Store businessId for BulkActionBar to use
      localStorage.setItem("activeBusinessId", businessId);

      const res = await fetch(`/api/businesses/${businessId}/expiry-stats?days=90`);
      const data = await res.json();
      if (data.success) setStats(data);
    } catch (err) {
      console.error("Expiry stats fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Filter batches
  const filteredBatches = (stats?.batches || []).filter((batch) => {
    if (activeFilter !== "all" && getBatchSeverity(batch) !== activeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        batch.product.name.toLowerCase().includes(q) ||
        batch.batchNo.toLowerCase().includes(q) ||
        (batch.product.manufacturer?.toLowerCase().includes(q) ?? false) ||
        (batch.product.genericName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      // Sync with localStorage for BulkActionBar
      localStorage.setItem("expirySelectedBatches", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedBatches(new Set());
    localStorage.removeItem("expirySelectedBatches");
  };

  const handleBulkComplete = () => {
    setBulkMode(false);
    clearSelection();
    fetchStats();
  };

  const handleBatchClick = (batch: BatchListItem) => {
    if (bulkMode) {
      toggleBatchSelection(batch.id);
    } else {
      setActiveProductId(batch.product.id);
      setActiveView("product-detail");
    }
  };

  const tabCounts: Record<SeverityFilter, number> = {
    all: stats?.batches.length ?? 0,
    expired: stats?.batches.filter((b) => getBatchSeverity(b) === "expired").length ?? 0,
    critical_7d: stats?.batches.filter((b) => getBatchSeverity(b) === "critical_7d").length ?? 0,
    critical_30d: stats?.batches.filter((b) => getBatchSeverity(b) === "critical_30d").length ?? 0,
    warning_90d: stats?.batches.filter((b) => getBatchSeverity(b) === "warning_90d").length ?? 0,
    quarantined: stats?.batches.filter((b) => getBatchSeverity(b) === "quarantined").length ?? 0,
    safe: stats?.batches.filter((b) => getBatchSeverity(b) === "safe").length ?? 0,
  };

  if (loading) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Expiry Management</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-4 h-32" /></Card>
        <Card className="animate-pulse"><CardContent className="p-4 h-48" /></Card>
      </motion.div>
    );
  }

  if (!stats) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Expiry Management</h1>
        </div>
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Failed to load data</CardContent></Card>
      </motion.div>
    );
  }

  const { summary, buckets, timeline, manufacturerBreakdown, categoryBreakdown } = stats;

  return (
    <motion.div {...fadeIn} className={cn("space-y-4 pb-4", bulkMode && selectedBatches.size > 0 && "pb-56")}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Expiry Management</h1>
        <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          variant={bulkMode ? "default" : "outline"}
          onClick={() => {
            setBulkMode(!bulkMode);
            if (bulkMode) clearSelection();
          }}
        >
          {bulkMode ? "Cancel" : "Bulk"}
        </Button>
      </div>

      {/* Summary Hero Card */}
      <Card className={cn(
        "border-l-4",
        summary.totalValueAtRisk > 0 ? "border-l-red-500 bg-red-50/30" : "border-l-green-500 bg-green-50/30"
      )}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Value at Risk</p>
              <p className={cn(
                "text-2xl font-bold",
                summary.totalValueAtRisk > 0 ? "text-red-600" : "text-green-600"
              )}>
                ৳{summary.totalValueAtRisk.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Units at Risk</p>
              <p className="text-2xl font-bold text-foreground">
                {summary.totalUnitsAtRisk}
                <span className="text-xs text-muted-foreground font-normal"> / {summary.totalUnits}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Next {stats.windowDays} days · {summary.totalBatches} batches tracked</span>
          </div>
        </CardContent>
      </Card>

      {/* Severity Buckets Grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "expired" as const, label: "Expired", icon: XCircle, color: "text-red-700", bg: "bg-red-100" },
          { key: "critical_7d" as const, label: "< 7 Days", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { key: "critical_30d" as const, label: "< 30 Days", icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
          { key: "warning_90d" as const, label: "< 90 Days", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
          { key: "quarantined" as const, label: "Quarantined", icon: ShieldAlert, color: "text-purple-600", bg: "bg-purple-50" },
          { key: "safe" as const, label: "Safe (>90d)", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
        ].map((bucket) => {
          const data = buckets[bucket.key];
          return (
            <Card
              key={bucket.key}
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
              onClick={() => setActiveFilter(activeFilter === bucket.key ? "all" : bucket.key)}
            >
              <CardContent className="p-2.5 text-center">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-1", bucket.bg)}>
                  <bucket.icon className={cn("h-4 w-4", bucket.color)} />
                </div>
                <p className={cn("text-lg font-bold", bucket.color)}>{data.count}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{bucket.label}</p>
                {data.value > 0 && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">৳{data.value.toFixed(0)}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Expiry Timeline
            </h2>
            <span className="text-[10px] text-muted-foreground">Next 13 weeks</span>
          </div>
          <ExpiryTimelineChart data={timeline} />
        </CardContent>
      </Card>

      {/* Top Manufacturers at Risk */}
      {manufacturerBreakdown.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Top Manufacturers (by value)
            </h2>
            <div className="space-y-2">
              {manufacturerBreakdown.slice(0, 5).map((mfr) => {
                const maxVal = Math.max(...manufacturerBreakdown.map((m) => m.value), 1);
                const pct = (mfr.value / maxVal) * 100;
                return (
                  <div key={mfr.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate flex-1">{mfr.name}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">৳{mfr.value.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">By Category</h2>
            <div className="flex flex-wrap gap-1.5">
              {categoryBreakdown.slice(0, 8).map((cat) => (
                <button
                  key={cat.name}
                  className="px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name} · {cat.count}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product, batch, manufacturer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {severityTabs.map((tab) => (
            <button
              key={tab.value}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 flex items-center gap-1",
                activeFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              onClick={() => setActiveFilter(tab.value)}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
              <span className="opacity-70">({tabCounts[tab.value]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {bulkMode && selectedBatches.size > 0 && (
        <Card className="bg-primary/5 border-primary/30 sticky top-2 z-10">
          <CardContent className="p-2 flex items-center justify-between">
            <span className="text-xs font-medium">{selectedBatches.size} selected</span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {/* Batch List */}
      {filteredBatches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">
              {search ? "No batches match your search" : "No batches in this category"}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeFilter === "safe" || activeFilter === "all"
                ? "Your inventory is in good shape!"
                : "Great! Nothing to worry about here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredBatches.map((batch) => {
            const severity = getBatchSeverity(batch);
            const isSelected = selectedBatches.has(batch.id);
            const sevColors: Record<SeverityFilter, string> = {
              expired: "border-l-red-700 bg-red-50/40",
              critical_7d: "border-l-red-500 bg-red-50/20",
              critical_30d: "border-l-orange-500",
              warning_90d: "border-l-yellow-500",
              quarantined: "border-l-purple-500 bg-purple-50/30",
              safe: "border-l-green-500",
              all: "",
            };
            return (
              <Card
                key={batch.id}
                className={cn(
                  "border-l-4 overflow-hidden cursor-pointer hover:shadow-md transition-shadow",
                  sevColors[severity],
                  isSelected && "ring-2 ring-primary"
                )}
                onClick={() => handleBatchClick(batch)}
              >
                <CardContent className="p-3 flex items-start gap-2">
                  {bulkMode && (
                    <div className={cn(
                      "h-4 w-4 rounded border-2 mt-1 shrink-0 flex items-center justify-center",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                    )}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  )}
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: batch.product.category?.color ? `${batch.product.category.color}20` : "#f3f4f6" }}
                  >
                    <Pill className="h-4 w-4" style={{ color: batch.product.category?.color || "#6b7280" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{batch.product.name}</p>
                      <span className="text-xs font-bold shrink-0">
                        {batch.quantity} {batch.product.unit}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Batch #{batch.batchNo}
                      {batch.product.manufacturer && ` · ${batch.product.manufacturer}`}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] px-1.5 py-0", sevColors[severity] ? "" : "")}
                      >
                        {batch.daysUntilExpiry < 0
                          ? `Expired ${Math.abs(batch.daysUntilExpiry)}d ago`
                          : `${batch.daysUntilExpiry}d left`}
                      </Badge>
                      {(batch.mrp || batch.purchasePrice) && (
                        <span className="text-[10px] text-muted-foreground">
                          ৳{((batch.mrp || batch.purchasePrice || 0) * batch.quantity).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bulk Action Bar (fixed at bottom) */}
      {bulkMode && selectedBatches.size > 0 && (
        <BulkActionBar
          selectedCount={selectedBatches.size}
          onClear={clearSelection}
          onComplete={handleBulkComplete}
        />
      )}
    </motion.div>
  );
}
