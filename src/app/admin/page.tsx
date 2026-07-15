"use client";

// /admin/page.tsx — Command Center
// Soft, eye-soothing dashboard optimized for long admin sessions.
// 3 sections: System Health → Revenue & Metrics → Quick Actions.
// Uses the warm-neutral CSS variable tokens (no hardcoded slate-950/black).

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Building2, DollarSign, Users, ShieldCheck, AlertTriangle,
  Database, Clock, Activity, Loader2, RefreshCw,
  CheckCircle2, XCircle, Settings, Cpu, Zap, TrendingUp,
  Rocket,
} from "lucide-react";
import { useAdmin } from "./AdminContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SystemBackupCard } from "./SystemBackupCard";

interface BusinessesSummary { total: number; active: number; suspended: number; proAi: number; }
interface AiUsageData { summary?: { totalCostToday?: number; totalCostThisMonth?: number; totalCalls?: number; }; }
interface HealthData { status: string; uptime: number; checks: { database: { status: string; latencyMs: number; }; redis: { status: string; configured: boolean; connected: boolean; }; }; environment?: string; }
interface CronJobInfo { jobName: string; latestRun?: { startedAt: string; status: string } | null; totalRuns?: number; }
interface CronStatusData { jobs: CronJobInfo[]; }
interface RevenueData { summary: { monthlyExpected: number; monthlyReceived: number; outstanding: number; churnRisk: number; }; }

// Status accent colors — soft and consistent with the new palette
const ACCENT = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
  purple: "text-purple-600 dark:text-purple-400",
} as const;

