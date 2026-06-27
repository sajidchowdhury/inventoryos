"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, FileText, Calendar,
  TrendingUp, AlertTriangle, Clock, CheckCircle2, ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface ReportData {
  generatedAt: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  business: {
    name: string;
    address: string | null;
    phone: string | null;
    type: string;
  };
  preferences: {
    expiryCriticalDays: number;
    expiryWarningDays: number;
    expiryNoticeDays: number;
  };
  summary: {
    totalBatches: number;
    totalUnits: number;
    totalUnitsAtRisk: number;
    totalValueAtRisk: number;
    sections: {
      expired: number;
      critical: number;
      warning: number;
      notice: number;
      safe: number;
      quarantined: number;
    };
  };
  sections: {
    expired: BatchRow[];
    critical: BatchRow[];
    warning: BatchRow[];
    notice: BatchRow[];
    safe: BatchRow[];
    quarantined: BatchRow[];
  };
}

interface BatchRow {
  batchNo: string;
  productName: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  category: string | null;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
  unit: string;
  mrp: number | null;
  value: number;
  scheduleType: string | null;
  isPrescription: boolean;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const sectionConfig = {
  expired: { label: "Expired", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50", border: "border-l-red-700" },
  critical: { label: "Critical (≤7 days)", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-l-red-500" },
  warning: { label: "Warning (≤30 days)", icon: Clock, color: "text-orange-600", bg: "bg-orange-50", border: "border-l-orange-500" },
  notice: { label: "Notice (≤90 days)", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-l-yellow-500" },
  safe: { label: "Safe (>90 days)", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-l-green-500" },
  quarantined: { label: "Quarantined", icon: ShieldAlert, color: "text-purple-600", bg: "bg-purple-50", border: "border-l-purple-500" },
};

export function ExpiryReport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("daily");

  const fetchReport = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/reports/expiry?period=${period}`);
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err) {
      console.error("Report fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleDownloadCSV = () => {
    if (!businessId) return;
    window.open(`/api/businesses/${businessId}/reports/expiry?period=${period}&format=csv`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header — hidden on print */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("alerts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Expiry Report</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleDownloadCSV}>
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      )}

      {report && (
        <>
          {/* Report Header */}
          <Card className="print:border-0 print:shadow-none">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{report.business.name}</h2>
                  <p className="text-sm text-muted-foreground">{report.business.type}</p>
                  {report.business.address && (
                    <p className="text-xs text-muted-foreground">{report.business.address}</p>
                  )}
                  {report.business.phone && (
                    <p className="text-xs text-muted-foreground">Phone: {report.business.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="capitalize">{report.period} Report</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Generated: {new Date(report.generatedAt).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className={cn(
            "border-l-4 print:border-l-4",
            report.summary.totalValueAtRisk > 0 ? "border-l-red-500" : "border-l-green-500"
          )}>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Summary</h3>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Batches</p>
                  <p className="text-lg font-bold">{report.summary.totalBatches}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Total Units</p>
                  <p className="text-lg font-bold">{report.summary.totalUnits}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Units at Risk</p>
                  <p className="text-lg font-bold text-red-600">{report.summary.totalUnitsAtRisk}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Value at Risk</p>
                  <p className="text-lg font-bold text-red-600">৳{report.summary.totalValueAtRisk.toFixed(0)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                {Object.entries(report.summary.sections).map(([key, count]) => {
                  const cfg = sectionConfig[key as keyof typeof sectionConfig];
                  return (
                    <Badge
                      key={key}
                      variant="outline"
                      className={cn("text-[10px]", cfg.color)}
                    >
                      {cfg.label}: {count}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          {Object.entries(report.sections).map(([sectionKey, batches]) => {
            if (batches.length === 0) return null;
            const cfg = sectionConfig[sectionKey as keyof typeof sectionConfig];
            const Icon = cfg.icon;
            return (
              <div key={sectionKey} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Icon className={cn("h-4 w-4", cfg.color)} />
                  <h3 className="text-sm font-semibold">{cfg.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{batches.length}</Badge>
                </div>

                <Card className={cn("border-l-4", cfg.border)}>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium">Product</th>
                            <th className="text-left p-2 font-medium">Batch #</th>
                            <th className="text-left p-2 font-medium">Expiry</th>
                            <th className="text-right p-2 font-medium">Qty</th>
                            <th className="text-right p-2 font-medium">MRP</th>
                            <th className="text-right p-2 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batches.map((batch, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">
                                <p className="font-medium">{batch.productName}</p>
                                {batch.genericName && (
                                  <p className="text-[10px] text-muted-foreground">{batch.genericName}</p>
                                )}
                                {batch.manufacturer && (
                                  <p className="text-[9px] text-muted-foreground">{batch.manufacturer}</p>
                                )}
                              </td>
                              <td className="p-2 whitespace-nowrap">{batch.batchNo}</td>
                              <td className="p-2 whitespace-nowrap">
                                <p>{new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                                <p className={cn("text-[9px]", cfg.color)}>
                                  {batch.daysUntilExpiry < 0
                                    ? `${Math.abs(batch.daysUntilExpiry)}d ago`
                                    : `${batch.daysUntilExpiry}d left`}
                                </p>
                              </td>
                              <td className="p-2 text-right whitespace-nowrap">{batch.quantity} {batch.unit}</td>
                              <td className="p-2 text-right whitespace-nowrap">৳{batch.mrp || "—"}</td>
                              <td className="p-2 text-right font-semibold whitespace-nowrap">৳{batch.value.toFixed(0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}

          {/* Footer */}
          <div className="text-center text-[10px] text-muted-foreground pt-4 print:pt-8">
            <p>Generated by InventoryOS — {new Date(report.generatedAt).toLocaleString("en-GB")}</p>
            <p className="mt-1">This report covers batches with stock on hand. Disposed/destroyed batches are excluded.</p>
          </div>
        </>
      )}
    </motion.div>
  );
}
