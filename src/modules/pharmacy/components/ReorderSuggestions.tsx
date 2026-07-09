"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, TrendingUp, AlertTriangle, Clock,
  Package, ShoppingCart, DollarSign, Loader2, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface ReorderSuggestion {
  productId: string;
  productName: string;
  genericName: string | null;
  manufacturer: string | null;
  category: { name: string; color: string } | null;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  urgency: "critical" | "high" | "medium" | "low";
  reason: string;
  soldLast30Days: number;
  dailyVelocity: number;
  daysOfStock: number | null;
  suggestedOrderQty: number;
  estimatedCost: number;
  avgPurchasePrice: number;
  hasNearExpiryBatches: boolean;
  lastSaleDays: number | null;
}

interface ReorderData {
  summary: {
    totalSuggestions: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalEstimatedCost: number;
    outOfStock: number;
  };
  suggestions: ReorderSuggestion[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const urgencyConfig = {
  critical: { color: "text-red-600", bg: "bg-red-50", border: "border-l-red-500", label: "Critical" },
  high: { color: "text-orange-600", bg: "bg-orange-50", border: "border-l-orange-500", label: "High" },
  medium: { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-l-yellow-500", label: "Medium" },
  low: { color: "text-blue-600", bg: "bg-blue-50", border: "border-l-blue-500", label: "Low" },
};

export function ReorderSuggestions() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [data, setData] = useState<ReorderData | null>(null);
  const [loading, setLoading] = useState(true);

  // Client-side 30-second cache to avoid re-fetching on tab switches.
  // The reorder endpoint is deterministic (no LLM), so a short cache is safe
  // and reduces DB load when the user navigates back and forth.
  const lastFetchAt = useRef<number>(0);
  const CACHE_TTL_MS = 30 * 1000; // 30 seconds

  const fetchData = useCallback(async (force = false) => {
    if (!businessId) return;
    // Skip fetch if we have data and it's less than 30 seconds old
    if (!force && data && Date.now() - lastFetchAt.current < CACHE_TTL_MS) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/reorder`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        lastFetchAt.current = Date.now();
      }
    } catch (err) {
      console.error("Reorder fetch error:", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("ai-hub")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("ai-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-primary" /> Smart Reorder
        </h1>
        <Button variant="ghost" size="icon" onClick={() => fetchData(true)}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* AI Badge */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>
            AI-analyzed reorder suggestions based on 30-day sales velocity, current stock levels, and estimated lead time.
          </span>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <Card className={cn("border-l-4", data.summary.critical > 0 ? "border-l-red-500" : "border-l-green-500")}>
          <CardContent className="p-2.5 text-center">
            <p className={cn("text-base font-bold", data.summary.critical > 0 ? "text-red-600" : "text-green-600")}>
              {data.summary.critical}
            </p>
            <p className="text-[9px] text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-2.5 text-center">
            <p className="text-base font-bold text-orange-600">{data.summary.high}</p>
            <p className="text-[9px] text-muted-foreground">High</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-2.5 text-center">
            <p className="text-base font-bold text-yellow-600">{data.summary.medium + data.summary.low}</p>
            <p className="text-[9px] text-muted-foreground">Watch</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-2.5 text-center">
            <p className="text-base font-bold text-blue-600">৳{data.summary.totalEstimatedCost.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">Est. Cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Suggestions */}
      {data.suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Package className="h-12 w-12 mx-auto text-green-600/50" />
            <p className="font-medium text-green-600">All stock levels are healthy!</p>
            <p className="text-sm text-muted-foreground">No products need reordering at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.suggestions.map((s) => {
            const cfg = urgencyConfig[s.urgency];
            return (
              <Card key={s.productId} className={cn("border-l-4", cfg.border)}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{s.productName}</p>
                        <Badge variant="outline" className={cn("text-[9px]", cfg.color)}>{cfg.label}</Badge>
                      </div>
                      {s.genericName && <p className="text-[10px] text-muted-foreground">{s.genericName}</p>}
                      <p className="text-[10px] text-muted-foreground">{s.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-lg font-bold", cfg.color)}>{s.currentStock}</p>
                      <p className="text-[9px] text-muted-foreground">{s.unit} in stock</p>
                    </div>
                  </div>

                  {/* AI Suggestion */}
                  <div className="bg-primary/5 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ShoppingCart className="h-3 w-3" /> Suggested Order
                      </span>
                      <span className="font-bold text-primary">{s.suggestedOrderQty} {s.unit}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" /> Est. Cost
                      </span>
                      <span className="font-bold">৳{s.estimatedCost.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Velocity Data */}
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">Sold (30d)</p>
                      <p className="font-bold">{s.soldLast30Days}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Daily Avg</p>
                      <p className="font-bold">{s.dailyVelocity}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Days Left</p>
                      <p className={cn("font-bold", s.daysOfStock !== null && s.daysOfStock <= 7 ? "text-red-600" : "")}>
                        {s.daysOfStock === null ? "∞" : s.daysOfStock}
                      </p>
                    </div>
                  </div>

                  {/* Warnings */}
                  {s.hasNearExpiryBatches && (
                    <div className="flex items-center gap-1 text-[10px] text-orange-600">
                      <AlertTriangle className="h-3 w-3" /> Has near-expiry batches — prioritize selling existing stock
                    </div>
                  )}
                  {s.lastSaleDays !== null && s.lastSaleDays > 14 && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> No sales in {s.lastSaleDays} days — verify demand before ordering
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
