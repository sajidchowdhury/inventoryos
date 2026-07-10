"use client";

// ── Phase5OpsCard ──
// Phase 5: Operations health dashboard for the founder.
//
// Surfaces the weekly + monthly + quarterly metrics from the AI Features Report
// Section 7.5 (Table 7.5) so the founder doesn't have to manually query the DB.
//
// Sections:
//   - Health status banner (healthy / watch / action_needed)
//   - Weekly review checklist
//   - Monthly comparison (actual vs estimated cost per feature)
//   - Tier mix (subscriber count by tier)
//   - Quarterly reminders

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Loader2, RefreshCw, CalendarClock, Users, DollarSign, Zap,
  ShieldCheck, AlertCircle, ArrowRight,
} from "lucide-react";

interface TopSpender {
  businessId: string;
  businessName: string;
  tier: string;
  cost: number;
  tokens: number;
  calls: number;
}

interface MonthlyFeature {
  feature: string;
  calls: number;
  tokensUsed: number;
  actualCost: number;
  estimatedCost: number;
  varianceRatio: number;
  status: "ok" | "watch" | "investigate";
}

interface OpsHealthData {
  success: boolean;
  generatedAt: string;
  healthStatus: "healthy" | "watch" | "action_needed";
  healthIssues: string[];
  weeklyReview: {
    thisWeekCost: number;
    lastWeekCost: number;
    costGrowthRate: number;
    thisWeekCalls: number;
    lastWeekCalls: number;
    todayCost: number;
    todayCalls: number;
    yesterdayCost: number;
    topSpenders: TopSpender[];
    thisWeekErrors: number;
    thisWeekErrorRate: number;
    thisWeekKillSwitchTriggers: number;
    thisWeekCircuitOpen: number;
    sentryErrorCount: number | null;
  };
  monthlyComparison: {
    lastMonthStart: string;
    lastMonthEnd: string;
    thisMonthCostSoFar: number;
    features: MonthlyFeature[];
  };
  tierMix: Array<{ tier: string; count: number }>;
  quarterlyReminders: {
    zaiPricingReeval: boolean;
    reportRerun: boolean;
    lastZaiCostPer1K: number;
    daysIntoQuarter: number;
  };
  activeKillSwitchCount: number;
}

const HEALTH_META = {
  healthy: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-900",
    label: "Healthy",
  },
  watch: {
    icon: AlertCircle,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-900",
    label: "Watch",
  },
  action_needed: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-900",
    label: "Action Needed",
  },
};

