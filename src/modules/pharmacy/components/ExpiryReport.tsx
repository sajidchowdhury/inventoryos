"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, FileText, Calendar,
  TrendingUp, AlertTriangle, Clock, CheckCircle2, ShieldAlert,
  Package, Boxes, DollarSign,
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
  expired:     { label: "Expired",            icon: AlertTriangle, color: "text-rose-700",   bg: "bg-rose-100",   border: "border-l-rose-700",   badge: "bg-rose-100 text-rose-700" },
  critical:    { label: "Critical (≤7 days)", icon: AlertTriangle, color: "text-rose-600",   bg: "bg-rose-50",    border: "border-l-rose-500",   badge: "bg-rose-50 text-rose-600" },
  warning:     { label: "Warning (≤30 days)", icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",   border: "border-l-amber-500",  badge: "bg-amber-50 text-amber-700" },
  notice:      { label: "Notice (≤90 days)",  icon: Clock,         color: "text-yellow-600", bg: "bg-yellow-50",  border: "border-l-yellow-500", badge: "bg-yellow-50 text-yellow-700" },
  safe:        { label: "Safe (>90 days)",    icon: CheckCircle2,  color: "text-emerald-600",bg: "bg-emerald-50", border: "border-l-emerald-500",badge: "bg-emerald-50 text-emerald-700" },
  quarantined: { label: "Quarantined",        icon: ShieldAlert,   color: "text-purple-600", bg: "bg-purple-50",  border: "border-l-purple-500", badge: "bg-purple-50 text-purple-700" },
};

