"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, TrendingUp, TrendingDown,
  DollarSign, Percent, AlertCircle,
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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  if (!report) return null;

  const isProfit = report.netProfit.amount >= 0;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Profit &amp; Loss</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">7 Days</SelectItem>
            <SelectItem value="month">30 Days</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleDownload}><Download className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
      </div>

      {/* Period */}
      <p className="text-xs text-muted-foreground text-center print:text-black">
        Period: {new Date(report.startDate).toLocaleDateString("en-GB")} — {new Date(report.endDate).toLocaleDateString("en-GB")}
      </p>

      {/* Net Profit Hero */}
      <Card className={cn("border-l-4 print:border-l-4", isProfit ? "border-l-green-500" : "border-l-red-500")}>
        <CardContent className="p-5 text-center">
          <p className="text-xs text-muted-foreground">Net Profit</p>
          <p className={cn("text-3xl font-bold", isProfit ? "text-green-600" : "text-red-600")}>
            {isProfit ? "" : "−"}৳{Math.abs(report.netProfit.amount).toFixed(2)}
          </p>
          <Badge variant="outline" className={cn("mt-1", isProfit ? "text-green-600" : "text-red-600")}>
            Margin: {report.netProfit.margin}%
          </Badge>
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-muted/50 font-semibold text-sm">Revenue</div>
          <div className="p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Gross Sales ({report.revenue.salesCount} orders)</span>
            <span>৳{report.revenue.grossSales.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm text-red-600">
            <span>Less: Returns ({report.revenue.returnsCount})</span>
            <span>−৳{report.revenue.returns.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm font-bold bg-primary/5">
            <span>Net Revenue</span>
            <span className="text-primary">৳{report.revenue.netRevenue.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* COGS */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-muted/50 font-semibold text-sm">Cost of Goods Sold</div>
          <div className="p-3 flex justify-between text-sm text-red-600">
            <span>COGS</span>
            <span>−৳{report.cogs.total.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-xs text-muted-foreground">
            <span>COGS % of Revenue</span>
            <span>{report.cogs.percentage.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Gross Profit */}
      <Card className={cn("border-l-4", report.grossProfit.amount >= 0 ? "border-l-green-500" : "border-l-red-500")}>
        <CardContent className="p-3 flex justify-between">
          <div>
            <p className="text-sm font-semibold">Gross Profit</p>
            <p className="text-[10px] text-muted-foreground">Margin: {report.grossProfit.margin}%</p>
          </div>
          <p className={cn("text-xl font-bold", report.grossProfit.amount >= 0 ? "text-green-600" : "text-red-600")}>
            ৳{report.grossProfit.amount.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-muted/50 font-semibold text-sm">Operating Expenses</div>
          <div className="p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Purchases ({report.expenses.purchaseCount})</span>
            <span>৳{report.expenses.purchases.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-muted/50 font-semibold text-sm">Cash Flow</div>
          <div className="p-3 flex justify-between text-sm text-green-600">
            <span>Cash Received</span>
            <span>+৳{report.cashFlow.received.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm text-red-600">
            <span>Paid to Suppliers</span>
            <span>−৳{report.cashFlow.paid.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm font-bold">
            <span>Net Cash Flow</span>
            <span className={report.cashFlow.net >= 0 ? "text-green-600" : "text-red-600"}>
              ৳{report.cashFlow.net.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top Profitable Products */}
      {report.topProducts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-3 bg-muted/50 font-semibold text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-green-600" /> Top Profitable Products
            </div>
            <div className="divide-y">
              {report.topProducts.slice(0, 5).map((p, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.quantity} units · Rev: ৳{p.revenue.toFixed(0)}</p>
                  </div>
                  <p className="text-sm font-bold text-green-600 shrink-0">৳{p.profit.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loss-Making Products */}
      {report.lossProducts.length > 0 && (
        <Card className="border-red-200">
          <CardContent className="p-0">
            <div className="p-3 bg-red-50 font-semibold text-sm flex items-center gap-1.5 text-red-700">
              <AlertCircle className="h-4 w-4" /> Loss-Making Products
            </div>
            <div className="divide-y">
              {report.lossProducts.map((p, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.quantity} units · Rev: ৳{p.revenue.toFixed(0)}</p>
                  </div>
                  <p className="text-sm font-bold text-red-600 shrink-0">−৳{Math.abs(p.profit).toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
