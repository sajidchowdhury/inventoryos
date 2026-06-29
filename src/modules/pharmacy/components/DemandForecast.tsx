"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Sparkles, RefreshCw, TrendingUp, TrendingDown,
  Minus, Loader2, Calendar, AlertTriangle, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface Forecast {
  productId: string;
  productName: string;
  genericName: string | null;
  category: { name: string; color: string } | null;
  unit: string;
  mrp: number | null;
  currentStock: number;
  totalSold90d: number;
  avgDailySales: number;
  last7Days: number;
  last30Days: number;
  forecastDays: number;
  forecastedSales: number;
  forecastedRevenue: number;
  trend: "increasing" | "decreasing" | "stable";
  trendPercent: number;
  confidence: number;
  peakDay: string;
  peakDayPercent: number;
  daysOfStock: number | null;
  willStockOut: boolean;
  stockoutDay: number | null;
}

const trendConfig = {
  increasing: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", label: "↑ Increasing" },
  decreasing: { icon: TrendingDown, color: "text-red-600", bg: "bg-red-50", label: "↓ Decreasing" },
  stable: { icon: Minus, color: "text-blue-600", bg: "bg-blue-50", label: "→ Stable" },
};

export function DemandForecast() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [data, setData] = useState<{ forecasts: Forecast[]; summary: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState("30");

  const generateForecast = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: parseInt(days) }),
      });
      const json = await res.json();
      if (json.success) {
        setData({ forecasts: json.forecasts, summary: json.summary });
      }
    } catch (err) {
      console.error("Forecast error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, days]);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("ai-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-primary" /> Demand Forecast
        </h1>
        <Select value={days} onValueChange={(v) => { setDays(v); }}>
          <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 Days</SelectItem>
            <SelectItem value="30">30 Days</SelectItem>
            <SelectItem value="90">90 Days</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5" onClick={generateForecast} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Forecasting..." : "Forecast"}
        </Button>
      </div>

      {!data && !loading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-base font-bold">AI Demand Forecasting</h2>
            <p className="text-sm text-muted-foreground">
              Predicts future sales for each product based on 90-day historical data, trend analysis, and day-of-week patterns.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">Analyzing 90 days of sales history...</p>
            <p className="text-xs text-muted-foreground">Calculating trends, velocity, and day-of-week patterns</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2">
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-primary">{data.summary.productsAnalyzed}</p>
              <p className="text-[9px] text-muted-foreground">Products</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-green-600">৳{data.summary.totalForecastedRevenue?.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">Forecast Rev</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-blue-600">{data.summary.avgConfidence}%</p>
              <p className="text-[9px] text-muted-foreground">Confidence</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-red-600">{data.summary.willStockOut}</p>
              <p className="text-[9px] text-muted-foreground">Will Stock Out</p>
            </CardContent></Card>
          </div>

          {/* Forecasts */}
          <div className="space-y-2">
            {data.forecasts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No sales data available for forecasting. Make some sales first!
                </CardContent>
              </Card>
            ) : (
              data.forecasts.map((f) => {
                const trend = trendConfig[f.trend];
                const TrendIcon = trend.icon;
                return (
                  <Card key={f.productId} className={cn("border-l-4", f.willStockOut ? "border-l-red-500" : "border-l-blue-500")}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{f.productName}</p>
                            <Badge variant="outline" className={cn("text-[9px]", trend.color, trend.bg)}>
                              <TrendIcon className="h-2.5 w-2.5 mr-0.5" />
                              {f.trendPercent > 0 ? "+" : ""}{f.trendPercent}%
                            </Badge>
                          </div>
                          {f.genericName && <p className="text-[10px] text-muted-foreground">{f.genericName}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-primary">{f.forecastedSales}</p>
                          <p className="text-[9px] text-muted-foreground">units in {f.forecastDays}d</p>
                        </div>
                      </div>

                      {/* Forecast details */}
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <p className="text-muted-foreground">Current Stock</p>
                          <p className="font-bold">{f.currentStock}</p>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <p className="text-muted-foreground">Daily Avg</p>
                          <p className="font-bold">{f.avgDailySales}</p>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <p className="text-muted-foreground">Peak Day</p>
                          <p className="font-bold">{f.peakDay} ({f.peakDayPercent}%)</p>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <p className="text-muted-foreground">Confidence</p>
                          <p className="font-bold">{f.confidence}%</p>
                        </div>
                      </div>

                      {/* Stockout warning */}
                      {f.willStockOut && (
                        <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 rounded p-1.5">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Will stock out in ~{f.stockoutDay} days. Reorder {Math.max(f.forecastedSales - f.currentStock, 0)} units.
                        </div>
                      )}

                      {/* Revenue forecast */}
                      {f.forecastedRevenue > 0 && (
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t">
                          <span className="text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" /> Forecast Revenue
                          </span>
                          <span className="font-bold text-green-600">৳{f.forecastedRevenue.toFixed(0)}</span>
                        </div>
                      )}
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
