"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  Package, ShoppingBag, ShoppingCart, AlertTriangle, Clock,
  Users, Truck, Receipt, Banknote, BarChart3, Percent,
  CalendarClock, Boxes, FileText, History, Database,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface DashboardData {
  sales: { today: { total: number; count: number; quantity: number }; week: { total: number; count: number }; month: { total: number; count: number; quantity: number } };
  purchases: { today: { total: number; count: number }; month: { total: number; count: number } };
  payments: { today: { total: number; count: number }; month: { total: number } };
  returns: { month: { refund: number; count: number } };
  inventory: { totalProducts: number; lowStockProducts: number; outOfStockProducts: number; totalBatches: number; costValue: number; mrpValue: number; potentialProfit: number };
  expiry: { expiredBatches: number; nearExpiryBatches: number; quarantinedBatches: number; valueAtRisk: number };
  contacts: { totalCustomers: number; totalSuppliers: number };
  financials: { receivables: { amount: number; count: number }; payables: { amount: number; count: number }; cashFlow: { inflow: number; outflow: number } };
  profit: { monthRevenue: number; monthCOGS: number; monthGrossProfit: number; monthProfitMargin: number };
  last7Days: Array<{ date: string; dayName: string; sales: number; salesCount: number; purchases: number; purchasesCount: number }>;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function BusinessDashboard() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/dashboard`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SkeletonCard className="h-7 w-44" />
          <div className="flex-1" />
          <SkeletonCard className="h-9 w-9 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
        <SkeletonCard className="h-48" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-32" />
        </div>
        <SkeletonCard className="h-40" />
      </motion.div>
    );
  }

  const maxSale = Math.max(...data.last7Days.map((d) => Math.max(d.sales, d.purchases)), 1);
  const inventoryMargin = data.inventory.costValue > 0
    ? (data.inventory.potentialProfit / data.inventory.costValue) * 100
    : 0;

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Business Overview</h1>
          <p className="text-[11px] text-muted-foreground">Real-time KPIs & financial health</p>
        </div>
        <Button variant="outline" size="icon" className="shadow-pharmacy" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Grid - 4 columns on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Sales */}
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-emerald-500 stagger-in overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sales</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">৳{data.sales.today.total.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data.sales.today.count} orders today</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchases */}
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-blue-500 stagger-in overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Purchases</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">৳{data.purchases.today.total.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data.purchases.today.count} orders today</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <Package className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Value */}
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-purple-500 stagger-in overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Inventory Value</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">৳{data.inventory.costValue.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data.inventory.totalProducts} products</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
                <Boxes className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit */}
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-amber-500 stagger-in overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Profit (Month)</p>
                <p className={cn("text-2xl font-bold mt-1", data.profit.monthGrossProfit >= 0 ? "text-amber-600" : "text-rose-600")}>
                  ৳{data.profit.monthGrossProfit.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Margin: {data.profit.monthProfitMargin}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales vs Purchases Chart */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-emerald-600" /> Sales vs Purchases
            </h2>
            <span className="text-[10px] text-muted-foreground font-medium">Last 7 days</span>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-36">
            {data.last7Days.map((day, idx) => {
              const salesHeight = (day.sales / maxSale) * 100;
              const purchHeight = (day.purchases / maxSale) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  {day.sales > 0 && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                      <span className="text-emerald-400">S: ৳{day.sales.toFixed(0)}</span>
                      <span className="mx-1 opacity-50">·</span>
                      <span className="text-blue-400">P: ৳{day.purchases.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    <div className="w-1/2 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all" style={{ height: `${Math.max(salesHeight, day.sales > 0 ? 4 : 2)}%` }} />
                    <div className="w-1/2 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all" style={{ height: `${Math.max(purchHeight, day.purchases > 0 ? 4 : 2)}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1.5 font-medium">{day.dayName}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" /> Sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-blue-600 to-blue-400" /> Purchases
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Valuation Summary */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Boxes className="h-4 w-4 text-purple-600" /> Inventory Valuation
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Cost Value</p>
              </div>
              <p className="text-lg font-bold text-blue-700">৳{data.inventory.costValue.toFixed(0)}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">MRP Value</p>
              </div>
              <p className="text-lg font-bold text-emerald-700">৳{data.inventory.mrpValue.toFixed(0)}</p>
            </div>
          </div>
          {/* Margin progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground font-medium">Potential Profit Margin</span>
              <span className="font-bold text-emerald-600">৳{data.inventory.potentialProfit.toFixed(0)} · {inventoryMargin.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                style={{ width: `${Math.min(inventoryMargin, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 text-[10px] text-muted-foreground pt-1 border-t">
            <span className="font-medium">{data.inventory.totalProducts} products</span>
            <span className="opacity-40">•</span>
            <span>{data.inventory.totalBatches} batches</span>
            {data.inventory.lowStockProducts > 0 && (
              <>
                <span className="opacity-40">•</span>
                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[9px] h-4 px-1.5">{data.inventory.lowStockProducts} low</Badge>
              </>
            )}
            {data.inventory.outOfStockProducts > 0 && (
              <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[9px] h-4 px-1.5">{data.inventory.outOfStockProducts} out</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expiry Status Grid */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-amber-600" /> Expiry Status
          </h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2.5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
              <p className="text-xl font-bold text-green-600">{data.inventory.totalBatches - data.expiry.expiredBatches - data.expiry.nearExpiryBatches - data.expiry.quarantinedBatches}</p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">Active</p>
            </div>
            <div className="text-center p-2.5 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100">
              <p className="text-xl font-bold text-amber-600">{data.expiry.nearExpiryBatches}</p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">Near Exp</p>
            </div>
            <div className="text-center p-2.5 bg-gradient-to-br from-rose-50 to-red-50 rounded-xl border border-rose-100">
              <p className="text-xl font-bold text-rose-600">{data.expiry.expiredBatches}</p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">Expired</p>
            </div>
            <div className="text-center p-2.5 bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl border border-purple-100">
              <p className="text-xl font-bold text-purple-600">{data.expiry.quarantinedBatches}</p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">Quarantine</p>
            </div>
          </div>
          {data.expiry.valueAtRisk > 0 && (
            <div className="flex items-center gap-2 text-[10px] text-rose-600 pt-1 border-t">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">Value at risk (90 days): ৳{data.expiry.valueAtRisk.toFixed(0)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Position */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-emerald-600" /> Financial Position
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3 w-3 text-emerald-600" />
                <p className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wide">Receivables</p>
              </div>
              <p className="text-lg font-bold text-emerald-700">৳{data.financials.receivables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{data.financials.receivables.count} invoices owed to us</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-rose-50 to-red-50 rounded-xl border border-rose-100">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="h-3 w-3 text-rose-600" />
                <p className="text-[9px] font-semibold text-rose-700 uppercase tracking-wide">Payables</p>
              </div>
              <p className="text-lg font-bold text-rose-700">৳{data.financials.payables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{data.financials.payables.count} suppliers to pay</p>
            </div>
          </div>
          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Net Position</span>
            <span className={cn("text-base font-bold", data.financials.receivables.amount - data.financials.payables.amount >= 0 ? "text-emerald-600" : "text-rose-600")}>
              ৳{(data.financials.receivables.amount - data.financials.payables.amount).toFixed(0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="card-hover shadow-pharmacy cursor-pointer stagger-in" onClick={() => setActiveView("customers")}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold">{data.contacts.totalCustomers}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy cursor-pointer stagger-in" onClick={() => setActiveView("suppliers")}>
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold">{data.contacts.totalSuppliers}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Suppliers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Links */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Reports</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("profit-loss")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">Profit & Loss</span>
          </Button>
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("inventory-value")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">Inventory Value</span>
          </Button>
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("business-report")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">Business Report</span>
          </Button>
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("report")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">Expiry Report</span>
          </Button>
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("tax-report")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">VAT / Tax</span>
          </Button>
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("audit-trail")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center shrink-0">
              <History className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">Audit Trail</span>
          </Button>
          <Button variant="outline" className="gap-2 h-14 shadow-pharmacy justify-start" onClick={() => setActiveView("data-export")}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 text-white" />
            </div>
            <span className="text-xs font-semibold">Data Export</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
