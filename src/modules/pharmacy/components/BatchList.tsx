"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Boxes, Clock, AlertTriangle, Calendar,
  Search, X, Package, TrendingUp, TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batchNo: string;
  mfgDate: string | null;
  expiryDate: string;
  quantity: number;
  purchasePrice: number | null;
  mrp: number | null;
  status: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    genericName: string | null;
    strength: string | null;
    dosageForm: string | null;
    manufacturer: string | null;
    unit: string;
    mrp: number | null;
    category: { id: string; name: string; color: string } | null;
  };
}

interface Summary {
  [key: string]: { count: number; quantity: number };
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type FilterTab = "all" | "active" | "near_expiry" | "expired";

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const filterTabs: { key: FilterTab; label: string; icon: typeof Boxes }[] = [
  { key: "all", label: "All", icon: Boxes },
  { key: "active", label: "Active", icon: Package },
  { key: "near_expiry", label: "Expiring", icon: Clock },
  { key: "expired", label: "Expired", icon: AlertTriangle },
];

export function BatchList() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [batches, setBatches] = useState<Batch[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const fetchBatches = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/batches?limit=200`);
      const data = await res.json();
      if (data.success) {
        setBatches(data.batches || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error("Fetch batches error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  // Filter batches based on search + active filter
  const filteredBatches = batches.filter((b) => {
    // Status filter
    if (activeFilter !== "all" && b.status !== activeFilter) return false;

    // Search filter (across batch no, product name, manufacturer)
    if (search) {
      const q = search.toLowerCase();
      return (
        b.batchNo.toLowerCase().includes(q) ||
        b.product.name.toLowerCase().includes(q) ||
        (b.product.genericName?.toLowerCase().includes(q) ?? false) ||
        (b.product.manufacturer?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // Sort by expiry date ascending (soonest first)
  const sortedBatches = [...filteredBatches].sort(
    (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  );

  const handleBatchClick = (batch: Batch) => {
    setActiveProductId(batch.product.id);
    setActiveView("product-detail");
  };

  const tabCounts: Record<FilterTab, number> = {
    all: batches.length,
    active: summary.active?.count ?? 0,
    near_expiry: summary.near_expiry?.count ?? 0,
    expired: summary.expired?.count ?? 0,
  };

  const renderBatch = (batch: Batch) => {
    const days = daysUntil(batch.expiryDate);
    const severity = days < 0 ? "expired" : days <= 30 ? "critical" : days <= 90 ? "warning" : "ok";
    const severityColors = {
      ok: "border-l-green-500",
      warning: "border-l-orange-500",
      critical: "border-l-red-500",
      expired: "border-l-red-700 bg-red-50/50",
    };

    return (
      <Card
        key={batch.id}
        className={cn("border-l-4 overflow-hidden cursor-pointer hover:shadow-md transition-shadow", severityColors[severity])}
        onClick={() => handleBatchClick(batch)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: batch.product.category?.color ? `${batch.product.category.color}20` : "#f3f4f6" }}
            >
              <Package className="h-4 w-4" style={{ color: batch.product.category?.color || "#6b7280" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{batch.product.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {batch.product.genericName || batch.product.manufacturer || "—"}
                {batch.product.strength && ` · ${batch.product.strength}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{batch.quantity}</p>
              <p className="text-[10px] text-muted-foreground">{batch.product.unit}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Batch #{batch.batchNo}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0",
                severity === "expired" && "bg-red-100 text-red-700",
                severity === "critical" && "bg-red-50 text-red-600",
                severity === "warning" && "bg-orange-50 text-orange-600",
                severity === "ok" && "bg-green-50 text-green-600"
              )}
            >
              {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Exp: {new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
            </span>
            {batch.mrp && <span className="font-medium">৳{batch.mrp}</span>}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">All Batches</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-2 text-center">
            <Boxes className="h-4 w-4 mx-auto text-blue-600 mb-0.5" />
            <p className="text-base font-bold text-blue-600">{tabCounts.all}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <Package className="h-4 w-4 mx-auto text-green-600 mb-0.5" />
            <p className="text-base font-bold text-green-600">{tabCounts.active}</p>
            <p className="text-[9px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <Clock className="h-4 w-4 mx-auto text-orange-600 mb-0.5" />
            <p className="text-base font-bold text-orange-600">{tabCounts.near_expiry}</p>
            <p className="text-[9px] text-muted-foreground">Expiring</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto text-red-600 mb-0.5" />
            <p className="text-base font-bold text-red-600">{tabCounts.expired}</p>
            <p className="text-[9px] text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by batch no, product, manufacturer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-11"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1",
              activeFilter === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveFilter(tab.key)}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            <span className="text-[10px] opacity-70">({tabCounts[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* Batch List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-20" />
            </Card>
          ))}
        </div>
      ) : sortedBatches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Boxes className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">
              {search ? "No batches match your search" : `No ${activeFilter !== "all" ? activeFilter.replace("_", " ") : ""} batches`}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeFilter === "expired" || activeFilter === "near_expiry"
                ? "Great! Nothing to worry about."
                : "Add batches from any product's detail page"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Showing {sortedBatches.length} batch{sortedBatches.length !== 1 ? "es" : ""} (sorted by expiry)
          </p>
          {sortedBatches.map(renderBatch)}
        </div>
      )}
    </motion.div>
  );
}
