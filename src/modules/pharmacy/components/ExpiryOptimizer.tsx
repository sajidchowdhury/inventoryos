"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, RefreshCw, Loader2, AlertTriangle,
  TrendingDown, RotateCcw, Gift, Trash2, ShieldAlert, Brain,
  Package, DollarSign, CheckCircle2,
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

interface Recommendation {
  batchId: string;
  batchNo: string;
  productName: string;
  genericName: string | null;
  category: { name: string; color: string } | null;
  unit: string;
  mrp: number | null;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  status: string;
  valueAtRisk: number;
  action: string;
  discountPercent: number | null;
  reason: string;
  urgency: "critical" | "high" | "medium" | "low";
  estimatedRecovery: string;
}

// Action-specific gradient icons and colored left borders
const actionConfig: Record<string, {
  icon: typeof Brain;
  gradient: string;    // icon background gradient
  color: string;       // icon/text color
  bg: string;          // soft background
  border: string;      // left border color
  label: string;
}> = {
  sell_priority:     { icon: Brain,        gradient: "bg-gradient-to-br from-emerald-400 to-emerald-600", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-l-emerald-500", label: "Sell Priority" },
  discount:          { icon: TrendingDown, gradient: "bg-gradient-to-br from-amber-400 to-amber-600",    color: "text-amber-700",   bg: "bg-amber-50",   border: "border-l-amber-500",   label: "Discount" },
  return_supplier:   { icon: RotateCcw,    gradient: "bg-gradient-to-br from-blue-400 to-blue-600",     color: "text-blue-700",    bg: "bg-blue-50",    border: "border-l-blue-500",    label: "Return to Supplier" },
  donate:            { icon: Gift,         gradient: "bg-gradient-to-br from-purple-400 to-purple-600", color: "text-purple-700",  bg: "bg-purple-50",  border: "border-l-purple-500",  label: "Donate" },
  dispose:           { icon: Trash2,       gradient: "bg-gradient-to-br from-rose-400 to-rose-600",     color: "text-rose-700",    bg: "bg-rose-50",    border: "border-l-rose-500",    label: "Dispose" },
  quarantine:        { icon: ShieldAlert,  gradient: "bg-gradient-to-br from-violet-400 to-violet-600", color: "text-violet-700",  bg: "bg-violet-50",  border: "border-l-violet-500",  label: "Quarantine" },
};

const urgencyBadge: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};

const expiryBadge: Record<string, string> = {
  expired: "bg-rose-100 text-rose-700",
  urgent:  "bg-rose-50 text-rose-600",
  soon:    "bg-amber-50 text-amber-700",
  later:   "bg-yellow-50 text-yellow-700",
};

// Summary card config
const summaryCardConfig = [
  { key: "total",   label: "Total Batches", icon: Package,        gradient: "bg-gradient-to-br from-blue-400 to-blue-600",     border: "border-l-blue-500",    valueKey: "totalBatches",     color: "text-blue-700" },
  { key: "value",   label: "Value at Risk", icon: DollarSign,     gradient: "bg-gradient-to-br from-rose-400 to-rose-600",     border: "border-l-rose-500",    valueKey: "totalValueAtRisk", color: "text-rose-700" },
  { key: "expired", label: "Expired",       icon: AlertTriangle,  gradient: "bg-gradient-to-br from-rose-500 to-rose-700",     border: "border-l-rose-700",    valueKey: "expiredCount",     color: "text-rose-700" },
  { key: "critical",label: "Critical",      icon: AlertTriangle,  gradient: "bg-gradient-to-br from-amber-400 to-amber-600",   border: "border-l-amber-500",   valueKey: "criticalCount",    color: "text-amber-700" },
] as const;

