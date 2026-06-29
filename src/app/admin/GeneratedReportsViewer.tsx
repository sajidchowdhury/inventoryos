"use client";

// ── GeneratedReportsViewer ──
// Phase B: View generated AI reports in /admin.
//
// Shows a filterable list of generated reports. Click a report to see the
// full content (executive summary, spike predictions, top 20 items, stock risks).

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Loader2, RefreshCw, ChevronRight, ArrowLeft,
  AlertTriangle, TrendingUp, Package, CheckCircle2, Sparkles,
} from "lucide-react";

interface ReportListItem {
  id: string;
  reportDate: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  generationStatus: string;
  aiTokensUsed: number;
  aiCostEstimate: number;
  predictionConfidence: string;
  business: { name: string; subscriptionTier: string };
  schedule: { name: string };
}

interface ReportDetail {
  id: string;
  reportDate: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  generationStatus: string;
  executiveSummary: string;
  spikePredictions: any[];
  topItems: any[];
  stockRisks: any[];
  appliedInfluences: any;
  aiTokensUsed: number;
  aiCostEstimate: number;
  predictionConfidence: string;
  errorMessage: string | null;
  business: { name: string };
  schedule: { name: string; frequency: string };
  deliveries: any[];
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-gray-100 text-gray-700", label: "Pending" },
  generating: { color: "bg-blue-100 text-blue-700", label: "Generating" },
  completed: { color: "bg-emerald-100 text-emerald-700", label: "Completed" },
  failed: { color: "bg-red-100 text-red-700", label: "Failed" },
};

const CONFIDENCE_META: Record<string, { color: string; label: string }> = {
  high: { color: "text-emerald-600", label: "High" },
  medium: { color: "text-amber-600", label: "Medium" },
  low: { color: "text-red-600", label: "Low" },
};

