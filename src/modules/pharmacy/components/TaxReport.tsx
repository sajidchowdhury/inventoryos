"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, Receipt, TrendingUp, TrendingDown,
  Percent, FileText,
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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  const { summary } = report;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">VAT / Tax Report</h1>
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

      <p className="text-xs text-muted-foreground text-center">
        {report.periodLabel}: {new Date(report.startDate).toLocaleDateString("en-GB")} — {new Date(report.endDate).toLocaleDateString("en-GB")}
      </p>

      {/* Net VAT Payable Hero */}
      <Card className={cn("border-l-4 print:border-l-4", summary.netVatPayable >= 0 ? "border-l-orange-500" : "border-l-green-500")}>
        <CardContent className="p-5 text-center">
          <p className="text-xs text-muted-foreground">{summary.isRefund ? "VAT Refund Due" : "Net VAT Payable"}</p>
          <p className={cn("text-3xl font-bold", summary.netVatPayable >= 0 ? "text-orange-600" : "text-green-600")}>
            ৳{Math.abs(summary.netVatPayable).toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Output: ৳{summary.outputTax.toFixed(2)} − Input: ৳{summary.inputTax.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Output Tax (Sales) */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-green-50 font-semibold text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-green-600" /> Output Tax (Sales)</span>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowOutputDetails(!showOutputDetails)}>
              {showOutputDetails ? "Hide" : "Show"} Details
            </Button>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Total Sales</p>
              <p className="font-bold">৳{summary.totalSales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Taxable Sales</p>
              <p className="font-bold text-green-600">৳{summary.taxableSales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Exempt/Zero-rated</p>
              <p className="font-bold">৳{summary.exemptSales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Output VAT Collected</p>
              <p className="font-bold text-orange-600">৳{summary.outputTax.toFixed(2)}</p>
            </div>
          </div>
          {showOutputDetails && report.outputTaxDetails.length > 0 && (
            <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
              {report.outputTaxDetails.map((sale, idx) => (
                <div key={idx} className="text-xs p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{sale.invoiceNo}</span>
                    <span className="font-bold text-orange-600">VAT: ৳{sale.taxAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {sale.customerName} · {new Date(sale.date).toLocaleDateString("en-GB")} · Total: ৳{sale.totalAmount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Input Tax (Purchases) */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 bg-blue-50 font-semibold text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5"><TrendingDown className="h-4 w-4 text-blue-600" /> Input Tax (Purchases)</span>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowInputDetails(!showInputDetails)}>
              {showInputDetails ? "Hide" : "Show"} Details
            </Button>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Total Purchases</p>
              <p className="font-bold">৳{summary.totalPurchases.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Taxable Purchases</p>
              <p className="font-bold text-blue-600">৳{summary.taxablePurchases.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Input VAT Paid</p>
              <p className="font-bold text-blue-600">৳{summary.inputTax.toFixed(2)}</p>
            </div>
          </div>
          {showInputDetails && report.inputTaxDetails.length > 0 && (
            <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
              {report.inputTaxDetails.map((purchase, idx) => (
                <div key={idx} className="text-xs p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{purchase.purchaseNo}</span>
                    <span className="font-bold text-blue-600">VAT: ৳{purchase.taxAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {purchase.supplierName} · {new Date(purchase.date).toLocaleDateString("en-GB")} · Total: ৳{purchase.totalAmount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* VAT by Rate */}
      {report.vatByRate.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Percent className="h-4 w-4" /> VAT by Rate
            </h2>
            <div className="space-y-2">
              {report.vatByRate.map((v) => (
                <div key={v.rate} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded-lg">
                  <div>
                    <span className="font-bold">{v.rate}%</span>
                    <span className="text-muted-foreground ml-2">({v.itemCount} items)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Taxable: ৳{v.taxableAmount.toFixed(0)}</span>
                    <span className="font-bold text-orange-600 ml-2">VAT: ৳{v.vatAmount.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