export function ExpiryOptimizer() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [data, setData] = useState<{ recommendations: Recommendation[]; summary: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/expiry-optimizer`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setData({ recommendations: json.recommendations, summary: json.summary });
      }
    } catch (err) {
      console.error("Expiry optimizer error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-[80vh] space-y-4 p-4 rounded-xl pb-4">
      {/* Header with AI badge */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 hover:bg-emerald-50" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">Expiry Optimizer</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 text-white text-[10px] font-semibold shadow-sm">
              <Sparkles className="h-3 w-3" /> AI
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground hidden sm:block">Smart recovery suggestions for near-expiry batches</p>
        </div>
        {data && (
          <Button variant="ghost" size="icon" className="hover:bg-purple-50" onClick={generate} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Initial state — hero card */}
      {!data && !loading && (
        <Card className="shadow-pharmacy border-purple-200 bg-gradient-to-br from-purple-50/60 to-violet-50/40">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto shadow-lg shadow-purple-200">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold">AI Expiry Optimization</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                AI analyzes your near-expiry batches and recommends the best action for each: sell priority, discount, return to supplier, donate, or dispose.
              </p>
            </div>
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 text-white border-0 shadow-md shadow-purple-200"
              onClick={generate}
            >
              <Sparkles className="h-4 w-4" /> Analyze Expiry Risk
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading — skeleton while AI is thinking */}
      {loading && (
        <div className="space-y-4">
          <Card className="shadow-pharmacy">
            <CardContent className="p-8 text-center space-y-3">
              <div className="relative h-12 w-12 mx-auto">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 animate-pulse-soft" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-semibold">AI is analyzing expiry risks...</p>
              <p className="text-xs text-muted-foreground">Evaluating each batch for optimal recovery strategy</p>
            </CardContent>
          </Card>
          {/* Skeleton summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="shadow-pharmacy">
                <CardContent className="p-4 space-y-2">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="skeleton h-5 w-16 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Skeleton recommendation cards */}
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                </div>
                <div className="skeleton h-12 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards — 4-card grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCardConfig.map((card) => {
              const Icon = card.icon;
              const value = data.summary[card.valueKey as keyof typeof data.summary];
              const display = card.valueKey === "totalValueAtRisk"
                ? `৳${Number(value).toFixed(0)}`
                : String(value ?? 0);
              return (
                <Card
                  key={card.key}
                  className={cn("stagger-in card-hover shadow-pharmacy border-l-4", card.border)}
                >
                  <CardContent className="p-4">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shadow-sm mb-2", card.gradient)}>
                      <Icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <p className={cn("text-xl font-bold leading-tight", card.color)}>{display}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{card.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Summary */}
          {data.summary.actionSummary && Object.keys(data.summary.actionSummary).length > 0 && (
            <Card className="shadow-pharmacy stagger-in">
              <CardContent className="p-3">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Recommended Actions:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.summary.actionSummary).map(([action, count]) => {
                    const cfg = actionConfig[action] || actionConfig.sell_priority;
                    return (
                      <Badge key={action} variant="outline" className={cn("text-[9px] font-medium px-2 py-1", cfg.color, cfg.bg)}>
                        {cfg.label}: {count as number}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <div className="space-y-2">
            {data.recommendations.length === 0 ? (
              <Card className="shadow-pharmacy stagger-in">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-emerald-700">No expiry risks!</p>
                  <p className="text-sm text-muted-foreground">No batches expiring within 90 days.</p>
                </CardContent>
              </Card>
            ) : (
              data.recommendations.map((rec) => {
                const cfg = actionConfig[rec.action] || actionConfig.sell_priority;
                const ActionIcon = cfg.icon;
                return (
                  <Card
                    key={rec.batchId}
                    className={cn(
                      "stagger-in card-hover shadow-pharmacy border-l-4 overflow-hidden",
                      cfg.border
                    )}
                  >
                    <CardContent className="p-3.5 space-y-2.5">
                      {/* Header row: icon + product + expiry badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate">{rec.productName}</p>
                            {rec.daysUntilExpiry < 0 ? (
                              <Badge variant="outline" className={cn("text-[9px] font-semibold px-1.5", expiryBadge.expired)}>
                                Expired {Math.abs(rec.daysUntilExpiry)}d ago
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-semibold px-1.5",
                                rec.daysUntilExpiry <= 7 ? expiryBadge.urgent :
                                rec.daysUntilExpiry <= 30 ? expiryBadge.soon :
                                expiryBadge.later
                              )}>
                                {rec.daysUntilExpiry}d left
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-mono">Batch #{rec.batchNo}</span>
                            {" · "}
                            {rec.quantity} {rec.unit}
                            {" · "}
                            <span className="font-semibold text-rose-600">৳{rec.valueAtRisk.toFixed(0)} at risk</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Expires: {new Date(rec.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      {/* AI Recommendation block */}
                      <div className={cn("rounded-xl p-3 space-y-2 border", cfg.bg, "border-black/5")}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm", cfg.gradient)}>
                              <ActionIcon className="h-4 w-4 text-white" />
                            </div>
                            <span className={cn("text-sm font-bold truncate", cfg.color)}>{cfg.label}</span>
                            {rec.discountPercent && (
                              <Badge variant="outline" className={cn("text-[9px] font-semibold px-1.5 shrink-0", cfg.color, cfg.bg)}>
                                {rec.discountPercent}% off
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-semibold px-1.5 capitalize shrink-0",
                            urgencyBadge[rec.urgency] || urgencyBadge.low
                          )}>
                            {rec.urgency}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-foreground/70 leading-relaxed">{rec.reason}</p>
                        <div className="flex items-center gap-1.5 pt-1 border-t border-black/5">
                          <DollarSign className="h-3 w-3 text-emerald-600" />
                          <p className="text-[11px] font-semibold text-emerald-700">Recovery: {rec.estimatedRecovery}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
