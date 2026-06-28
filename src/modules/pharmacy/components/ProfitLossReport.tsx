"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, TrendingUp, TrendingDown,
  DollarSign, Percent, AlertCircle, Wallet, Receipt,
  ArrowUpRight, ArrowDownRight, Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface PnLReport {
  period: string;
  startDate: string;
  endDate: string;
  revenue: {
    grossSales: number; returns: number; netRevenue: number;
    salesCount: number; returnsCount: number;
    subtotal: number; discounts: number; tax: number;
  };
  cogs: { total: number; percentage: number };
  grossProfit: { amount: number; margin: number };
  expenses: { purchases: number; purchaseCount: number; purchaseDiscounts: number; purchaseTax: number };
  cashFlow: { received: number; paid: number; net: number };
  netProfit: { amount: number; margin: number };
  topProducts: Array<{ name: string; quantity: number; revenue: number; cost: number; profit: number }>;
  lossProducts: Array<{ name: string; quantity: number; revenue: number; cost: number; profit: number }>;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const periods = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 Days" },
  { value: "month", label: "30 Days" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function ProfitLossReport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [report, setReport] = useState<PnLReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  const fetchReport = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/reports/profit-loss?period=${period}`);
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err) {
      console.error("P&L fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleDownload = () => {
    if (businessId) window.open(`/api/businesses/${businessId}/reports/profit-loss?period=${period}&format=csv`, "_blank");
  };

  if (loading) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SkeletonCard className="h-7 w-44" />
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} className="h-9 flex-1" />)}
        </div>
        <SkeletonCard className="h-44" />
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-40" />
      </motion.div>
    );
  }

  if (!report) return null;

  const isProfit = report.netProfit.amount >= 0;
  const rankColors = ["from-amber-400 to-yellow-500", "from-slate-300 to-slate-400", "from-orange-400 to-amber-600"];

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Profit &amp; Loss</h1>
          <p className="text-[11px] text-muted-foreground">Revenue, costs &amp; net profit</p>
        </div>
        <Button variant="outline" size="icon" className="shadow-pharmacy" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="shadow-pharmacy" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {/* Period selector pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide print:hidden">
        {periods.map((p) => (
          <button
            key={p.value}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0",
              period === p.value
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-pharmacy"
                : "bg-card text-muted-foreground hover:bg-muted shadow-sm"
            )}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Period label */}
      <p className="text-xs text-muted-foreground text-center print:text-black">
        Period: {new Date(report.startDate).toLocaleDateString("en-GB")} — {new Date(report.endDate).toLocaleDateString("en-GB")}
      </p>

      {/* Net Profit Hero Card */}
      <Card className={cn(
        "shadow-pharmacy-xl border-0 overflow-hidden stagger-in",
        isProfit ? "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700" : "bg-gradient-to-br from-rose-500 via-rose-600 to-red-700"
      )}>
        <CardContent className="p-6 text-white text-center relative">
          <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
              {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              Net Profit
            </div>
            <p className="text-4xl font-bold mt-3 tracking-tight">
              {isProfit ? "" : "−"}৳{Math.abs(report.netProfit.amount).toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
                <Percent className="h-3 w-3" />
                <span className="text-xs font-semibold">Margin: {report.netProfit.margin}%</span>
              </div>
              <div className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
                isProfit ? "bg-emerald-300/30" : "bg-rose-300/30"
              )}>
                {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span className="text-xs font-semibold">{isProfit ? "Profit" : "Loss"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-emerald-700">Revenue Breakdown</p>
          </div>
          <div className="divide-y">
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Gross Sales ({report.revenue.salesCount} orders)</span>
              <span className="font-semibold">৳{report.revenue.grossSales.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm bg-rose-50/50">
              <span className="text-rose-600 flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5" /> Returns ({report.revenue.returnsCount})
              </span>
              <span className="font-semibold text-rose-600">−৳{report.revenue.returns.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm bg-gradient-to-r from-emerald-50/50 to-transparent">
              <span className="font-bold text-emerald-700">Net Revenue</span>
              <span className="font-bold text-emerald-700 text-base">৳{report.revenue.netRevenue.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* COGS */}
      <Card className="card-hover shadow-pharmacy stagger-in border-l-4 border-l-amber-500 overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-amber-700">Cost of Goods Sold</p>
          </div>
          <div className="divide-y">
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-rose-600">COGS (direct cost of items sold)</span>
              <span className="font-semibold text-rose-600">−৳{report.cogs.total.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">% of Revenue</span>
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">{report.cogs.percentage.toFixed(1)}%</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gross Profit */}
      <Card className={cn(
        "card-hover shadow-pharmacy stagger-in border-l-4 overflow-hidden",
        report.grossProfit.amount >= 0 ? "border-l-emerald-500" : "border-l-rose-500"
      )}>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className={cn("h-4 w-4", report.grossProfit.amount >= 0 ? "text-emerald-600" : "text-rose-600")} />
              <p className="text-sm font-bold">Gross Profit</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Revenue − COGS · Margin: {report.grossProfit.margin}%</p>
          </div>
          <p className={cn("text-2xl font-bold", report.grossProfit.amount >= 0 ? "text-emerald-600" : "text-rose-600")}>
            ৳{report.grossProfit.amount.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Operating Expenses */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-slate-50 to-muted/50 border-b flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold">Operating Expenses</p>
          </div>
          <div className="divide-y">
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Purchases ({report.expenses.purchaseCount})</span>
              <span className="font-semibold">৳{report.expenses.purchases.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-cyan-50 to-sky-50 border-b flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-cyan-700">Cash Flow</p>
          </div>
          <div className="divide-y">
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-emerald-600 flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" /> Cash Received
              </span>
              <span className="font-semibold text-emerald-600">+৳{report.cashFlow.received.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm">
              <span className="text-rose-600 flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5" /> Paid to Suppliers
              </span>
              <span className="font-semibold text-rose-600">−৳{report.cashFlow.paid.toFixed(2)}</span>
            </div>
            <div className="p-3.5 flex justify-between items-center text-sm bg-gradient-to-r from-cyan-50/50 to-transparent">
              <span className="font-bold">Net Cash Flow</span>
              <span className={cn("font-bold text-base", report.cashFlow.net >= 0 ? "text-emerald-600" : "text-rose-600")}>
                ৳{report.cashFlow.net.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Profitable Products */}
      {report.topProducts.length > 0 && (
        <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-amber-700">Top Profitable Products</p>
            </div>
            <div className="divide-y">
              {report.topProducts.slice(0, 5).map((p, idx) => (
                <div key={idx} className="p-3.5 flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm text-white text-xs font-bold",
                    rankColors[idx] || "from-slate-300 to-slate-400"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.quantity} units · Revenue: ৳{p.revenue.toFixed(0)}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600 shrink-0">+৳{p.profit.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loss-Making Products */}
      {report.lossProducts.length > 0 && (
        <Card className="card-hover shadow-pharmacy stagger-in border-rose-200 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3.5 bg-gradient-to-r from-rose-50 to-red-50 border-b flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-rose-700">Loss-Making Products</p>
            </div>
            <div className="divide-y">
              {report.lossProducts.map((p, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.quantity} units · Revenue: ৳{p.revenue.toFixed(0)}</p>
                  </div>
                  <p className="text-sm font-bold text-rose-600 shrink-0">−৳{Math.abs(p.profit).toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons - gradient emerald */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <Button
          className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-pharmacy font-semibold gap-2"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" /> Download CSV
        </Button>
        <Button
          className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-pharmacy font-semibold gap-2"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" /> Print Report
        </Button>
      </div>
    </motion.div>
  );
}
