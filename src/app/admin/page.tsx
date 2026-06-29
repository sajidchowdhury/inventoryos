"use client";

// /admin/page.tsx — Global Dashboard (Phase 3 Redesign)
// 4-section layout: API Health Banner → Platform Metrics → Setup Progress → Project Selector
//
// This is the landing page after super admin login. Shows ONLY cross-project info.
// Project-specific data lives in /admin/pharmacy, /admin/cctv, etc.

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, DollarSign, Users, ShieldCheck, AlertTriangle,
  Pill, Cctv, ShoppingBag, UtensilsCrossed, Smartphone, Zap, Cake,
  Mail, Database, Clock, Activity, TrendingUp, Loader2, RefreshCw,
  CheckCircle2, XCircle, Settings, ArrowRight, FileText,
} from "lucide-react";
import { useAdmin } from "./AdminContext";
import { Phase5OpsCard } from "./Phase5OpsCard";

// ── Types ──
interface BusinessesSummary {
  total: number;
  active: number;
  suspended: number;
  proAi: number;
}

interface AiUsageData {
  summary?: {
    totalCostToday?: number;
    totalCostThisMonth?: number;
    totalCalls?: number;
  };
}

interface HealthData {
  status: string;
  uptime: number;
  checks: {
    database: { status: string; latencyMs: number };
    redis: { status: string; configured: boolean; connected: boolean };
  };
  environment?: string;
}

interface CronJobInfo {
  jobName: string;
  latestRun?: { startedAt: string; status: string } | null;
  totalRuns?: number;
}

interface CronStatusData {
  jobs: CronJobInfo[];
}

interface RecipientsData {
  recipients: any[];
}

// ── Setup checklist steps ──
const SETUP_STEPS = [
  { id: "database", label: "Database Connected", icon: Database },
  { id: "cronSecret", label: "Cron Secret Set", icon: Clock },
  { id: "smtp", label: "SMTP Configured", icon: Mail },
  { id: "zai", label: "Z.ai AI Connected", icon: Activity },
  { id: "recipients", label: "Alert Recipients Added", icon: Users },
  { id: "killSwitch", label: "Kill-Switch Thresholds", icon: ShieldCheck },
  { id: "aiConfig", label: "AI Config Tuned", icon: Settings },
  { id: "cronScheduler", label: "Cron Scheduler Active", icon: TrendingUp },
  { id: "projectSetup", label: "Pharmacy Project Setup", icon: Pill },
];

// ── Project definitions ──
const PROJECTS = [
  { name: "Pharmacy", href: "/admin/pharmacy", icon: Pill, color: "from-emerald-500 to-teal-500", status: "Active" },
  { name: "CC Camera", href: "/admin/cctv", icon: Cctv, color: "from-blue-500 to-indigo-500", status: "Soon" },
  { name: "Grocery", href: "/admin/projects", icon: ShoppingBag, color: "from-orange-500 to-amber-500", status: "Soon" },
  { name: "Restaurant", href: "/admin/projects", icon: UtensilsCrossed, color: "from-red-500 to-rose-500", status: "Soon" },
  { name: "Mobile Shop", href: "/admin/projects", icon: Smartphone, color: "from-purple-500 to-violet-500", status: "Soon" },
  { name: "Electrical", href: "/admin/projects", icon: Zap, color: "from-yellow-500 to-amber-500", status: "Soon" },
  { name: "Bakery", href: "/admin/projects", icon: Cake, color: "from-pink-500 to-rose-500", status: "Soon" },
];

