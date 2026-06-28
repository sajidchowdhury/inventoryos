"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, Receipt, TrendingUp,
  TrendingDown, DollarSign, Boxes, Users, Truck,
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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  const { executiveSummary: s, inventory: inv, contacts: c, financials: f, topProducts, dailyData } = report;
  const maxDaily = Math.max(...dailyData.map((d) => Math.max(d.sales, d.purchases)), 1);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Business Report</h1>
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
        <Button variant="outline" size="icon" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
      </div>

      {/* Business Header */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-5 text-center">
          <h2 className="text-xl font-bold">{report.business.name}</h2>
          <p className="text-sm text-muted-foreground">{report.business.type}</p>
          {report.business.address && <p className="text-xs text-muted-foreground">{report.business.address}</p>}
          {report.business.phone && <p className="text-xs text-muted-foreground">Phone: {report.business.phone}</p>}
          <Badge variant="outline" className="mt-2 capitalize">{period} Report</Badge>
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date(report.startDate).toLocaleDateString("en-GB")} — {new Date(report.endDate).toLocaleDateString("en-GB")}
          </p>
        </CardContent>
      </Card>

      {/* Executive Summary Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Sales</p>
            <p className="text-xl font-bold text-green-600">৳{s.totalSales.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">{s.salesCount} orders · Avg: ৳{s.avgSaleValue.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Purchases</p>
            <p className="text-xl font-bold text-blue-600">৳{s.totalPurchases.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">{s.purchaseCount} orders</p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", s.grossProfit >= 0 ? "border-l-emerald-500" : "border-l-red-500")}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Gross Profit</p>
            <p className={cn("text-xl font-bold", s.grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
              ৳{s.grossProfit.toFixed(0)}
            </p>
            <p className="text-[9px] text-muted-foreground">Margin: {s.grossMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Net Cash Flow</p>
            <p className={cn("text-xl font-bold", s.netCashFlow >= 0 ? "text-purple-600" : "text-red-600")}>
              ৳{s.netCashFlow.toFixed(0)}
            </p>
            <p className="text-[9px] text-muted-foreground">In: ৳{s.cashReceived.toFixed(0)} · Out: ৳{s.cashPaidToSuppliers.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-muted/50 font-semibold text-sm">Detailed Breakdown</div>
          <div className="p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Gross Sales</span>
            <span>৳{s.totalSales.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm text-red-600">
            <span>Returns ({s.returnsCount})</span>
            <span>−৳{s.totalReturns.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm font-bold bg-primary/5">
            <span>Net Revenue</span>
            <span className="text-primary">৳{s.netRevenue.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm text-red-600">
            <span>COGS ({s.cogsPercent.toFixed(1)}%)</span>
            <span>−৳{s.totalCOGS.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm text-orange-600">
            <span>Discounts Given</span>
            <span>৳{s.totalDiscounts.toFixed(2)}</span>
          </div>
          <div className="p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Tax Collected</span>
            <span>৳{s.totalTax.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Snapshot */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Boxes className="h-4 w-4" /> Inventory Snapshot</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Cost Value</p>
              <p className="text-sm font-bold">৳{inv.costValue.toFixed(0)}</p>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-[9px] text-muted-foreground">MRP Value</p>
              <p className="text-sm font-bold text-green-600">৳{inv.mrpValue.toFixed(0)}</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Profit Potential</p>
              <p className="text-sm font-bold text-green-600">৳{inv.potentialProfit.toFixed(0)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t">
            <span>{inv.totalBatches} batches</span>
            {inv.expiredBatches > 0 && <span className="text-red-600">· {inv.expiredBatches} expired</span>}
            {inv.nearExpiryBatches > 0 && <span className="text-orange-600">· {inv.nearExpiryBatches} near expiry</span>}
          </div>
        </CardContent>
      </Card>

      {/* Financial Position */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Financial Position</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Receivables</p>
              <p className="text-base font-bold text-green-600">৳{f.receivables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">{f.receivables.count} invoices</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <p className="text-[9px] text-muted-foreground">Payables</p>
              <p className="text-base font-bold text-red-600">৳{f.payables.amount.toFixed(0)}</p>
              <p className="text-[9px] text-muted-foreground">{f.payables.count} suppliers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <div className="grid grid-cols-2 gap-2">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-base font-bold">{c.totalCustomers}</p>
            <p className="text-[9px] text-muted-foreground">Customers</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-orange-600" />
          <div>
            <p className="text-base font-bold">{c.totalSuppliers}</p>
            <p className="text-[9px] text-muted-foreground">Suppliers</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Sales vs Purchases Chart */}
      {dailyData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">Sales vs Purchases Trend</h2>
            <div className="flex items-end justify-between gap-0.5 h-24">
              {dailyData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    <div className="w-1/2 bg-green-500 rounded-t-sm" style={{ height: `${(day.sales / maxDaily) * 100}%`, minHeight: day.sales > 0 ? 4 : 2 }} />
                    <div className="w-1/2 bg-blue-500 rounded-t-sm" style={{ height: `${(day.purchases / maxDaily) * 100}%`, minHeight: day.purchases > 0 ? 4 : 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products */}
      {topProducts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-3 bg-muted/50 font-semibold text-sm">Top Products by Revenue</div>
            <div className="divide-y">
              {topProducts.slice(0, 5).map((p, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                    <div>
                      <p className="text-xs font-medium">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.quantity} units</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-green-600">৳{p.revenue.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
