"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, RefreshCw, Loader2, AlertTriangle,
  TrendingDown, RotateCcw, Gift, Trash2, ShieldAlert, Brain,
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

const actionConfig: Record<string, { icon: typeof Brain; color: string; bg: string; label: string }> = {
  sell_priority: { icon: Brain, color: "text-green-600", bg: "bg-green-50", label: "Sell Priority" },
  discount: { icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50", label: "Discount" },
  return_supplier: { icon: RotateCcw, color: "text-blue-600", bg: "bg-blue-50", label: "Return to Supplier" },
  donate: { icon: Gift, color: "text-purple-600", bg: "bg-purple-50", label: "Donate" },
  dispose: { icon: Trash2, color: "text-red-600", bg: "bg-red-50", label: "Dispose" },
  quarantine: { icon: ShieldAlert, color: "text-yellow-600", bg: "bg-yellow-50", label: "Quarantine" },
};

const urgencyColors = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-blue-500",
};

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
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-primary" /> Expiry Optimizer
        </h1>
        {data && (
          <Button variant="ghost" size="icon" onClick={generate} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!data && !loading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-base font-bold">AI Expiry Optimization</h2>
            <p className="text-sm text-muted-foreground">
              AI analyzes your near-expiry batches and recommends the best action for each: sell priority, discount, return to supplier, donate, or dispose.
            </p>
            <Button size="lg" className="gap-2" onClick={generate}>
              <Sparkles className="h-4 w-4" /> Analyze Expiry Risk
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">AI is analyzing expiry risks...</p>
            <p className="text-xs text-muted-foreground">Evaluating each batch for optimal recovery strategy</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-2 text-center">
                <p className="text-base font-bold text-red-600">{data.summary.expiredCount}</p>
                <p className="text-[9px] text-muted-foreground">Expired</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-2 text-center">
                <p className="text-base font-bold text-orange-600">{data.summary.criticalCount}</p>
                <p className="text-[9px] text-muted-foreground">Critical (≤7d)</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardContent className="p-2 text-center">
                <p className="text-base font-bold text-yellow-600">{data.summary.warningCount}</p>
                <p className="text-[9px] text-muted-foreground">Warning (≤30d)</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-700">
              <CardContent className="p-2 text-center">
                <p className="text-base font-bold text-red-700">৳{data.summary.totalValueAtRisk?.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">Value at Risk</p>
              </CardContent>
            </Card>
          </div>

          {/* Action Summary */}
          {data.summary.actionSummary && Object.keys(data.summary.actionSummary).length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-semibold mb-2">Recommended Actions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.summary.actionSummary).map(([action, count]) => {
                    const cfg = actionConfig[action] || actionConfig.sell_priority;
                    return (
                      <Badge key={action} variant="outline" className={cn("text-[9px]", cfg.color, cfg.bg)}>
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
              <Card>
                <CardContent className="p-8 text-center space-y-2">
                  <AlertTriangle className="h-12 w-12 mx-auto text-green-600/50" />
                  <p className="font-medium text-green-600">No expiry risks!</p>
                  <p className="text-sm text-muted-foreground">No batches expiring within 90 days.</p>
                </CardContent>
              </Card>
            ) : (
              data.recommendations.map((rec) => {
                const cfg = actionConfig[rec.action] || actionConfig.sell_priority;
                const ActionIcon = cfg.icon;
                return (
                  <Card key={rec.batchId} className={cn("border-l-4", urgencyColors[rec.urgency as keyof typeof urgencyColors])}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{rec.productName}</p>
                            {rec.daysUntilExpiry < 0 ? (
                              <Badge variant="outline" className="text-[9px] text-red-700 bg-red-100">
                                Expired {Math.abs(rec.daysUntilExpiry)}d ago
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={cn(
                                "text-[9px]",
                                rec.daysUntilExpiry <= 7 ? "text-red-600 bg-red-50" :
                                rec.daysUntilExpiry <= 30 ? "text-orange-600 bg-orange-50" :
                                "text-yellow-600 bg-yellow-50"
                              )}>
                                {rec.daysUntilExpiry}d left
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Batch #{rec.batchNo} · {rec.quantity} {rec.unit} · ৳{rec.valueAtRisk.toFixed(0)} at risk
                          </p>
                        </div>
                      </div>

                      {/* AI Recommendation */}
                      <div className={cn("rounded-lg p-2.5 space-y-1.5", cfg.bg)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ActionIcon className={cn("h-4 w-4", cfg.color)} />
                            <span className={cn("text-xs font-bold", cfg.color)}>{cfg.label}</span>
                            {rec.discountPercent && (
                              <Badge variant="outline" className={cn("text-[9px]", cfg.color)}>
                                {rec.discountPercent}% off
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[8px] capitalize",
                            rec.urgency === "critical" ? "text-red-600" :
                            rec.urgency === "high" ? "text-orange-600" :
                            rec.urgency === "medium" ? "text-yellow-600" : "text-blue-600"
                          )}>
                            {rec.urgency}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{rec.reason}</p>
                        <p className="text-[10px] font-medium text-green-600">Recovery: {rec.estimatedRecovery}</p>
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
