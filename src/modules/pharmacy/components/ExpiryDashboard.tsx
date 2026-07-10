"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Search, X, Clock, AlertTriangle,
  XCircle, CheckCircle2, ShieldAlert, ChevronRight, Calendar,
  Pill, DollarSign, Filter, Trash2, Package, ShieldCheck, Layers,
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

// 4-card status grid config (premium pharmacy look)
const statusCards: {
  key: "active" | "near" | "expired" | "quarantined";
  label: string;
  icon: typeof Clock;
  iconBg: string;       // gradient icon background
  iconColor: string;    // icon color
  accentBorder: string; // left colored border
  numberColor: string;  // big number color
  filter: SeverityFilter;
}[] = [
  {
    key: "active",
    label: "Active Stock",
    icon: ShieldCheck,
    iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    iconColor: "text-white",
    accentBorder: "border-l-emerald-500",
    numberColor: "text-emerald-700",
    filter: "safe",
  },
  {
    key: "near",
    label: "Near Expiry",
    icon: Clock,
    iconBg: "bg-gradient-to-br from-amber-400 to-amber-600",
    iconColor: "text-white",
    accentBorder: "border-l-amber-500",
    numberColor: "text-amber-700",
    filter: "critical_30d",
  },
  {
    key: "expired",
    label: "Expired",
    icon: XCircle,
    iconBg: "bg-gradient-to-br from-rose-400 to-rose-600",
    iconColor: "text-white",
    accentBorder: "border-l-rose-500",
    numberColor: "text-rose-700",
    filter: "expired",
  },
  {
    key: "quarantined",
    label: "Quarantined",
    icon: ShieldAlert,
    iconBg: "bg-gradient-to-br from-purple-400 to-purple-600",
    iconColor: "text-white",
    accentBorder: "border-l-purple-500",
    numberColor: "text-purple-700",
    filter: "quarantined",
  },
];

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
      <motion.div {...fadeIn} className="pharmacy-bg min-h-[80vh] space-y-4 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Expiry Management</h1>
        </div>
        {/* Skeleton status grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-4 space-y-3">
                <div className="skeleton h-10 w-10 rounded-lg" />
                <div className="skeleton h-7 w-16 rounded" />
                <div className="skeleton h-3 w-20 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Skeleton chart */}
        <Card className="shadow-pharmacy">
          <CardContent className="p-4 space-y-3">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="flex items-end gap-1 h-32">
              {[...Array(13)].map((_, i) => (
                <div key={i} className="skeleton flex-1 rounded-t-sm" style={{ height: `${20 + Math.random() * 70}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Skeleton list */}
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="skeleton h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    );
  }

  if (!stats) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-[80vh] space-y-4 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Expiry Management</h1>
        </div>
        <Card className="shadow-pharmacy">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">Failed to load data</CardContent>
        </Card>
      </motion.div>
    );
  }

  const { summary, buckets, timeline, manufacturerBreakdown, categoryBreakdown } = stats;

  // Compute 4-card aggregates
  const cardData = {
    active: {
      count: buckets.safe.count,
      value: buckets.safe.value,
      units: buckets.safe.quantity,
    },
    near: {
      count: buckets.critical_7d.count + buckets.critical_30d.count + buckets.warning_90d.count,
      value: buckets.critical_7d.value + buckets.critical_30d.value + buckets.warning_90d.value,
      units: buckets.critical_7d.quantity + buckets.critical_30d.quantity + buckets.warning_90d.quantity,
    },
    expired: {
      count: buckets.expired.count,
      value: buckets.expired.value,
      units: buckets.expired.quantity,
    },
    quarantined: {
      count: buckets.quarantined.count,
      value: buckets.quarantined.value,
      units: buckets.quarantined.quantity,
    },
  } as const;

  return (
    <motion.div {...fadeIn} className={cn(
      "pharmacy-bg min-h-[80vh] space-y-4 p-4 rounded-xl",
      bulkMode && selectedBatches.size > 0 && "pb-56"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 hover:bg-emerald-50" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Expiry Management</h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block">Track and act on batches nearing expiry</p>
        </div>
        <Button variant="ghost" size="icon" className="hover:bg-emerald-50" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          variant={bulkMode ? "default" : "outline"}
          className={cn(bulkMode && "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-0")}
          onClick={() => {
            setBulkMode(!bulkMode);
            if (bulkMode) clearSelection();
          }}
        >
          {bulkMode ? "Cancel" : "Bulk"}
        </Button>
      </div>

      {/* Value at Risk Hero Banner */}
      <Card className={cn(
        "shadow-pharmacy border-l-4 overflow-hidden",
        summary.totalValueAtRisk > 0 ? "border-l-rose-500" : "border-l-emerald-500"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
                summary.totalValueAtRisk > 0
                  ? "bg-gradient-to-br from-rose-400 to-rose-600"
                  : "bg-gradient-to-br from-emerald-400 to-emerald-600"
              )}>
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Value at Risk</p>
                <p className={cn(
                  "text-2xl font-bold leading-tight",
                  summary.totalValueAtRisk > 0 ? "text-rose-600" : "text-emerald-600"
                )}>
                  ৳{summary.totalValueAtRisk.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Units at Risk</p>
              <p className="text-2xl font-bold text-foreground leading-tight">
                {summary.totalUnitsAtRisk}
                <span className="text-xs text-muted-foreground font-normal"> / {summary.totalUnits}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] mt-3 pt-3 border-t text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Next {stats.windowDays} days · {summary.totalBatches} batches tracked</span>
          </div>
        </CardContent>
      </Card>

      {/* 4-Card Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statusCards.map((card) => {
          const data = cardData[card.key];
          const isActive = activeFilter === card.filter;
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className={cn(
                "stagger-in card-hover shadow-pharmacy border-l-4 cursor-pointer overflow-hidden",
                card.accentBorder,
                isActive && "ring-2 ring-offset-1 ring-emerald-400"
              )}
              onClick={() => setActiveFilter(isActive ? "all" : card.filter)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-sm", card.iconBg)}>
                    <Icon className={cn("h-5 w-5", card.iconColor)} />
                  </div>
                  {data.count > 0 && (card.key === "expired" || card.key === "near") && (
                    <span className={cn(
                      "h-2 w-2 rounded-full animate-pulse-soft",
                      card.key === "expired" ? "bg-rose-500" : "bg-amber-500"
                    )} />
                  )}
                </div>
                <p className={cn("text-2xl font-bold leading-tight", card.numberColor)}>{data.count}</p>
                <p className="text-[11px] font-medium text-foreground/80 mt-0.5">{card.label}</p>
                {data.value > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">৳{data.value.toFixed(0)} · {data.units} units</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline Chart */}
      <Card className="shadow-pharmacy">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-600" /> Expiry Timeline
            </h2>
            <span className="text-[10px] text-muted-foreground">Next 13 weeks</span>
          </div>
          <ExpiryTimelineChart data={timeline} />
        </CardContent>
      </Card>

      {/* Top Manufacturers at Risk */}
      {manufacturerBreakdown.length > 0 && (
        <Card className="shadow-pharmacy stagger-in">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-emerald-600" /> Top Manufacturers (by value)
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
                        className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-full transition-all duration-500"
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
        <Card className="shadow-pharmacy stagger-in">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600" /> By Category
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {categoryBreakdown.slice(0, 8).map((cat) => (
                <button
                  key={cat.name}
                  className="px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 transition-transform hover:scale-105"
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
            className="pl-9 pr-9 h-10 bg-background shadow-sm"
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
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm"
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

      {/* Bulk Selection Bar (sticky inline status) */}
      {bulkMode && selectedBatches.size > 0 && (
        <Card className="bg-emerald-50/60 border-emerald-200 shadow-pharmacy sticky top-2 z-10 stagger-in">
          <CardContent className="p-2.5 flex items-center justify-between">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-emerald-600" />
              {selectedBatches.size} selected
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {/* Batch List */}
      {filteredBatches.length === 0 ? (
        <Card className="shadow-pharmacy stagger-in">
          <CardContent className="p-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="font-semibold">
              {search ? "No batches match your search" : "No batches in this category"}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {activeFilter === "safe" || activeFilter === "all"
                ? "Your inventory is in good shape — no urgent action needed."
                : "Great! Nothing to worry about here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredBatches.map((batch) => {
            const severity = getBatchSeverity(batch);
            const isSelected = selectedBatches.has(batch.id);
            const sevConfig: Record<SeverityFilter, { border: string; dot: string; badge: string; pulse: boolean }> = {
              expired:      { border: "border-l-rose-700 bg-rose-50/40",    dot: "bg-rose-600",     badge: "bg-rose-100 text-rose-700",       pulse: true },
              critical_7d:  { border: "border-l-rose-500 bg-rose-50/20",    dot: "bg-rose-500",     badge: "bg-rose-50 text-rose-600",        pulse: true },
              critical_30d: { border: "border-l-amber-500 bg-amber-50/20",  dot: "bg-amber-500",    badge: "bg-amber-50 text-amber-700",      pulse: false },
              warning_90d:  { border: "border-l-yellow-500 bg-yellow-50/20",dot: "bg-yellow-500",   badge: "bg-yellow-50 text-yellow-700",    pulse: false },
              quarantined:  { border: "border-l-purple-500 bg-purple-50/30",dot: "bg-purple-500",   badge: "bg-purple-50 text-purple-700",    pulse: false },
              safe:         { border: "border-l-emerald-500 bg-emerald-50/20", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", pulse: false },
              all:          { border: "", dot: "", badge: "", pulse: false },
            };
            const cfg = sevConfig[severity];
            return (
              <Card
                key={batch.id}
                className={cn(
                  "card-hover shadow-pharmacy border-l-4 overflow-hidden cursor-pointer",
                  cfg.border,
                  isSelected && "ring-2 ring-emerald-400"
                )}
                onClick={() => handleBatchClick(batch)}
              >
                <CardContent className="p-3 flex items-start gap-2.5">
                  {bulkMode && (
                    <div className={cn(
                      "h-4 w-4 rounded border-2 mt-1 shrink-0 flex items-center justify-center transition-colors",
                      isSelected ? "bg-emerald-600 border-emerald-600" : "border-muted-foreground/40"
                    )}>
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
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
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                        {cfg.pulse && (
                          <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse-soft shrink-0", cfg.dot)} />
                        )}
                        {batch.product.name}
                      </p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold shrink-0 bg-background">
                        {batch.quantity} {batch.product.unit}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      <span className="font-mono">#{batch.batchNo}</span>
                      {batch.product.manufacturer && ` · ${batch.product.manufacturer}`}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 font-medium", cfg.badge)}>
                        {batch.daysUntilExpiry < 0
                          ? `Expired ${Math.abs(batch.daysUntilExpiry)}d ago`
                          : `${batch.daysUntilExpiry}d left`}
                      </Badge>
                      {(batch.mrp || batch.purchasePrice) && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          ৳{((batch.mrp || batch.purchasePrice || 0) * batch.quantity).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!bulkMode && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                  )}
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