export default function GlobalDashboard() {
  const { token } = useAdmin();
  const [summary, setSummary] = useState<BusinessesSummary | null>(null);
  const [aiData, setAiData] = useState<AiUsageData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [cronData, setCronData] = useState<CronStatusData | null>(null);
  const [recipientsData, setRecipientsData] = useState<RecipientsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [bizRes, aiRes, healthRes, cronRes, recipRes] = await Promise.all([
        fetch("/api/super-admin/businesses", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/super-admin/ai-usage", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch("/api/health"),
        fetch("/api/cron/status", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch("/api/super-admin/kill-switch/recipients", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      const bizJson = await bizRes.json();
      const aiJson = aiRes ? await aiRes.json().catch(() => null) : null;
      const healthJson = await healthRes.json();
      const cronJson = cronRes ? await cronRes.json().catch(() => null) : null;
      const recipJson = recipRes ? await recipRes.json().catch(() => null) : null;

      if (bizJson.summary) setSummary(bizJson.summary);
      if (aiJson) setAiData(aiJson);
      setHealth(healthJson);
      if (cronJson) setCronData(cronJson);
      if (recipJson) setRecipientsData(recipJson);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // ── Compute setup progress ──
  const setupStatus: Record<string, boolean> = {
    database: health?.checks?.database?.status === "ok" || health?.status === "ok",
    cronSecret: !!cronData, // if cron status responds, secret is set or super-admin auth works
    smtp: false, // can't check env vars from client; test-email endpoint will verify
    zai: !!aiData, // if AI usage responds, Z.ai is connected
    recipients: (recipientsData?.recipients?.length ?? 0) > 0,
    killSwitch: true, // thresholds are seeded by default
    aiConfig: true, // AI config is seeded by default
    cronScheduler: (cronData?.jobs?.filter((j) => j.totalRuns && j.totalRuns > 0).length ?? 0) > 0,
    projectSetup: (summary?.total ?? 0) > 0,
  };
  const completedSteps = Object.values(setupStatus).filter(Boolean).length;
  const setupPercent = Math.round((completedSteps / SETUP_STEPS.length) * 100);

  const aiCostToday = aiData?.summary?.totalCostToday ?? 0;
  const aiCostMonth = aiData?.summary?.totalCostThisMonth ?? 0;

  return (
    <>
      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 1: API HEALTH BANNER                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ApiHealthCard
          label="Database"
          healthy={setupStatus.database}
          detail={health?.checks?.database ? `${health.checks.database.latencyMs}ms` : "Checking..."}
          icon={Database}
          href="/admin/api-setup"
        />
        <ApiHealthCard
          label="SMTP Email"
          healthy={setupStatus.smtp}
          detail={setupStatus.smtp ? "Configured" : "Not set"}
          icon={Mail}
          href="/admin/api-setup"
        />
        <ApiHealthCard
          label="Z.ai AI"
          healthy={setupStatus.zai}
          detail={setupStatus.zai ? "Connected" : "Checking..."}
          icon={Activity}
          href="/admin/api-setup"
        />
        <ApiHealthCard
          label="Cron Jobs"
          healthy={setupStatus.cronScheduler}
          detail={setupStatus.cronScheduler ? `${cronData?.jobs?.length ?? 0} jobs` : "No runs yet"}
          icon={Clock}
          href="/admin/api-setup"
        />
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 2: PLATFORM METRICS                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Total Businesses"
          value={loading ? "—" : String(summary?.total ?? 0)}
          sub={`${summary?.proAi ?? 0} Pro+AI`}
          icon={Building2}
          color="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/20"
        />
        <MetricCard
          label="AI Cost Today"
          value={loading ? "—" : `৳${aiCostToday.toFixed(2)}`}
          sub={`Month: ৳${aiCostMonth.toFixed(2)}`}
          icon={DollarSign}
          color="text-orange-600"
          bg="bg-orange-50 dark:bg-orange-950/20"
        />
        <MetricCard
          label="Active Clients"
          value={loading ? "—" : String(summary?.active ?? 0)}
          sub={`${summary?.suspended ?? 0} suspended`}
          icon={Users}
          color="text-emerald-600"
          bg="bg-emerald-50 dark:bg-emerald-950/20"
        />
        <MetricCard
          label="Platform Status"
          value={loading ? "—" : health?.status === "ok" ? "Healthy" : health?.status === "degraded" ? "Degraded" : "Down"}
          sub={`Uptime: ${health ? Math.floor(health.uptime / 60) : 0}min`}
          icon={ShieldCheck}
          color={health?.status === "ok" ? "text-emerald-600" : "text-amber-600"}
          bg="bg-purple-50 dark:bg-purple-950/20"
        />
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 3: SETUP PROGRESS WIDGET                      */}
      {/* ═══════════════════════════════════════════════════ */}
      <Card className={setupPercent < 100 ? "border-amber-200 dark:border-amber-900" : "border-emerald-200 dark:border-emerald-900"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5" />
                Setup Progress
              </CardTitle>
              <CardDescription>
                {setupPercent === 100
                  ? "All systems configured. Platform is ready for production."
                  : "Complete these steps in order. Click any incomplete step to configure it."}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${setupPercent === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                {setupPercent}%
              </div>
              <div className="text-xs text-muted-foreground">{completedSteps}/{SETUP_STEPS.length} steps</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${setupPercent === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${setupPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SETUP_STEPS.map((step, i) => {
              const isDone = setupStatus[step.id];
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  href={isDone ? "#" : "/admin/api-setup"}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                    isDone
                      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/10 cursor-default"
                      : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10 hover:border-amber-400"
                  }`}
                  onClick={isDone ? (e) => e.preventDefault() : undefined}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isDone ? "text-emerald-600" : "text-amber-600"}`} />
                  <span className="flex-1 text-xs">{step.label}</span>
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <ArrowRight className="h-3 w-3 text-amber-600 shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 4: PHASE 5 OPS HEALTH (platform-wide)        */}
      {/* ═══════════════════════════════════════════════════ */}
      <Phase5OpsCard token={token!} />

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 5: PROJECT SELECTOR                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-600" />
            Projects
          </CardTitle>
          <CardDescription>
            Click a project to view its dashboard. Each project has its own metrics,
            schedules, and configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {PROJECTS.map((project, i) => {
              const Icon = project.icon;
              const isComing = project.status === "Soon";
              return (
                <motion.div
                  key={project.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {isComing ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 opacity-60 cursor-not-allowed">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center mb-2`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="font-medium text-sm">{project.name}</div>
                      <Badge variant="secondary" className="mt-1 text-xs">Coming Soon</Badge>
                    </div>
                  ) : (
                    <Link href={project.href}>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="font-medium text-sm">{project.name}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>
                          <span className="text-xs text-muted-foreground">{summary?.total ?? 0} businesses</span>
                        </div>
                      </div>
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SECTION 6: QUICK ACTIONS                              */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-2 pb-4">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
        <Link href="/admin/api-setup">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-1" /> API Setup
          </Button>
        </Link>
        <Link href="/admin/pharmacy">
          <Button variant="outline" size="sm">
            <Pill className="h-4 w-4 mr-1" /> Pharmacy
          </Button>
        </Link>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function ApiHealthCard({ label, healthy, detail, icon: Icon, href }: { label: string; healthy: boolean; detail: string; icon: any; href: string }) {
  return (
    <Link href={href}>
      <div className={`rounded-lg border p-3 transition-colors hover:shadow-md cursor-pointer ${
        healthy
          ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/10"
          : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10"
      }`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${healthy ? "text-emerald-600" : "text-amber-600"}`} />
          <span className="text-xs font-medium">{label}</span>
          {healthy ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 ml-auto" />
          )}
        </div>
        <div className={`text-xs mt-1 ${healthy ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
          {detail}
        </div>
      </div>
    </Link>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg }: { label: string; value: string; sub: string; icon: any; color: string; bg: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-800 p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
