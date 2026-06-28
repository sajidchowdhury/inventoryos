"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Search, X, History,
  ShoppingCart, Package, DollarSign, RotateCcw,
  Boxes, TrendingUp, User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const moduleStyles: Record<string, { gradient: string; soft: string; text: string; ring: string }> = {
  Sales: { gradient: "from-blue-500 to-blue-600", soft: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-200" },
  Purchases: { gradient: "from-amber-500 to-orange-500", soft: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200" },
  Inventory: { gradient: "from-purple-500 to-fuchsia-500", soft: "bg-purple-50", text: "text-purple-600", ring: "ring-purple-200" },
  Payments: { gradient: "from-rose-500 to-red-500", soft: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-200" },
  Returns: { gradient: "from-rose-500 to-pink-500", soft: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-200" },
};

const moduleFilters = [
  { value: "all", label: "All", color: "from-emerald-500 to-teal-600" },
  { value: "sales", label: "Sales", color: "from-blue-500 to-blue-600" },
  { value: "purchases", label: "Purchases", color: "from-amber-500 to-orange-500" },
  { value: "inventory", label: "Stock", color: "from-purple-500 to-fuchsia-500" },
  { value: "payments", label: "Payments", color: "from-rose-500 to-red-500" },
];

function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

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
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-[11px] text-muted-foreground">Complete transaction history</p>
        </div>
        <Button variant="outline" size="icon" className="shadow-pharmacy" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(summary.byModule).map(([mod, count]) => {
            const Icon = moduleIcons[mod] || History;
            const style = moduleStyles[mod] || { gradient: "from-slate-400 to-slate-500", soft: "bg-muted", text: "text-muted-foreground", ring: "ring-muted" };
            return (
              <Card
                key={mod}
                className={cn(
                  "card-hover shadow-pharmacy cursor-pointer ring-1 transition-all",
                  moduleFilter === mod.toLowerCase() ? style.ring : "ring-transparent"
                )}
                onClick={() => { setModuleFilter(mod.toLowerCase()); setPage(1); }}
              >
                <CardContent className="p-2 text-center">
                  <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br mx-auto mb-1 flex items-center justify-center shadow-sm", style.gradient)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <p className={cn("text-base font-bold", style.text)}>{count}</p>
                  <p className="text-[8px] text-muted-foreground font-medium">{mod}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search bar with shadow-pharmacy */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by description, type, reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-11 shadow-pharmacy bg-card"
        />
        {search && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {moduleFilters.map((f) => (
          <button
            key={f.value}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 shadow-sm",
              moduleFilter === f.value
                ? `bg-gradient-to-r ${f.color} text-white shadow-pharmacy`
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
            onClick={() => { setModuleFilter(f.value); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="card-hover shadow-pharmacy">
          <CardContent className="p-10 text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto">
              <History className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-bold">No audit events found</p>
              <p className="text-sm text-muted-foreground mt-0.5">Try adjusting your search or filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((event, idx) => {
            const Icon = moduleIcons[event.module] || History;
            const style = moduleStyles[event.module] || { gradient: "from-slate-400 to-slate-500", soft: "bg-muted", text: "text-muted-foreground" };
            const date = new Date(event.timestamp);
            return (
              <Card
                key={event.id}
                className="card-hover shadow-pharmacy stagger-in overflow-hidden"
                style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}
              >
                <CardContent className="p-3.5 flex items-start gap-3">
                  {/* Icon avatar */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", style.gradient)}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{event.eventType}</p>
                      {event.amount !== undefined && (
                        <span className={cn(
                          "text-xs font-bold shrink-0 px-2 py-0.5 rounded-full",
                          event.amount >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                        )}>
                          {event.amount >= 0 ? "+" : ""}৳{event.amount.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{event.description}</p>

                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className={cn("text-[9px] font-semibold", style.text, `border-current/20`)}>
                        {event.module}
                      </Badge>
                      {event.reference && (
                        <span className="text-[9px] text-muted-foreground font-medium">Ref: {event.reference}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground ml-auto flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
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
              <span className="text-xs text-muted-foreground font-medium">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
