"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Boxes, Clock, Calendar,
  Search, X, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type FilterTab = "all" | "active" | "near_expiry" | "expired" | "quarantined";

function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const filterTabs: { key: FilterTab; label: string; activeClass: string }[] = [
  { key: "all", label: "All", activeClass: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white" },
  { key: "active", label: "Active", activeClass: "bg-green-500 text-white" },
  { key: "near_expiry", label: "Near Expiry", activeClass: "bg-amber-500 text-white" },
  { key: "expired", label: "Expired", activeClass: "bg-rose-500 text-white" },
  { key: "quarantined", label: "Quarantined", activeClass: "bg-purple-500 text-white" },
];

const statusConfig: Record<string, {
  border: string;
  dot: string;
  qtyBadge: string;
  label: string;
  pulse?: boolean;
}> = {
  active: {
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    qtyBadge: "bg-emerald-50 text-emerald-700",
    label: "Active",
  },
  near_expiry: {
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    qtyBadge: "bg-amber-50 text-amber-700",
    label: "Near Expiry",
    pulse: true,
  },
  expired: {
    border: "border-l-rose-500",
    dot: "bg-rose-500",
    qtyBadge: "bg-rose-50 text-rose-700",
    label: "Expired",
    pulse: true,
  },
  quarantined: {
    border: "border-l-purple-500",
    dot: "bg-purple-500",
    qtyBadge: "bg-purple-50 text-purple-700",
    label: "Quarantined",
  },
};

const defaultStatus = {
  border: "border-l-gray-300",
  dot: "bg-gray-400",
  qtyBadge: "bg-gray-100 text-gray-600",
  label: "Unknown",
};

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
    if (activeFilter !== "all" && b.status !== activeFilter) return false;

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
    quarantined: summary.quarantined?.count ?? 0,
  };

  const renderBatch = (batch: Batch) => {
    const days = daysUntil(batch.expiryDate);
    const cfg = statusConfig[batch.status] ?? defaultStatus;

    const countdownText = days < 0
      ? `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`
      : days === 0
        ? "Expires today"
        : `Expires in ${days} day${days !== 1 ? "s" : ""}`;
    const countdownColor = days < 0
      ? "text-rose-600"
      : days <= 30
        ? "text-amber-600"
        : "text-gray-500";

    return (
      <Card
        key={batch.id}
        className={cn(
          "card-hover stagger-in border-l-4 overflow-hidden cursor-pointer shadow-pharmacy",
          cfg.border
        )}
        onClick={() => handleBatchClick(batch)}
      >
        <CardContent className="p-3.5 space-y-2.5">
          {/* Top: gradient icon + product info + status dot */}
          <div className="flex items-start gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                background: batch.product.category?.color
                  ? `linear-gradient(135deg, ${batch.product.category.color}, rgba(0,0,0,0.20))`
                  : "linear-gradient(135deg, #94a3b8, #475569)",
              }}
            >
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{batch.product.name}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {batch.product.genericName || batch.product.manufacturer || "—"}
                {batch.product.strength && ` · ${batch.product.strength}`}
              </p>
            </div>
            {/* Status indicator dot */}
            <div className="flex items-center gap-1.5 shrink-0 pt-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  cfg.dot,
                  cfg.pulse && "animate-pulse-soft"
                )}
              />
            </div>
          </div>

          {/* Middle: batch no badge + quantity */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono font-semibold">
              #{batch.batchNo}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{batch.product.unit}</span>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", cfg.qtyBadge)}>
                {batch.quantity} units
              </span>
            </div>
          </div>

          {/* Bottom: expiry date + countdown */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Calendar className="h-3 w-3" />
              {new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
            </span>
            <span className={cn("text-[11px] font-semibold flex items-center gap-1", countdownColor)}>
              {(days < 0 || days <= 30) && <Clock className="h-3 w-3" />}
              {countdownText}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={() => setActiveView("dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight flex-1">Batches</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
        <Input
          placeholder="Search by batch no, product, manufacturer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-9 h-12 rounded-2xl shadow-pharmacy border-0 bg-white focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5",
              activeFilter === tab.key
                ? cn(tab.activeClass, "shadow-pharmacy")
                : "bg-white text-gray-600 shadow-pharmacy hover:shadow-pharmacy-lg"
            )}
            onClick={() => setActiveFilter(tab.key)}
          >
            {tab.label}
            <span
              className={cn(
                "text-[10px] px-1.5 py-0 rounded-full font-bold",
                activeFilter === tab.key ? "bg-white/25" : "bg-gray-100 text-gray-500"
              )}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Batch List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded skeleton" />
                    <div className="h-3 w-1/2 rounded skeleton" />
                  </div>
                </div>
                <div className="h-6 w-full rounded skeleton" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedBatches.length === 0 ? (
        <Card className="shadow-pharmacy">
          <CardContent className="p-10 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto">
              <Boxes className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-base">
                {search
                  ? "No batches match your search"
                  : `No ${activeFilter !== "all" ? activeFilter.replace("_", " ") : ""} batches`}
              </p>
              <p className="text-sm text-gray-400">
                {activeFilter === "expired" || activeFilter === "near_expiry"
                  ? "Great! Nothing to worry about."
                  : "Add batches from any product's detail page"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-gray-400 text-center">
            Showing {sortedBatches.length} batch{sortedBatches.length !== 1 ? "es" : ""} · sorted by expiry
          </p>
          <div className="space-y-2.5">
            {sortedBatches.map(renderBatch)}
          </div>
        </>
      )}
    </motion.div>
  );
}