export function GeneratedReportsViewer({ token }: { token: string }) {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/report-scheduling/generated-reports?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const loadDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/super-admin/report-scheduling/generated-reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSelectedReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Detail View ──
  if (selectedReport) {
    const conf = CONFIDENCE_META[selectedReport.predictionConfidence] || CONFIDENCE_META.medium;
    return (
      <Card className="border-purple-200 dark:border-purple-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <FileText className="h-5 w-5" />
                Report Detail
              </CardTitle>
              <CardDescription className="mt-1">
                {selectedReport.business.name} · {selectedReport.schedule.name}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Period + meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="outline">
              {new Date(selectedReport.reportPeriodStart).toLocaleDateString()} → {new Date(selectedReport.reportPeriodEnd).toLocaleDateString()}
            </Badge>
            <Badge className={conf.color}>{conf.label} confidence</Badge>
            <Badge variant="secondary">{selectedReport.aiTokensUsed} tokens</Badge>
            <Badge variant="secondary">৳{selectedReport.aiCostEstimate.toFixed(2)}</Badge>
            {selectedReport.appliedInfluences?.seasons?.length > 0 && (
              <Badge className="bg-blue-100 text-blue-700">Seasons: {selectedReport.appliedInfluences.seasons.join(", ")}</Badge>
            )}
            {selectedReport.appliedInfluences?.occasions?.length > 0 && (
              <Badge className="bg-purple-100 text-purple-700">Occasions: {selectedReport.appliedInfluences.occasions.join(", ")}</Badge>
            )}
            {selectedReport.appliedInfluences?.epidemics?.length > 0 && (
              <Badge className="bg-red-100 text-red-700">Epidemics: {selectedReport.appliedInfluences.epidemics.join(", ")}</Badge>
            )}
          </div>

          {/* Executive Summary */}
          <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/10 p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" /> Executive Summary
            </h4>
            <p className="text-sm">{selectedReport.executiveSummary || "No summary generated."}</p>
          </div>

          {/* Spike Predictions */}
          {selectedReport.spikePredictions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" /> Big Sales Spike Predictions
              </h4>
              <div className="space-y-2">
                {selectedReport.spikePredictions.map((s: any, i: number) => (
                  <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{i + 1}. {s.product}</span>
                      <Badge className="bg-orange-100 text-orange-700">+{s.spikePercent}%</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Occasion: {s.occasion}
                      {s.season && ` · Season: ${s.season}`}
                      {s.epidemic && ` · Epidemic: ${s.epidemic}`}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">{s.historicalBasis}</div>
                    <div className="text-sm font-medium text-emerald-700">{s.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 20 Items */}
          {selectedReport.topItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" /> Top 20 High-Potential Items
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Product</th>
                      <th className="text-right p-2">Pred. Qty</th>
                      <th className="text-right p-2">Pred. Profit</th>
                      <th className="text-right p-2">Stock</th>
                      <th className="text-center p-2">Status</th>
                      <th className="text-left p-2">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.topItems.map((item: any, i: number) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2 font-medium">{item.product}</td>
                        <td className="p-2 text-right">{item.predictedQty}</td>
                        <td className="p-2 text-right">৳{item.predictedProfit?.toLocaleString()}</td>
                        <td className="p-2 text-right">{item.currentStock}</td>
                        <td className="p-2 text-center">
                          {item.stockStatus === "good" && <Badge className="bg-emerald-100 text-emerald-700">Good</Badge>}
                          {item.stockStatus === "low" && <Badge className="bg-amber-100 text-amber-700">Low</Badge>}
                          {item.stockStatus === "order_now" && <Badge className="bg-red-100 text-red-700">Order Now</Badge>}
                          {item.stockStatus === "out" && <Badge className="bg-red-100 text-red-700">Out</Badge>}
                        </td>
                        <td className="p-2 text-muted-foreground">{item.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stock Risks */}
          {selectedReport.stockRisks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" /> Stock Risks & Recommendations
              </h4>
              <div className="space-y-1">
                {selectedReport.stockRisks.map((r: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between rounded-md border p-2 text-xs ${
                    r.urgency === "critical" ? "border-red-300 bg-red-50/50 dark:bg-red-950/10" :
                    r.urgency === "high" ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/10" :
                    "border-slate-200 dark:border-slate-800"
                  }`}>
                    <span className="flex-1 font-medium">{r.product}</span>
                    <span className="text-muted-foreground">
                      {r.daysUntilStockout !== null ? `Stocks out in ${r.daysUntilStockout}d` : "Already out"}
                    </span>
                    <span className="ml-3">Order: {r.recommendedPurchaseQty}</span>
                    <span className="ml-3 text-muted-foreground">{r.supplier}</span>
                    <Badge className={`ml-3 ${
                      r.urgency === "critical" ? "bg-red-100 text-red-700" :
                      r.urgency === "high" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{r.urgency.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliveries */}
          {selectedReport.deliveries.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Delivery Status</h4>
              <div className="flex flex-wrap gap-2">
                {selectedReport.deliveries.map((d: any) => (
                  <Badge key={d.id} variant="outline" className="text-xs">
                    {d.channel}: {d.status}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── List View ──
  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <FileText className="h-5 w-5" />
              Generated Reports
            </CardTitle>
            <CardDescription>
              AI-generated weekly prediction reports. Click a report to view full content.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300 mb-3">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No reports generated yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a schedule and trigger it to generate reports.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {reports.map((r) => {
              const status = STATUS_META[r.generationStatus] || STATUS_META.pending;
              const conf = CONFIDENCE_META[r.predictionConfidence] || CONFIDENCE_META.medium;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                  onClick={() => loadDetail(r.id)}
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.business.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.schedule.name} · {new Date(r.reportPeriodStart).toLocaleDateString()} → {new Date(r.reportPeriodEnd).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={status.color}>{status.label}</Badge>
                    <span className={`text-xs ${conf.color}`}>{conf.label}</span>
                    <span className="text-xs text-muted-foreground">৳{r.aiCostEstimate.toFixed(2)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
