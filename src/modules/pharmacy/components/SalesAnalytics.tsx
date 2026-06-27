"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  Receipt, ShoppingBag, Users, Clock, Calendar, Award, Percent,
  CreditCard, Banknote, Smartphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { SalesTrendChart } from "./SalesTrendChart";
import { cn } from "@/lib/utils";

interface AnalyticsData {
  period: string;
  kpis: {
    totalSales: number;
    salesCount: number;
    avgSaleValue: number;
    totalCollected: number;
    paymentsCount: number;
    totalRefunds: number;
    refundsCount: number;
    netRevenue: number;
    totalDiscounts: number;
    totalTax: number;
    prevPeriodTotal: number;
    growthPercent: number;
  };
  dailyTrend: Array<{ date: string; label: string; sales: number; count: number; refunds: number; net: number }>;
  topProducts: Array<{ productId: string; productName: string; quantity: number; revenue: number; salesCount: number }>;
  topCustomers: Array<{ customer: { id: string; name: string; phone: string | null } | null; totalSpent: number; visitCount: number }>;
  paymentMethods: Array<{ method: string; total: number; count: number; percent: number }>;
  peakHours: Array<{ hour: number; label: string; count: number; total: number }>;
  dayOfWeek: Array<{ day: string; dayNum: number; count: number; total: number }>;
  discountRulesUsed: Array<{ id: string; name: string; timesUsed: number; totalDiscountGiven: number }>;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const methodIcons: Record<string, typeof DollarSign> = {
  cash: Banknote,
  card: CreditCard,
  mobile_banking: Smartphone,
  credit: Receipt,
  cheque: Receipt,
};

const methodColors: Record<string, string> = {
  cash: "bg-green-500",
  card: "bg-blue-500",
  mobile_banking: "bg-purple-500",
  credit: "bg-orange-500",
  cheque: "bg-cyan-500",
};

export function SalesAnalytics() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  const fetchAnalytics = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/sales/analytics?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Analytics</h1>
        </div>
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Failed to load analytics</CardContent></Card>
      </motion.div>
    );
  }

  const { kpis } = data;
  const isGrowth = kpis.growthPercent >= 0;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Sales Analytics</h1>
        <Button variant="ghost" size="icon" onClick={fetchAnalytics}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
            <SelectItem value="90d">90 Days</SelectItem>
            <SelectItem value="365d">1 Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Total Sales</p>
                <p className="text-xl font-bold text-green-600">৳{kpis.totalSales.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">{kpis.salesCount} orders</p>
              </div>
              <div className={cn(
                "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
                isGrowth ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
              )}>
                {isGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(kpis.growthPercent)}%
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Net Revenue</p>
            <p className="text-xl font-bold text-blue-600">৳{kpis.netRevenue.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">After refunds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Avg Sale Value</p>
            <p className="text-xl font-bold">৳{kpis.avgSaleValue.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">Per order</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Collected</p>
            <p className="text-xl font-bold text-emerald-600">৳{kpis.totalCollected.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">{kpis.paymentsCount} payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Discounts & Tax Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-orange-50/50">
          <CardContent className="p-2 text-center">
            <Percent className="h-4 w-4 mx-auto text-orange-600 mb-0.5" />
            <p className="text-sm font-bold text-orange-600">৳{kpis.totalDiscounts.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">Discounts</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50/50">
          <CardContent className="p-2 text-center">
            <Receipt className="h-4 w-4 mx-auto text-purple-600 mb-0.5" />
            <p className="text-sm font-bold text-purple-600">৳{kpis.totalTax.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">Tax/VAT</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50">
          <CardContent className="p-2 text-center">
            <TrendingDown className="h-4 w-4 mx-auto text-red-600 mb-0.5" />
            <p className="text-sm font-bold text-red-600">৳{kpis.totalRefunds.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">Refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Sales Trend
          </h2>
          <SalesTrendChart data={data.dailyTrend} />
        </CardContent>
      </Card>

      {/* Payment Methods */}
      {data.paymentMethods.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">Payment Methods</h2>
            <div className="space-y-2">
              {data.paymentMethods.map((pm) => {
                const Icon = methodIcons[pm.method] || DollarSign;
                return (
                  <div key={pm.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium capitalize">
                        <Icon className="h-3.5 w-3.5" /> {pm.method.replace("_", " ")}
                      </span>
                      <span>৳{pm.total.toFixed(0)} <span className="text-muted-foreground">({pm.percent.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", methodColors[pm.method] || "bg-gray-500")}
                        style={{ width: `${pm.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products */}
      {data.topProducts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4" /> Top Products
            </h2>
            <div className="space-y-2">
              {data.topProducts.slice(0, 5).map((p, idx) => (
                <div key={p.productId} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.productName}</p>
                    <p className="text-[10px] text-muted-foreground">{p.quantity} units · {p.salesCount} sales</p>
                  </div>
                  <p className="text-xs font-bold text-green-600 shrink-0">৳{p.revenue.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Customers */}
      {data.topCustomers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Top Customers
            </h2>
            <div className="space-y-2">
              {data.topCustomers.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.customer?.name || "Walk-in"}</p>
                    <p className="text-[10px] text-muted-foreground">{c.visitCount} visits</p>
                  </div>
                  <p className="text-xs font-bold text-blue-600 shrink-0">৳{c.totalSpent.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peak Hours */}
      {data.peakHours.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Peak Hours
            </h2>
            <div className="grid grid-cols-5 gap-2">
              {data.peakHours.map((h, idx) => (
                <div key={h.hour} className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-[10px] font-bold">{h.label}</p>
                  <p className="text-[9px] text-muted-foreground">{h.count} sales</p>
                  <p className="text-[10px] font-semibold text-green-600">৳{h.total.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day of Week */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Sales by Day of Week
          </h2>
          <div className="grid grid-cols-7 gap-1">
            {data.dayOfWeek.map((d) => {
              const maxTotal = Math.max(...data.dayOfWeek.map((x) => x.total), 1);
              const heightPct = (d.total / maxTotal) * 100;
              return (
                <div key={d.dayNum} className="flex flex-col items-center gap-1">
                  <div className="w-full h-16 flex items-end">
                    <div
                      className={cn("w-full rounded-t", d.count > 0 ? "bg-blue-500" : "bg-muted/30")}
                      style={{ height: `${Math.max(heightPct, d.count > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-medium">{d.day}</span>
                  {d.count > 0 && <span className="text-[8px] text-muted-foreground">{d.count}</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Discount Rules Used */}
      {data.discountRulesUsed.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Award className="h-4 w-4" /> Discount Rules Used
            </h2>
            <div className="space-y-2">
              {data.discountRulesUsed.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    {r.timesUsed}× · ৳{r.totalDiscountGiven.toFixed(0)} given
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
