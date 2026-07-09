"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, Receipt, TrendingUp, TrendingDown,
  Percent, FileText, ArrowUpRight, ArrowDownRight, Coins,
  Wallet, Calculator,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface TaxReport {
  period: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  summary: {
    totalSales: number; taxableSales: number; exemptSales: number; outputTax: number; salesCount: number;
    totalPurchases: number; taxablePurchases: number; inputTax: number; purchaseCount: number;
    netVatPayable: number; isRefund: boolean;
  };
  vatByRate: Array<{ rate: number; taxableAmount: number; vatAmount: number; itemCount: number }>;
  outputTaxDetails: Array<{
    invoiceNo: string; customerName: string; date: string;
    subtotal: number; taxAmount: number; totalAmount: number;
    items: Array<{ productName: string; quantity: number; unitPrice: number; taxableAmount: string; vatRate: number; vatAmount: string; hsnCode: string | null }>;
  }>;
  inputTaxDetails: Array<{
    purchaseNo: string; supplierName: string; date: string;
    subtotal: number; taxAmount: number; totalAmount: number;
  }>;
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

export function TaxReport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [showOutputDetails, setShowOutputDetails] = useState(false);
  const [showInputDetails, setShowInputDetails] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/reports/tax?period=${period}`);
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err) {
      console.error("Tax report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleDownload = () => {
    if (businessId) window.open(`/api/businesses/${businessId}/reports/tax?period=${period}&format=csv`, "_blank");
  };

  if (loading || !report) {
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
        <SkeletonCard className="h-40" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
      </motion.div>
    );
  }

  const { summary } = report;

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">VAT / Tax Report</h1>
          <p className="text-[11px] text-muted-foreground">Bangladesh VAT compliance</p>
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

      <p className="text-xs text-muted-foreground text-center">
        {report.periodLabel}: {new Date(report.startDate).toLocaleDateString("en-GB")} — {new Date(report.endDate).toLocaleDateString("en-GB")}
      </p>

      {/* Summary cards - 4 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-emerald-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Total Sales</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">৳{summary.totalSales.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{summary.salesCount} invoices</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                <Receipt className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-blue-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">VAT Collected</p>
                <p className="text-xl font-bold text-blue-600 mt-1">৳{summary.outputTax.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Output tax (sales)</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <Coins className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-amber-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">VAT Payable</p>
                <p className="text-xl font-bold text-amber-600 mt-1">৳{Math.abs(summary.netVatPayable).toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{summary.isRefund ? "Refund due" : "Net payable"}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                <Calculator className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-purple-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Net Sales</p>
                <p className="text-xl font-bold text-purple-600 mt-1">৳{summary.taxableSales.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Taxable amount</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
                <Wallet className="h-4 w-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net VAT Payable Hero */}
      <Card className={cn(
        "shadow-pharmacy-xl border-0 overflow-hidden stagger-in",
        summary.netVatPayable >= 0
          ? "bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600"
          : "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700"
      )}>
        <CardContent className="p-6 text-white text-center relative">
          <div className="absolute top-0 right-0 h-32 w-32 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[10px] font-bold uppercase tracking-wider">
              <Percent className="h-3 w-3" />
              {summary.isRefund ? "VAT Refund Due" : "Net VAT Payable"}
            </div>
            <p className="text-4xl font-bold mt-3 tracking-tight">৳{Math.abs(summary.netVatPayable).toFixed(2)}</p>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
                <ArrowUpRight className="h-3 w-3" /> Output: ৳{summary.outputTax.toFixed(2)}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
                <ArrowDownRight className="h-3 w-3" /> Input: ৳{summary.inputTax.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Output Tax */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-emerald-700">Output Tax (Sales)</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowOutputDetails(!showOutputDetails)}>
              {showOutputDetails ? "Hide" : "Show"} Details
            </Button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-muted/30 rounded-lg">
              <p className="text-[10px] text-muted-foreground">Total Sales</p>
              <p className="font-bold text-sm mt-0.5">৳{summary.totalSales.toFixed(2)}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <p className="text-[10px] text-muted-foreground">Taxable Sales</p>
              <p className="font-bold text-sm text-emerald-600 mt-0.5">৳{summary.taxableSales.toFixed(2)}</p>
            </div>
            <div className="p-2.5 bg-muted/30 rounded-lg">
              <p className="text-[10px] text-muted-foreground">Exempt/Zero-rated</p>
              <p className="font-bold text-sm mt-0.5">৳{summary.exemptSales.toFixed(2)}</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-lg">
              <p className="text-[10px] text-muted-foreground">Output VAT Collected</p>
              <p className="font-bold text-sm text-amber-600 mt-0.5">৳{summary.outputTax.toFixed(2)}</p>
            </div>
          </div>
          {showOutputDetails && report.outputTaxDetails.length > 0 && (
            <div className="p-3 space-y-2 max-h-60 overflow-y-auto scrollbar-thin border-t bg-muted/20">
              {report.outputTaxDetails.map((sale, idx) => (
                <div key={idx} className="text-xs p-2.5 bg-background rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{sale.invoiceNo}</span>
                    <span className="font-bold text-amber-600">VAT: ৳{sale.taxAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {sale.customerName} · {new Date(sale.date).toLocaleDateString("en-GB")} · Total: ৳{sale.totalAmount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input Tax */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="p-3.5 bg-gradient-to-r from-blue-50 to-sky-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-blue-700">Input Tax (Purchases)</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowInputDetails(!showInputDetails)}>
              {showInputDetails ? "Hide" : "Show"} Details
            </Button>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-muted/30 rounded-lg">
              <p className="text-[10px] text-muted-foreground">Total Purchases</p>
              <p className="font-bold text-sm mt-0.5">৳{summary.totalPurchases.toFixed(2)}</p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <p className="text-[10px] text-muted-foreground">Taxable Purchases</p>
              <p className="font-bold text-sm text-blue-600 mt-0.5">৳{summary.taxablePurchases.toFixed(2)}</p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-lg col-span-2">
              <p className="text-[10px] text-muted-foreground">Input VAT Paid</p>
              <p className="font-bold text-sm text-blue-600 mt-0.5">৳{summary.inputTax.toFixed(2)}</p>
            </div>
          </div>
          {showInputDetails && report.inputTaxDetails.length > 0 && (
            <div className="p-3 space-y-2 max-h-60 overflow-y-auto scrollbar-thin border-t bg-muted/20">
              {report.inputTaxDetails.map((purchase, idx) => (
                <div key={idx} className="text-xs p-2.5 bg-background rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{purchase.purchaseNo}</span>
                    <span className="font-bold text-blue-600">VAT: ৳{purchase.taxAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {purchase.supplierName} · {new Date(purchase.date).toLocaleDateString("en-GB")} · Total: ৳{purchase.totalAmount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* VAT by Rate - alternating rows */}
      {report.vatByRate.length > 0 && (
        <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
          <CardContent className="p-0">
            <div className="p-3.5 bg-gradient-to-r from-purple-50 to-fuchsia-50 border-b flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                <Percent className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-bold text-purple-700">VAT by Rate</p>
            </div>
            <div className="divide-y">
              {report.vatByRate.map((v, idx) => (
                <div key={v.rate} className={cn(
                  "flex items-center justify-between text-xs p-3.5",
                  idx % 2 === 0 ? "bg-muted/20" : "bg-background"
                )}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-bold text-purple-700 border-purple-200 bg-purple-50">{v.rate}%</Badge>
                    <span className="text-muted-foreground">({v.itemCount} items)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground text-[10px]">Taxable: ৳{v.taxableAmount.toFixed(0)}</span>
                    <span className="font-bold text-amber-600 ml-2">VAT: ৳{v.vatAmount.toFixed(0)}</span>
                  </div>
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
