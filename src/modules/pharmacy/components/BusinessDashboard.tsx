"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  Package, ShoppingBag, ShoppingCart, AlertTriangle, Clock,
  Users, Truck, Receipt, Banknote, BarChart3, Percent,
  CalendarClock, Boxes,
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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Business Overview</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  const maxSale = Math.max(...data.last7Days.map((d) => Math.max(d.sales, d.purchases)), 1);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Business Overview</h1>
        <Button variant="ghost" size="icon" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ── PROFIT HERO CARD ── */}
      <Card className={cn("border-l-4", data.profit.monthGrossProfit >= 0 ? "border-l-green-500 bg-green-50/30" : "border-l-red-500 bg-red-50/30")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Monthly Gross Profit</p>
              <p className={cn("text-3xl font-bold", data.profit.monthGrossProfit >= 0 ? "text-green-600" : "text-red-600")}>
                ৳{data.profit.monthGrossProfit.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">Margin: {data.profit.monthProfitMargin}%</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold text-green-600">৳{data.profit.monthRevenue.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">COGS: ৳{data.profit.monthCOGS.toFixed(0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TODAY'S KPIs ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Today&apos;s Sales</p>
                <p className="text-xl font-bold text-green-600">৳{data.sales.today.total.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">{data.sales.today.count} orders</p>
              </div>
              <ShoppingCart className="h-6 w-6 text-green-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Today&apos;s Purchases</p>
                <p className="text-xl font-bold text-blue-600">৳{data.purchases.today.total.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">{data.purchases.today.count} orders</p>
              </div>
              <Package className="h-6 w-6 text-blue-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Cash In (Today)</p>
                <p className="text-xl font-bold text-emerald-600">৳{data.payments.today.total.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">{data.payments.today.count} payments</p>
              </div>
              <Banknote className="h-6 w-6 text-emerald-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Returns (Month)</p>
                <p className="text-xl font-bold text-orange-600">৳{data.returns.month.refund.toFixed(0)}</p>
                <p className="text-[9px] text-muted-foreground">{data.returns.month.count} returns</p>
              </div>
              <TrendingDown className="h-6 w-6 text-orange-600/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SALES VS PURCHASES CHART (7 days) ── */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Sales vs Purchases (7 days)
          </h2>
          <div className="flex items-end justify-between gap-1 h-32">
            {data.last7Days.map((day, idx) => {
              const salesHeight = (day.sales / maxSale) * 100;
              const purchHeight = (day.purchases / maxSale) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  {day.sales > 0 && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      S: ৳{day.sales.toFixed(0)} · P: ৳{day.purchases.toFixed(0)}
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    <div className="w-1/2 bg-green-500 rounded-t-sm" style={{ height: `${Math.max(salesHeight, day.sales > 0 ? 4 : 2)}%` }} />
                    <div className="w-1/2 bg-blue-500 rounded-t-sm" style={{ height: `${Math.max(purchHeight, day.purchases > 0 ? 4 : 2)}%` }} />
                  </div>
                  <span className="text-[8px] text-muted-foreground mt-1">{day.dayName}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> Sales</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Purchases</span>
          </div>
        </CardContent>
      </Card>

      {/* ── INVENTORY VALUATION ── */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Boxes className="h-4 w-4" /> Inventory Valuation
          </h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Cost Value</p>
              <p className="text-sm font-bold">৳{data.inventory.costValue.toFixed(0)}</p>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-[9px] text-muted-foreground">MRP Value</p>
              <p className="text-sm font-bold text-green-600">৳{data.inventory.mrpValue.toFixed(0)}</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Potential Profit</p>
              <p className="text-sm font-bold text-green-600">৳{data.inventory.potentialProfit.toFixed(0)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t">
            <span>{data.inventory.totalProducts} products</span>
            <span>·</span>
            <span>{data.inventory.totalBatches} batches</span>
            {data.inventory.lowStockProducts > 0 && (
              <>
                <span>·</span>
                <span className="text-orange-600">{data.inventory.lowStockProducts} low stock</span>
              </>
            )}
            {data.inventory.outOfStockProducts > 0 && (
              <>
                <span>·</span>
                <span className="text-red-600">{data.inventory.outOfStockProducts} out of stock</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── EXPIRY ALERTS SUMMARY ── */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> Expiry Status
          </h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-base font-bold text-green-600">{data.inventory.totalBatches - data.expiry.expiredBatches - data.expiry.nearExpiryBatches - data.expiry.quarantinedBatches}</p>
              <p className="text-[9px] text-muted-foreground">Active</p>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded-lg">
              <p className="text-base font-bold text-orange-600">{data.expiry.nearExpiryBatches}</p>
              <p className="text-[9px] text-muted-foreground">Near Exp</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <p className="text-base font-bold text-red-600">{data.expiry.expiredBatches}</p>
              <p className="text-[9px] text-muted-foreground">Expired</p>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <p className="text-base font-bold text-purple-600">{data.expiry.quarantinedBatches}</p>
              <p className="text-[9px] text-muted-foreground">Quarantined</p>
            </div>
          </div>
          {data.expiry.valueAtRisk > 0 && (
            <p className="text-[10px] text-red-600 pt-1 border-t">
              Value at risk (90d): ৳{data.expiry.valueAtRisk.toFixed(0)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── FINANCIAL POSITION ── */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" /> Financial Position
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Receivables (owed to us)</p>
              <p className="text-base font-bold text-green-600">৳{data.financials.receivables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">{data.financials.receivables.count} invoices</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Payables (we owe)</p>
              <p className="text-base font-bold text-red-600">৳{data.financials.payables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">{data.financials.payables.count} suppliers</p>
            </div>
          </div>
          <div className="pt-1 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Net Position</span>
            <span className={cn("font-bold", data.financials.receivables.amount - data.financials.payables.amount >= 0 ? "text-green-600" : "text-red-600")}>
              ৳{(data.financials.receivables.amount - data.financials.payables.amount).toFixed(0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── CONTACTS ── */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveView("customers")}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-base font-bold">{data.contacts.totalCustomers}</p>
              <p className="text-[9px] text-muted-foreground">Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveView("suppliers")}>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
              <Truck className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-base font-bold">{data.contacts.totalSuppliers}</p>
              <p className="text-[9px] text-muted-foreground">Suppliers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── REPORT LINKS ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Reports</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-2 h-12" onClick={() => setActiveView("profit-loss")}>
            <TrendingUp className="h-4 w-4" /> Profit & Loss
          </Button>
          <Button variant="outline" className="gap-2 h-12" onClick={() => setActiveView("inventory-value")}>
            <Boxes className="h-4 w-4" /> Inventory Value
          </Button>
          <Button variant="outline" className="gap-2 h-12" onClick={() => setActiveView("business-report")}>
            <Receipt className="h-4 w-4" /> Business Report
          </Button>
          <Button variant="outline" className="gap-2 h-12" onClick={() => setActiveView("analytics")}>
            <BarChart3 className="h-4 w-4" /> Sales Analytics
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
