"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  Receipt, ShoppingBag, Users, Clock, Calendar, Award, Percent,
  CreditCard, Banknote, Smartphone, BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const periods = [
  { label: "Week", value: "7d" },
  { label: "Month", value: "30d" },
  { label: "Quarter", value: "90d" },
  { label: "Year", value: "365d" },
];

const methodIcons: Record<string, typeof DollarSign> = {
  cash: Banknote,
  card: CreditCard,
  mobile_banking: Smartphone,
  credit: Receipt,
  cheque: Receipt,
};

const methodColors: Record<string, string> = {
  cash: "bg-gradient-to-r from-emerald-500 to-green-400",
  card: "bg-gradient-to-r from-blue-500 to-sky-400",
  mobile_banking: "bg-gradient-to-r from-purple-500 to-fuchsia-400",
  credit: "bg-gradient-to-r from-orange-500 to-amber-400",
  cheque: "bg-gradient-to-r from-cyan-500 to-teal-400",
};

const rankStyles = [
  "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30",
  "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-500/30",
  "bg-gradient-to-br from-orange-400 to-orange-700 text-white shadow-orange-700/30",
];

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
      <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2 stagger-in">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Sales Analytics</h1>
        </div>
        <div className="stagger-in flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-pharmacy border-0 overflow-hidden">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-9 w-9 rounded-xl" />
                  <div className="skeleton h-2.5 w-16 rounded" />
                </div>
                <div className="skeleton h-7 w-24 rounded" />
                <div className="skeleton h-2 w-20 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-40 w-full rounded-lg" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <Card key={i} className="shadow-pharmacy border-0 overflow-hidden">
              <CardContent className="p-4 space-y-2.5">
                <div className="skeleton h-4 w-28 rounded" />
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="skeleton h-7 w-7 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-3 w-3/4 rounded" />
                      <div className="skeleton h-2 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2 stagger-in">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Sales Analytics</h1>
        </div>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 mx-auto flex items-center justify-center mb-4 ring-1 ring-emerald-100">
              <BarChart3 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-base font-semibold mb-1">No analytics data available</p>
            <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
              We couldn&apos;t load sales analytics for this period. Please try again.
            </p>
            <Button
              onClick={fetchAnalytics}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const { kpis } = data;
  const isGrowth = kpis.growthPercent >= 0;
  const peakMaxCount = Math.max(...data.peakHours.map((x) => x.count), 1);
  const dowMaxTotal = Math.max(...data.dayOfWeek.map((x) => x.total), 1);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Sales Analytics</h1>
        <Button variant="ghost" size="icon" onClick={fetchAnalytics} className="rounded-xl hover:bg-emerald-50 hover:text-emerald-600">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Period Selector Pills */}
      <div className="stagger-in flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 shadow-sm",
              period === p.value
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-500/20"
                : "bg-white text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 border border-emerald-100"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Revenue — emerald */}
        <Card className="stagger-in card-hover shadow-pharmacy border-0 border-l-4 border-l-emerald-500 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/25">
                <DollarSign className="h-4 w-4 text-white" />
              </div>
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                isGrowth ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"
              )}>
                {isGrowth ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(kpis.growthPercent)}%
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">৳{kpis.totalSales.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpis.salesCount} orders</p>
          </CardContent>
        </Card>

        {/* Total Sales — blue */}
        <Card className="stagger-in card-hover shadow-pharmacy border-0 border-l-4 border-l-blue-500 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                <Receipt className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Total Sales</p>
            <p className="text-xl font-bold text-blue-600 mt-0.5">৳{kpis.netRevenue.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Net of refunds</p>
          </CardContent>
        </Card>

        {/* Avg Sale Value — purple */}
        <Card className="stagger-in card-hover shadow-pharmacy border-0 border-l-4 border-l-purple-500 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/25">
                <Percent className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Avg Sale Value</p>
            <p className="text-xl font-bold text-purple-600 mt-0.5">৳{kpis.avgSaleValue.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Per order</p>
          </CardContent>
        </Card>

        {/* Total Items — amber */}
        <Card className="stagger-in card-hover shadow-pharmacy border-0 border-l-4 border-l-amber-500 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/25">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Total Items</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{kpis.salesCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpis.paymentsCount} payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Discounts / Tax / Refunds Summary */}
      <div className="grid grid-cols-3 gap-2 stagger-in">
        <Card className="shadow-pharmacy border-0 overflow-hidden bg-gradient-to-br from-orange-50/80 to-white">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 mx-auto flex items-center justify-center mb-1.5 shadow-sm shadow-orange-500/20">
              <Percent className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-orange-600">৳{kpis.totalDiscounts.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Discounts</p>
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-0 overflow-hidden bg-gradient-to-br from-purple-50/80 to-white">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 mx-auto flex items-center justify-center mb-1.5 shadow-sm shadow-purple-500/20">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-purple-600">৳{kpis.totalTax.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Tax / VAT</p>
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-0 overflow-hidden bg-gradient-to-br from-red-50/80 to-white">
          <CardContent className="p-3 text-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-400 to-red-600 mx-auto flex items-center justify-center mb-1.5 shadow-sm shadow-red-500/20">
              <TrendingDown className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-red-600">৳{kpis.totalRefunds.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              Sales Trend
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              {data.dailyTrend.length} points
            </span>
          </div>
          <SalesTrendChart data={data.dailyTrend} />
        </CardContent>
      </Card>

      {/* Top Products */}
      {data.topProducts.length > 0 && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-50 flex items-center justify-center">
                <ShoppingBag className="h-3.5 w-3.5 text-amber-600" />
              </span>
              Top Products
            </h2>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-1 pharmacy-scroll">
              {data.topProducts.slice(0, 8).map((p, idx) => (
                <div
                  key={p.productId}
                  className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-emerald-50/40 transition-colors"
                >
                  <span
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm",
                      rankStyles[idx] || "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.productName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.quantity} units sold · {p.salesCount} sales
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-600">৳{p.revenue.toFixed(0)}</p>
                    <p className="text-[9px] text-muted-foreground">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peak Hours — emerald gradient bars */}
      {data.peakHours.length > 0 && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              Peak Hours
            </h2>
            <div className="space-y-2">
              {data.peakHours.map((h) => {
                const widthPct = (h.count / peakMaxCount) * 100;
                return (
                  <div key={h.hour} className="flex items-center gap-2.5">
                    <span className="text-[10px] font-medium text-muted-foreground w-10 shrink-0 text-right">
                      {h.label}
                    </span>
                    <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${Math.max(widthPct, h.count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <div className="w-16 shrink-0 text-right">
                      <p className="text-[10px] font-bold leading-tight">{h.count}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">৳{h.total.toFixed(0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods — colored progress bars */}
      {data.paymentMethods.length > 0 && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
              </span>
              Payment Methods
            </h2>
            <div className="space-y-3">
              {data.paymentMethods.map((pm) => {
                const Icon = methodIcons[pm.method] || DollarSign;
                return (
                  <div key={pm.method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium capitalize">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {pm.method.replace("_", " ")}
                      </span>
                      <span className="font-semibold">
                        ৳{pm.total.toFixed(0)}{" "}
                        <span className="text-muted-foreground font-normal">({pm.percent.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", methodColors[pm.method] || "bg-gradient-to-r from-gray-400 to-gray-500")}
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

      {/* Day of Week — emerald gradient bars */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            </span>
            Sales by Day of Week
          </h2>
          <div className="flex items-end justify-between gap-1.5 h-32">
            {data.dayOfWeek.map((d) => {
              const heightPct = (d.total / dowMaxTotal) * 100;
              return (
                <div key={d.dayNum} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-emerald-600">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all duration-500",
                        d.count > 0
                          ? "bg-gradient-to-t from-emerald-600 to-teal-400"
                          : "bg-muted/30"
                      )}
                      style={{ height: `${Math.max(heightPct, d.count > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground">{d.day}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      {data.topCustomers.length > 0 && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-blue-600" />
              </span>
              Top Customers
            </h2>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1 pharmacy-scroll">
              {data.topCustomers.map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-blue-50/40 transition-colors"
                >
                  <span
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm",
                      rankStyles[idx] || "bg-blue-50 text-blue-700"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{c.customer?.name || "Walk-in"}</p>
                    <p className="text-[10px] text-muted-foreground">{c.visitCount} visits</p>
                  </div>
                  <p className="text-xs font-bold text-blue-600 shrink-0">৳{c.totalSpent.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discount Rules Used */}
      {data.discountRulesUsed.length > 0 && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-50 flex items-center justify-center">
                <Award className="h-3.5 w-3.5 text-amber-600" />
              </span>
              Discount Rules Used
            </h2>
            <div className="space-y-1.5">
              {data.discountRulesUsed.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-amber-50/40 transition-colors"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground font-medium">
                    <span className="text-amber-600 font-semibold">{r.timesUsed}×</span>{" "}
                    · ৳{r.totalDiscountGiven.toFixed(0)} given
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
