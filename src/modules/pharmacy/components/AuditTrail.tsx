"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Search, X, Filter, History,
  ShoppingCart, Package, DollarSign, RotateCcw, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: string;
  timestamp: string;
  module: string;
  eventType: string;
  entityType: string;
  entityId: string;
  description: string;
  amount?: number;
  quantity?: number;
  reference?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const moduleIcons: Record<string, typeof History> = {
  Sales: ShoppingCart,
  Purchases: Package,
  Inventory: Package,
  Payments: DollarSign,
  Returns: RotateCcw,
};

const moduleColors: Record<string, string> = {
  Sales: "text-green-600 bg-green-50",
  Purchases: "text-blue-600 bg-blue-50",
  Inventory: "text-orange-600 bg-orange-50",
  Payments: "text-emerald-600 bg-emerald-50",
  Returns: "text-red-600 bg-red-50",
};

const moduleFilters = [
  { value: "all", label: "All Modules" },
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "inventory", label: "Inventory" },
  { value: "payments", label: "Payments" },
  { value: "returns", label: "Returns" },
];

export function AuditTrail() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<{ byModule: Record<string, number>; byType: Record<string, number>; totalAmount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchEvents = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (moduleFilter !== "all") params.set("module", moduleFilter);
      params.set("page", page.toString());
      params.set("limit", "30");

      const res = await fetch(`/api/businesses/${businessId}/reports/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
        setSummary(data.summary || null);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (err) {
      console.error("Audit trail fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, moduleFilter, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      e.eventType.toLowerCase().includes(q) ||
      e.module.toLowerCase().includes(q) ||
      (e.reference?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Audit Trail</h1>
        <Button variant="ghost" size="icon" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(summary.byModule).map(([mod, count]) => {
            const Icon = moduleIcons[mod] || History;
            const color = moduleColors[mod] || "bg-muted text-muted-foreground";
            return (
              <Card key={mod} className="cursor-pointer" onClick={() => { setModuleFilter(mod.toLowerCase()); setPage(1); }}>
                <CardContent className="p-2 text-center">
                  <Icon className={cn("h-4 w-4 mx-auto mb-0.5", color.split(" ")[0])} />
                  <p className={cn("text-base font-bold", color.split(" ")[0])}>{count}</p>
                  <p className="text-[8px] text-muted-foreground">{mod}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by description, type, reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {search && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Module Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {moduleFilters.map((f) => (
          <button
            key={f.value}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              moduleFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            onClick={() => { setModuleFilter(f.value); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <History className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No audit events found</p>
            <p className="text-sm text-muted-foreground">Try adjusting filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const Icon = moduleIcons[event.module] || History;
            const color = moduleColors[event.module] || "bg-muted text-muted-foreground";
            const date = new Date(event.timestamp);
            return (
              <Card key={event.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", color.split(" ")[1])}>
                    <Icon className={cn("h-4 w-4", color.split(" ")[0])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{event.eventType}</p>
                      {event.amount !== undefined && (
                        <span className={cn("text-xs font-bold shrink-0", event.amount >= 0 ? "text-green-600" : "text-red-600")}>
                          {event.amount >= 0 ? "+" : ""}৳{event.amount.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px]">{event.module}</Badge>
                      {event.reference && (
                        <span className="text-[9px] text-muted-foreground">Ref: {event.reference}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