const STATUS_META = {
  ok: { color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/30", label: "OK" },
  watch: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950/30", label: "Watch" },
  investigate: { color: "text-red-600", bg: "bg-red-100 dark:bg-red-950/30", label: "Investigate" },
};

function formatBDT(v: number): string {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export function Phase5OpsCard({ token }: { token: string }) {
  const [data, setData] = useState<OpsHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ops-health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <Activity className="h-5 w-5" />
          Phase 5: Operations Health
        </CardTitle>
        <CardDescription>
          Weekly + monthly + quarterly AI cost monitoring. Check this every Monday
          and on the 1st of each month. Click Help for the full checklist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            {/* ── Health status banner ── */}
            {(() => {
              const meta = HEALTH_META[data.healthStatus];
              const Icon = meta.icon;
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-lg border-2 ${meta.border} ${meta.bg} p-4`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className={`h-6 w-6 ${meta.color}`} />
                    <span className="font-bold text-lg">
                      Status: {meta.label}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void load()}
                      className="ml-auto"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {data.healthIssues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full ${meta.color} bg-current shrink-0`} />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })()}

            {/* ── Weekly review metrics ── */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-purple-600" />
                Weekly Review (check every Monday)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="This Week Cost"
                  value={`৳${formatBDT(data.weeklyReview.thisWeekCost)}`}
                  sub={`Last week: ৳${formatBDT(data.weeklyReview.lastWeekCost)}`}
                  icon={DollarSign}
                  trend={data.weeklyReview.costGrowthRate}
                />
                <MetricCard
                  label="This Week Calls"
                  value={data.weeklyReview.thisWeekCalls.toLocaleString()}
                  sub={`Last week: ${data.weeklyReview.lastWeekCalls.toLocaleString()}`}
                  icon={Zap}
                />
                <MetricCard
                  label="Today Cost"
                  value={`৳${formatBDT(data.weeklyReview.todayCost)}`}
                  sub={`Yesterday: ৳${formatBDT(data.weeklyReview.yesterdayCost)}`}
                  icon={DollarSign}
                />
                <MetricCard
                  label="Error Rate"
                  value={`${data.weeklyReview.thisWeekErrorRate.toFixed(1)}%`}
                  sub={`${data.weeklyReview.thisWeekErrors} errors / ${data.weeklyReview.thisWeekCalls} calls`}
                  icon={data.weeklyReview.thisWeekErrorRate > 5 ? AlertTriangle : ShieldCheck}
                  danger={data.weeklyReview.thisWeekErrorRate > 5}
                />
              </div>

              {/* Top spenders */}
              {data.weeklyReview.topSpenders.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Top 5 Spenders This Week</div>
                  <div className="space-y-1">
                    {data.weeklyReview.topSpenders.map((s, i) => {
                      const pct = data.weeklyReview.thisWeekCost > 0
                        ? (s.cost / data.weeklyReview.thisWeekCost) * 100
                        : 0;
                      return (
                        <div
                          key={s.businessId}
                          className="flex items-center gap-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 p-2"
                        >
                          <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center font-bold text-purple-600">
                            {i + 1}
                          </span>
                          <span className="flex-1 font-medium truncate">{s.businessName}</span>
                          <Badge variant="outline" className="text-xs">{s.tier}</Badge>
                          <span className="font-mono">৳{formatBDT(s.cost)}</span>
                          <span className="text-muted-foreground">{s.calls} calls</span>
                          {pct > 30 && (
                            <Badge variant="destructive" className="text-xs">
                              {pct.toFixed(0)}% of total
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alerts row */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-900 p-2">
                  <ShieldCheck className={`h-4 w-4 ${data.weeklyReview.thisWeekKillSwitchTriggers > 0 ? "text-red-600" : "text-emerald-600"}`} />
                  <span>Kill-switch triggers this week: <strong>{data.weeklyReview.thisWeekKillSwitchTriggers}</strong></span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-900 p-2">
                  <Activity className={`h-4 w-4 ${data.weeklyReview.thisWeekCircuitOpen > 0 ? "text-amber-600" : "text-emerald-600"}`} />
                  <span>Circuit breaker trips: <strong>{data.weeklyReview.thisWeekCircuitOpen}</strong></span>
                </div>
              </div>
            </div>

            {/* ── Monthly comparison ── */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Monthly Comparison (check on the 1st)
              </h4>
              <div className="text-xs text-muted-foreground mb-2">
                Last month: {new Date(data.monthlyComparison.lastMonthStart).toLocaleDateString()} →{" "}
                {new Date(data.monthlyComparison.lastMonthEnd).toLocaleDateString()}
                {" · "}
                This month so far: ৳{formatBDT(data.monthlyComparison.thisMonthCostSoFar)}
              </div>
              {data.monthlyComparison.features.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                  No AI usage last month. (This is expected for a new deployment.)
                </div>
              ) : (
                <div className="space-y-1">
                  {data.monthlyComparison.features.map((f) => {
                    const status = STATUS_META[f.status];
                    return (
                      <div
                        key={f.feature}
                        className="flex items-center gap-2 text-xs rounded-md border border-slate-200 dark:border-slate-800 p-2"
                      >
                        <span className="flex-1 font-medium">{f.feature}</span>
                        <span className="text-muted-foreground">{f.calls} calls</span>
                        <span className="font-mono">Actual: ৳{formatBDT(f.actualCost)}</span>
                        <span className="text-muted-foreground font-mono">Est: ৳{formatBDT(f.estimatedCost)}</span>
                        <span className={`font-mono ${f.varianceRatio > 2 ? "text-red-600 font-bold" : f.varianceRatio > 1.5 ? "text-amber-600" : "text-emerald-600"}`}>
                          {f.varianceRatio.toFixed(1)}x
                        </span>
                        <Badge className={`text-xs ${status.bg} ${status.color}`} variant="secondary">
                          {status.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 text-xs text-muted-foreground">
                Variance ratio = actual cost ÷ estimated cost.{" "}
                <strong className="text-amber-600">&gt;1.5x = Watch</strong>,{" "}
                <strong className="text-red-600">&gt;2x = Investigate</strong> (pause scaling and find the cause).
              </div>
            </div>

            {/* ── Tier mix ── */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                Subscription Tier Mix
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {data.tierMix.map((t) => {
                  const total = data.tierMix.reduce((sum, x) => sum + x.count, 0);
                  const pct = total > 0 ? (t.count / total) * 100 : 0;
                  return (
                    <div key={t.tier} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-center">
                      <div className="text-2xl font-bold">{t.count}</div>
                      <div className="text-xs text-muted-foreground capitalize">{t.tier}</div>
                      <div className="text-xs text-muted-foreground">{pct.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const proAiCount = data.tierMix.find((t) => t.tier === "pro_ai")?.count ?? 0;
                const total = data.tierMix.reduce((sum, x) => sum + x.count, 0);
                const proAiPct = total > 0 ? (proAiCount / total) * 100 : 0;
                if (proAiPct < 10 && total > 5) {
                  return (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Pro+AI is only {proAiPct.toFixed(0)}% of subscribers. Consider marketing push or pricing adjustment.
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* ── Quarterly reminders ── */}
            {data.quarterlyReminders.zaiPricingReeval && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3"
              >
                <div className="flex items-start gap-2">
                  <CalendarClock className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <strong className="text-blue-700 dark:text-blue-400">Quarterly reminder ({data.quarterlyReminders.daysIntoQuarter} days into quarter):</strong>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1">
                        <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
                        Re-evaluate Z.ai pricing — current rate: ৳{data.quarterlyReminders.lastZaiCostPer1K} per 1K tokens. Confirm still cheapest option.
                      </li>
                      <li className="flex items-start gap-1">
                        <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
                        Re-run the AI Features Report analysis — check if any new red flags emerged.
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="text-xs text-muted-foreground border-t pt-2">
              Last updated: {new Date(data.generatedAt).toLocaleString()}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label, value, sub, icon: Icon, trend, danger,
}: {
  label: string;
  value: string;
  sub: string;
  icon: any;
  trend?: number;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${danger ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10" : "border-slate-200 dark:border-slate-800"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${danger ? "text-red-600" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-lg font-bold ${danger ? "text-red-600" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
        {trend !== undefined && trend !== 0 && (
          trend > 0 ? (
            <TrendingUp className={`h-3 w-3 ${trend > 100 ? "text-red-600" : "text-amber-600"}`} />
          ) : (
            <TrendingDown className="h-3 w-3 text-emerald-600" />
          )
        )}
        {sub}
      </div>
    </div>
  );
}
