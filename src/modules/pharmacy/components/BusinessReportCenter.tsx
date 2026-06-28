"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Printer, Receipt, TrendingUp,
  TrendingDown, DollarSign, Boxes, Users, Truck,
  MapPin, Phone, Calendar, ShoppingBag, Package,
  Wallet, BarChart3, Trophy,
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

interface BusinessReport {
  generatedAt: string;
  period: string;
  startDate: string;
  endDate: string;
  business: { name: string; address: string | null; phone: string | null; type: string };
  executiveSummary: {
    totalSales: number; salesCount: number; totalQuantitySold: number; avgSaleValue: number;
    totalReturns: number; returnsCount: number;
    netRevenue: number;
    totalCOGS: number; cogsPercent: number;
    grossProfit: number; grossMargin: number;
    totalPurchases: number; purchaseCount: number;
    cashReceived: number; cashPaidToSuppliers: number; netCashFlow: number;
    totalDiscounts: number; totalTax: number;
  };
  inventory: { costValue: number; mrpValue: number; potentialProfit: number; expiredBatches: number; nearExpiryBatches: number; totalBatches: number };
  contacts: { totalCustomers: number; totalSuppliers: number };
  financials: { receivables: { amount: number; count: number }; payables: { amount: number; count: number } };
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  dailyData: Array<{ date: string; sales: number; salesCount: number; purchases: number; purchasesCount: number }>;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function BusinessReportCenter() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [report, setReport] = useState<BusinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  const fetchReport = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/reports/business?period=${period}`);
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err) {
      console.error("Business report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading || !report) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SkeletonCard className="h-7 w-44" />
          <div className="flex-1" />
          <SkeletonCard className="h-9 w-28" />
        </div>
        <SkeletonCard className="h-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
        <SkeletonCard className="h-48" />
      </motion.div>
    );
  }

  const { executiveSummary: s, inventory: inv, contacts: c, financials: f, topProducts, dailyData } = report;
  const maxDaily = Math.max(...dailyData.map((d) => Math.max(d.sales, d.purchases)), 1);

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Business Report</h1>
          <p className="text-[11px] text-muted-foreground">Comprehensive printable summary</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-28 shadow-pharmacy"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">7 Days</SelectItem>
            <SelectItem value="month">30 Days</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
        <Button className="h-9 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-pharmacy font-semibold gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Business Header - gradient emerald card */}
      <Card className="shadow-pharmacy-xl border-0 overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white stagger-in print:border-0 print:shadow-none">
        <CardContent className="p-5 relative">
          <div className="absolute top-0 right-0 h-40 w-40 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-3xl" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider mb-2">
              <Receipt className="h-3 w-3" /> Business Report
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{report.business.name}</h2>
            <p className="text-sm text-emerald-50/90 mt-0.5">{report.business.type}</p>
            {report.business.address && (
              <p className="text-xs text-emerald-50/80 mt-1 flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" /> {report.business.address}
              </p>
            )}
            {report.business.phone && (
              <p className="text-xs text-emerald-50/80 mt-0.5 flex items-center justify-center gap-1">
                <Phone className="h-3 w-3" /> {report.business.phone}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 mt-3">
              <Badge variant="outline" className="capitalize text-white border-white/40 bg-white/10 backdrop-blur">{period} Report</Badge>
              <span className="text-[10px] text-emerald-50/80 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(report.startDate).toLocaleDateString("en-GB")} — {new Date(report.endDate).toLocaleDateString("en-GB")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-emerald-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Total Sales</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">৳{s.totalSales.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.salesCount} orders</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                <ShoppingBag className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-blue-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Purchases</p>
                <p className="text-xl font-bold text-blue-600 mt-1">৳{s.totalPurchases.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.purchaseCount} orders</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <Package className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("card-hover shadow-pharmacy border-l-4 stagger-in", s.grossProfit >= 0 ? "border-l-emerald-500" : "border-l-rose-500")}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Gross Profit</p>
                <p className={cn("text-xl font-bold mt-1", s.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>৳{s.grossProfit.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Margin: {s.grossMargin.toFixed(1)}%</p>
              </div>
              <div className={cn("h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm", s.grossProfit >= 0 ? "from-emerald-500 to-teal-600" : "from-rose-500 to-red-600")}>
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-purple-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Net Cash Flow</p>
                <p className={cn("text-xl font-bold mt-1", s.netCashFlow >= 0 ? "text-purple-600" : "text-rose-600")}>৳{s.netCashFlow.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">In: ৳{s.cashReceived.toFixed(0)}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
                <Wallet className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-muted/50 to-muted/30 border-b flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-bold">Detailed Breakdown</p>
          </div>
          <div className="divide-y">
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Gross Sales</span>
              <span className="font-semibold">৳{s.totalSales.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm bg-rose-50/30">
              <span className="text-rose-600 flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Returns ({s.returnsCount})</span>
              <span className="font-semibold text-rose-600">−৳{s.totalReturns.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm bg-gradient-to-r from-emerald-50/50 to-transparent">
              <span className="font-bold text-emerald-700">Net Revenue</span>
              <span className="font-bold text-emerald-700">৳{s.netRevenue.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-amber-600 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> COGS ({s.cogsPercent.toFixed(1)}%)
              </span>
              <span className="font-semibold text-rose-600">−৳{s.totalCOGS.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-orange-600">Discounts Given</span>
              <span className="font-semibold text-orange-600">৳{s.totalDiscounts.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tax Collected</span>
              <span className="font-semibold">৳{s.totalTax.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Snapshot */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold">Inventory Snapshot</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2.5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100">
              <p className="text-[9px] font-semibold text-blue-700 uppercase tracking-wide">Cost Value</p>
              <p className="text-base font-bold text-blue-700 mt-1">৳{inv.costValue.toFixed(0)}</p>
            </div>
            <div className="text-center p-2.5 bg-gradient-to-br from-emerald-50 to-teal-100/50 rounded-xl border border-emerald-100">
              <p className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wide">MRP Value</p>
              <p className="text-base font-bold text-emerald-700 mt-1">৳{inv.mrpValue.toFixed(0)}</p>
            </div>
            <div className="text-center p-2.5 bg-gradient-to-br from-amber-50 to-yellow-100/50 rounded-xl border border-amber-100">
              <p className="text-[9px] font-semibold text-amber-700 uppercase tracking-wide">Profit</p>
              <p className="text-base font-bold text-amber-700 mt-1">৳{inv.potentialProfit.toFixed(0)}</p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 text-[10px] text-muted-foreground pt-2 border-t">
            <span className="font-medium">{inv.totalBatches} batches</span>
            {inv.expiredBatches > 0 && (
              <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[9px] h-4 px-1.5">{inv.expiredBatches} expired</Badge>
            )}
            {inv.nearExpiryBatches > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[9px] h-4 px-1.5">{inv.nearExpiryBatches} near expiry</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Financial Position */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">Financial Position</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <p className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wide">Receivables</p>
              <p className="text-base font-bold text-emerald-700 mt-1">৳{f.receivables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{f.receivables.count} invoices</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-rose-50 to-red-50 rounded-xl border border-rose-100">
              <p className="text-[9px] font-semibold text-rose-700 uppercase tracking-wide">Payables</p>
              <p className="text-base font-bold text-rose-700 mt-1">৳{f.payables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{f.payables.count} suppliers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold">{c.totalCustomers}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold">{c.totalSuppliers}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Suppliers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales vs Purchases Trend */}
      {dailyData.length > 0 && (
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold">Sales vs Purchases Trend</h2>
            </div>
            <div className="flex items-end justify-between gap-0.5 h-24">
              {dailyData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    <div className="w-1/2 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all" style={{ height: `${(day.sales / maxDaily) * 100}%`, minHeight: day.sales > 0 ? 4 : 2 }} />
                    <div className="w-1/2 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all" style={{ height: `${(day.purchases / maxDaily) * 100}%`, minHeight: day.purchases > 0 ? 4 : 2 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-5 mt-3 pt-2 border-t text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" /> Sales
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-blue-600 to-blue-400" /> Purchases
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-700">Top Products by Revenue</p>
            </div>
            <div className="divide-y">
              {topProducts.slice(0, 5).map((p, idx) => (
                <div key={idx} className="p-3.5 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.quantity} units sold</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 shrink-0">৳{p.revenue.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