export default function GlobalDashboard() {
  const { token } = useAdmin();
  const [summary, setSummary] = useState<BusinessesSummary | null>(null);
  const [aiData, setAiData] = useState<AiUsageData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [cronData, setCronData] = useState<CronStatusData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [bizRes, aiRes, healthRes, cronRes, revRes] = await Promise.all([
        fetch("/api/super-admin/businesses", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/super-admin/ai-usage", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch("/api/health"),
        fetch("/api/cron/status", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch("/api/super-admin/revenue-summary", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      const bizJson = await bizRes.json();
      const aiJson = aiRes ? await aiRes.json().catch(() => null) : null;
      const healthJson = await healthRes.json();
      const cronJson = cronRes ? await cronRes.json().catch(() => null) : null;
      const revJson = revRes ? await revRes.json().catch(() => null) : null;
      if (bizJson.summary) setSummary(bizJson.summary);
      if (aiJson) setAiData(aiJson);
      setHealth(healthJson);
      if (cronJson) setCronData(cronJson);
      if (revJson?.summary) setRevenue(revJson);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const aiCostToday = aiData?.summary?.totalCostToday ?? 0;
  const aiCostMonth = aiData?.summary?.totalCostThisMonth ?? 0;
  const cronJobsActive = cronData?.jobs?.filter((j) => j.totalRuns && j.totalRuns > 0).length ?? 0;
  const dbLatency = health?.checks?.database?.latencyMs ?? 0;
  const isHealthy = health?.status === "ok";

  return (
    <div className="space-y-5">
      {/* ═══ SECTION HEADER ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Welcome back, Admin</h2>
          <p className="text-sm text-muted-foreground">
            Platform health, revenue, and quick actions — all in one glance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* ═══ SYSTEM STATUS BAR ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusBar label="Database" status={isHealthy} value={dbLatency > 0 ? `${dbLatency}ms` : "Checking"} icon={Database} accent={ACCENT.emerald} />
        <StatusBar label="Z.ai AI" status={!!aiData} value={aiData ? "Online" : "Checking"} icon={Cpu} accent={ACCENT.indigo} />
        <StatusBar label="Cron Engine" status={cronJobsActive > 0} value={`${cronJobsActive}/${cronData?.jobs?.length ?? 0} jobs`} icon={Clock} accent={ACCENT.cyan} />
        <StatusBar label="Platform" status={isHealthy} value={isHealthy ? "Operational" : "Degraded"} icon={ShieldCheck} accent={isHealthy ? ACCENT.emerald : ACCENT.amber} />
      </div>

      {/* ═══ REVENUE METRICS ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="Monthly Expected" value={loading ? "—" : `৳${(revenue?.summary?.monthlyExpected ?? 0).toLocaleString()}`} sub="Recurring revenue" icon={TrendingUp} accent={ACCENT.emerald} />
            <Metric label="Received This Month" value={loading ? "—" : `৳${(revenue?.summary?.monthlyReceived ?? 0).toLocaleString()}`} sub="Collected" icon={DollarSign} accent={ACCENT.blue} />
            <Metric label="Outstanding" value={loading ? "—" : `৳${(revenue?.summary?.outstanding ?? 0).toLocaleString()}`} sub="Pending payment" icon={AlertTriangle} accent={ACCENT.amber} />
            <Metric label="Churn Risk" value={loading ? "—" : String(revenue?.summary?.churnRisk ?? 0)} sub="Expiring/expired" icon={XCircle} accent={ACCENT.rose} />
          </div>
        </CardContent>
      </Card>

      {/* ═══ PLATFORM OVERVIEW ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Platform Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric label="Total Clients" value={loading ? "—" : String(summary?.total ?? 0)} sub={`${summary?.proAi ?? 0} Pro AI`} icon={Building2} accent={ACCENT.cyan} />
            <Metric label="Active" value={loading ? "—" : String(summary?.active ?? 0)} sub="Running" icon={CheckCircle2} accent={ACCENT.emerald} />
            <Metric label="AI Cost Today" value={loading ? "—" : `৳${aiCostToday.toFixed(2)}`} sub={`Month: ৳${aiCostMonth.toFixed(2)}`} icon={Zap} accent={ACCENT.purple} />
            <Metric label="Uptime" value={loading ? "—" : `${health ? Math.floor(health.uptime / 60) : 0}m`} sub={health?.environment || "production"} icon={Activity} accent={ACCENT.blue} />
          </div>
        </CardContent>
      </Card>

      {/* ═══ QUICK ACTIONS ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CommandLink href="/admin/clients" icon={Users} label="Client Monitor" desc="Subscriptions + revenue" accent={ACCENT.emerald} />
            <CommandLink href="/admin/cctv" icon={Database} label="CCTV Shop" desc="Overview + catalog" accent={ACCENT.indigo} />
            <CommandLink href="/admin/pharmacy" icon={Activity} label="Pharmacy" desc="Overview + 14K catalog" accent={ACCENT.cyan} />
            <CommandLink href="/admin/api-setup" icon={Settings} label="System Config" desc="AI + SMTP + Cron" accent={ACCENT.purple} />
          </div>
        </CardContent>
      </Card>

      {/* ═══ SYSTEM BACKUP (Phase 3) ═══ */}
      <SystemBackupCard token={token!} />

      {/* ═══ CRON STATUS ═══ */}
      {cronData?.jobs && cronData.jobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Cron Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cronData.jobs.map((job) => {
                const isActive = job.totalRuns && job.totalRuns > 0;
                const lastStatus = job.latestRun?.status;
                return (
                  <div key={job.jobName} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5 border border-border">
                    <div className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40")} />
                    <span className="text-xs font-mono text-foreground/80 flex-1 truncate">{job.jobName}</span>
                    {lastStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    {lastStatus === "error" && <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                    <span className="text-[10px] text-muted-foreground">{job.totalRuns ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══ SUB-COMPONENTS ═══

function StatusBar({ label, status, value, icon: Icon, accent }: { label: string; status: boolean; value: string; icon: any; accent: string }) {
  return (
    <div className="relative rounded-xl border border-border bg-card p-3 overflow-hidden transition-colors duration-200 ease-out hover:border-foreground/15">
      <div className="absolute top-0 left-0 h-full w-0.5 bg-primary/40" />
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent)} />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="flex-1" />
        <div className={cn("h-1.5 w-1.5 rounded-full", status ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
      </div>
      <p className="text-sm font-semibold mt-1.5">{value}</p>
    </div>
  );
}

function Metric({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub: string; icon: any; accent: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 transition-colors duration-200 ease-out hover:border-foreground/15">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn("h-3.5 w-3.5", accent)} />
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function CommandLink({ href, icon: Icon, label, desc, accent }: { href: string; icon: any; label: string; desc: string; accent: string }) {
  return (
    <Link href={href}>
      <div className="rounded-xl border border-border bg-card p-3.5 hover:bg-accent hover:border-foreground/15 transition-all duration-200 ease-out group cursor-pointer">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2 bg-muted group-hover:bg-background transition-colors", accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}
