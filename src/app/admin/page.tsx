"use client";

// /admin/page.tsx — Futuristic Command Center
// Sci-fi inspired: dark glass cards, neon accents, animated metrics
// Streamlined: 3 sections only (System Health → Revenue → Quick Actions)

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Building2, DollarSign, Users, ShieldCheck, AlertTriangle,
  Database, Clock, Activity, Loader2, RefreshCw,
  CheckCircle2, XCircle, Settings, Cpu, Zap, TrendingUp,
  CreditCard, Bell, Rocket,
} from "lucide-react";
import { useAdmin } from "./AdminContext";
import { Button } from "@/components/ui/button";

interface BusinessesSummary { total: number; active: number; suspended: number; proAi: number; }
interface AiUsageData { summary?: { totalCostToday?: number; totalCostThisMonth?: number; totalCalls?: number; }; }
interface HealthData { status: string; uptime: number; checks: { database: { status: string; latencyMs: number; }; redis: { status: string; configured: boolean; connected: boolean; }; }; environment?: string; }
interface CronJobInfo { jobName: string; latestRun?: { startedAt: string; status: string } | null; totalRuns?: number; }
interface CronStatusData { jobs: CronJobInfo[]; }
interface RevenueData { summary: { monthlyExpected: number; monthlyReceived: number; outstanding: number; churnRisk: number; }; }

const NEON = {
  emerald: "#10B981",
  cyan: "#06B6D4",
  purple: "#8B5CF6",
  amber: "#F59E0B",
  rose: "#F43F5E",
  blue: "#3B82F6",
};

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
    <div className="space-y-4">
      {/* ═══ SYSTEM STATUS BAR ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatusBar label="Database" status={isHealthy} value={dbLatency > 0 ? `${dbLatency}ms` : "Checking"} icon={Database} color={NEON.emerald} />
        <StatusBar label="Z.ai AI" status={!!aiData} value={aiData ? "Online" : "Checking"} icon={Cpu} color={NEON.purple} />
        <StatusBar label="Cron Engine" status={cronJobsActive > 0} value={`${cronJobsActive}/${cronData?.jobs?.length ?? 0} jobs`} icon={Clock} color={NEON.cyan} />
        <StatusBar label="Platform" status={isHealthy} value={isHealthy ? "Operational" : "Degraded"} icon={ShieldCheck} color={isHealthy ? NEON.emerald : NEON.amber} />
      </div>

      {/* ═══ REVENUE + METRICS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <NeonMetric label="Monthly Expected" value={loading ? "—" : `৳${(revenue?.summary?.monthlyExpected ?? 0).toLocaleString()}`} sub="Recurring revenue" icon={TrendingUp} color={NEON.emerald} />
        <NeonMetric label="Received This Month" value={loading ? "—" : `৳${(revenue?.summary?.monthlyReceived ?? 0).toLocaleString()}`} sub="Collected" icon={DollarSign} color={NEON.blue} />
        <NeonMetric label="Outstanding" value={loading ? "—" : `৳${(revenue?.summary?.outstanding ?? 0).toLocaleString()}`} sub="Pending payment" icon={AlertTriangle} color={NEON.amber} />
        <NeonMetric label="Churn Risk" value={loading ? "—" : String(revenue?.summary?.churnRisk ?? 0)} sub="Expiring/expired" icon={XCircle} color={NEON.rose} />
      </div>

      {/* ═══ PLATFORM OVERVIEW ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <NeonMetric label="Total Clients" value={loading ? "—" : String(summary?.total ?? 0)} sub={`${summary?.proAi ?? 0} Pro AI`} icon={Building2} color={NEON.cyan} />
        <NeonMetric label="Active" value={loading ? "—" : String(summary?.active ?? 0)} sub="Running" icon={CheckCircle2} color={NEON.emerald} />
        <NeonMetric label="AI Cost Today" value={loading ? "—" : `৳${aiCostToday.toFixed(2)}`} sub={`Month: ৳${aiCostMonth.toFixed(2)}`} icon={Zap} color={NEON.purple} />
        <NeonMetric label="Uptime" value={loading ? "—" : `${health ? Math.floor(health.uptime / 60) : 0}m`} sub={health?.environment || "production"} icon={Activity} color={NEON.blue} />
      </div>

      {/* ═══ COMMAND CENTER ═══ */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
            <Cpu className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Command Center</h2>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="text-slate-400 hover:text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CommandLink href="/admin/clients" icon={Users} label="Client Monitor" desc="Subscriptions + revenue" color={NEON.emerald} />
          <CommandLink href="/admin/catalog" icon={Database} label="Master Catalog" desc="14K+ products" color={NEON.blue} />
          <CommandLink href="/admin/api-setup" icon={Settings} label="System Config" desc="AI + SMTP + Cron" color={NEON.purple} />
          <CommandLink href="/admin/deploy" icon={Rocket} label="Deploy" desc="Build + restart" color={NEON.amber} />
        </div>
      </div>

      {/* ═══ CRON STATUS ═══ */}
      {cronData?.jobs && cronData.jobs.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Cron Jobs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {cronData.jobs.map((job) => {
              const isActive = job.totalRuns && job.totalRuns > 0;
              const lastStatus = job.latestRun?.status;
              return (
                <div key={job.jobName} className="flex items-center gap-2 rounded-lg bg-slate-800/50 p-2.5 border border-slate-700/50">
                  <div className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
                  <span className="text-xs text-slate-300 flex-1 truncate font-mono">{job.jobName}</span>
                  {lastStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {lastStatus === "error" && <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                  <span className="text-[10px] text-slate-500">{job.totalRuns ?? 0} runs</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ SUB-COMPONENTS ═══

function StatusBar({ label, status, value, icon: Icon, color }: { label: string; status: boolean; value: string; icon: any; color: string }) {
  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-3 overflow-hidden">
      <div className="absolute top-0 left-0 h-full w-0.5" style={{ background: status ? color : NEON.amber }} />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: status ? color : NEON.amber }} />
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <div className="flex-1" />
        <div className={`h-2 w-2 rounded-full ${status ? "animate-pulse" : ""}`} style={{ background: status ? color : NEON.amber }} />
      </div>
      <p className="text-sm font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function NeonMetric({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub: string; icon: any; color: string }) {
  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-3 overflow-hidden group hover:border-slate-700 transition-colors">
      <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-10 blur-xl" style={{ background: color }} />
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function CommandLink({ href, icon: Icon, label, desc, color }: { href: string; icon: any; label: string; desc: string; color: string }) {
  return (
    <Link href={href}>
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 hover:border-slate-600 hover:bg-slate-800 transition-all group cursor-pointer">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform" style={{ background: `${color}20` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    </Link>
  );
}