// Summary card config (4-card grid with colored icons)
const summaryCards = [
  { key: "batches", label: "Total Batches", icon: Package,   gradient: "bg-gradient-to-br from-blue-400 to-blue-600",     border: "border-l-blue-500",     valueKey: "totalBatches",     color: "text-blue-700" },
  { key: "units",   label: "Total Units",   icon: Boxes,     gradient: "bg-gradient-to-br from-emerald-400 to-emerald-600",border: "border-l-emerald-500",  valueKey: "totalUnits",       color: "text-emerald-700" },
  { key: "atrisk",  label: "Units at Risk", icon: AlertTriangle, gradient: "bg-gradient-to-br from-rose-400 to-rose-600", border: "border-l-rose-500",   valueKey: "totalUnitsAtRisk", color: "text-rose-700" },
  { key: "value",   label: "Value at Risk", icon: DollarSign, gradient: "bg-gradient-to-br from-amber-400 to-amber-600", border: "border-l-amber-500",   valueKey: "totalValueAtRisk", color: "text-amber-700" },
] as const;

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
    <motion.div {...fadeIn} className="pharmacy-bg min-h-[80vh] space-y-4 p-4 rounded-xl pb-4">
      {/* Header — hidden on print */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0 hover:bg-emerald-50" onClick={() => setActiveView("alerts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Expiry Report</h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block">Printable summary of all expiry-risk batches</p>
        </div>
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
        <Button
          variant="outline"
          size="icon"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          onClick={handleDownloadCSV}
          title="Download CSV"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border-0 shadow-sm"
          onClick={handlePrint}
          title="Print report"
        >
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          <Card className="shadow-pharmacy">
            <CardContent className="p-6 space-y-3">
              <div className="skeleton h-6 w-1/3 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-2/5 rounded" />
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="shadow-pharmacy">
                <CardContent className="p-4 space-y-2">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="skeleton h-5 w-16 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {report && (
        <>
          {/* Report Header — gradient emerald card */}
          <Card className="shadow-pharmacy overflow-hidden border-0 print:shadow-none">
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white print:bg-emerald-700">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <FileText className="h-4 w-4" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">{report.business.name}</h2>
                  </div>
                  <p className="text-xs text-emerald-50/90 capitalize">{report.business.type}</p>
                  {report.business.address && (
                    <p className="text-xs text-emerald-50/80 mt-0.5">{report.business.address}</p>
                  )}
                  {report.business.phone && (
                    <p className="text-xs text-emerald-50/80">Phone: {report.business.phone}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-[10px] font-semibold capitalize backdrop-blur-sm">
                    <Calendar className="h-3 w-3" /> {report.period} Report
                  </span>
                  <p className="text-[10px] text-emerald-50/80 mt-1.5">
                    Generated: {new Date(report.generatedAt).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Summary Cards — 4-card grid with colored icons and borders */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const value = report.summary[card.valueKey as keyof typeof report.summary];
              const display = card.valueKey === "totalValueAtRisk"
                ? `৳${Number(value).toFixed(0)}`
                : String(value);
              return (
                <Card
                  key={card.key}
                  className={cn(
                    "stagger-in card-hover shadow-pharmacy border-l-4 print:break-inside-avoid",
                    card.border
                  )}
                >
                  <CardContent className="p-4">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shadow-sm mb-2", card.gradient)}>
                      <Icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <p className={cn("text-xl font-bold leading-tight", card.color)}>{display}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{card.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Section Breakdown Badges */}
          <Card className="shadow-pharmacy stagger-in print:break-inside-avoid">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Status Breakdown</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.summary.sections).map(([key, count]) => {
                  const cfg = sectionConfig[key as keyof typeof sectionConfig];
                  return (
                    <Badge
                      key={key}
                      variant="outline"
                      className={cn("text-[10px] font-medium px-2 py-1", cfg.badge)}
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
              <div key={sectionKey} className="space-y-2 stagger-in print:break-inside-avoid">
                <div className="flex items-center gap-2 px-1">
                  <Icon className={cn("h-4 w-4", cfg.color)} />
                  <h3 className="text-sm font-semibold">{cfg.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{batches.length}</Badge>
                </div>

                <Card className={cn("shadow-pharmacy border-l-4 overflow-hidden", cfg.border)}>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-2.5 font-semibold text-muted-foreground">Product</th>
                            <th className="text-left p-2.5 font-semibold text-muted-foreground">Batch #</th>
                            <th className="text-left p-2.5 font-semibold text-muted-foreground">Expiry</th>
                            <th className="text-right p-2.5 font-semibold text-muted-foreground">Qty</th>
                            <th className="text-right p-2.5 font-semibold text-muted-foreground hidden sm:table-cell">MRP</th>
                            <th className="text-right p-2.5 font-semibold text-muted-foreground">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batches.map((batch, idx) => (
                            <tr
                              key={idx}
                              className={cn(
                                "border-t border-muted/40 transition-colors hover:bg-muted/20",
                                idx % 2 === 1 && "bg-muted/10"
                              )}
                            >
                              <td className="p-2.5">
                                <p className="font-medium">{batch.productName}</p>
                                {batch.genericName && (
                                  <p className="text-[10px] text-muted-foreground">{batch.genericName}</p>
                                )}
                                {batch.manufacturer && (
                                  <p className="text-[9px] text-muted-foreground">{batch.manufacturer}</p>
                                )}
                              </td>
                              <td className="p-2.5 whitespace-nowrap font-mono text-[11px]">{batch.batchNo}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <p className="font-medium">{new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                                <Badge variant="outline" className={cn("text-[9px] px-1 py-0 mt-0.5 font-medium", cfg.badge)}>
                                  {batch.daysUntilExpiry < 0
                                    ? `${Math.abs(batch.daysUntilExpiry)}d ago`
                                    : `${batch.daysUntilExpiry}d left`}
                                </Badge>
                              </td>
                              <td className="p-2.5 text-right whitespace-nowrap font-medium">{batch.quantity} {batch.unit}</td>
                              <td className="p-2.5 text-right whitespace-nowrap hidden sm:table-cell">৳{batch.mrp || "—"}</td>
                              <td className="p-2.5 text-right font-bold whitespace-nowrap">৳{batch.value.toFixed(0)}</td>
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
