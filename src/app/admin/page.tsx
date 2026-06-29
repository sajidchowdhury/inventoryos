"use client";

// ── Super Admin Dashboard ──
// Renders a login screen when no token is present, otherwise renders the full
// platform dashboard: business list, summary cards, AI usage analytics, abuse
// alerts, background job controls.
//
// All API calls send `Authorization: Bearer <token>` after a successful login.
// The token is persisted in localStorage under "superAdminToken".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  LogOut,
  RefreshCw,
  Search,
  Building2,
  Sparkles,
  TrendingUp,
  DollarSign,
  Users,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  Clock,
  Calendar,
  Play,
  Activity,
  Zap,
  Ban,
  Crown,
  HelpCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AiConfigCard } from "./AiConfigCard";
import { KillSwitchCard } from "./KillSwitchCard";
import { NotificationRecipientsCard } from "./NotificationRecipientsCard";
import { Phase5OpsCard } from "./Phase5OpsCard";
import { GeneratedReportsViewer } from "./GeneratedReportsViewer";
import { SuperAdminHelp } from "./SuperAdminHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── Token storage helpers ──
const TOKEN_KEY = "superAdminToken";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// ── Types ──

interface SuperAdminInfo {
  id: string;
  username: string;
  fullName: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  superAdmin?: SuperAdminInfo;
  error?: string;
}

interface BusinessAI {
  enabled: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  tokenBudget: number;
}

interface BusinessSubscription {
  tier: "free" | "pro" | "pro_ai";
  status: "trial" | "active" | "suspended" | "cancelled";
  start: string | null;
  end: string | null;
}

interface BusinessRow {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  businessType: { name: string; slug: string } | null;
  owner: { phone: string; name: string | null } | null;
  subscription: BusinessSubscription;
  ai: BusinessAI;
  usage: {
    products: number;
    sales: number;
    customers: number;
    businessUsers: number;
    aiUsageThisMonth: { calls: number; tokens: number; cost: number };
  };
  createdAt: string;
  updatedAt: string;
}

interface BusinessesSummary {
  totalBusinesses: number;
  aiEnabledCount: number;
  totalAICallsThisMonth: number;
  totalAICostThisMonth: number;
  monthStart: string;
}

interface BusinessesData {
  success: boolean;
  generatedAt: string;
  businesses: BusinessRow[];
  summary: BusinessesSummary;
}

interface AIUsageSummary {
  today: { calls: number; tokens: number; cost: number };
  thisMonth: { calls: number; tokens: number; cost: number };
}

interface ByFeatureRow {
  feature: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface ByBusinessRow {
  business: { id: string; name: string } | null;
  calls: number;
  tokens: number;
  cost: number;
}

interface Last7DaysRow {
  date: string;
  dayName: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface TopSpenderRow {
  business: { id: string; name: string } | null;
  businessId: string;
  callsToday: number;
  tokensToday: number;
  costToday: number;
}

type AbuseSeverity = "high_usage" | "possible_abuse";

interface AbuseFlag {
  businessId: string;
  businessName: string;
  aiEnabled: boolean;
  subscriptionTier: string;
  aiDailyLimit: number;
  callsToday: number;
  tokensToday: number;
  costToday: number;
  severity: AbuseSeverity;
  limitUtilizationPercent: number;
}

interface SQLRouterMetric {
  hitRate: number;
  totalChatCalls: number;
  sqlRouterHits: number;
  llmCalls: number;
  byPattern: Array<{ pattern: string; calls: number }>;
  targetHitRate: number;
}

interface CacheMetric {
  hitRate: number;
  totalCalls: number;
  cacheHits: number;
  llmCalls: number;
  byFeature: Array<{ feature: string; hits: number }>;
  targetHitRate: number;
}

interface AIUsageData {
  summary: AIUsageSummary;
  byFeature: ByFeatureRow[];
  byBusiness: ByBusinessRow[];
  last7Days: Last7DaysRow[];
  topSpendersToday?: TopSpenderRow[];
  abuseFlags?: AbuseFlag[];
  abuseThresholds?: { highUsage: number; possibleAbuse: number };
  sqlRouter?: SQLRouterMetric;
  cache?: CacheMetric;
}

interface CronLatestRun {
  id: string;
  status: "success" | "failed" | "running" | string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  businessesProcessed: number;
  recordsWritten: number;
  errorMessage: string | null;
}

interface CronJobStatus {
  jobName: string;
  schedule: string;
  description: string;
  latestRun: CronLatestRun | null;
  totalRuns: number;
  recentFailures: Array<{
    id: string;
    startedAt: string;
    durationMs: number | null;
    errorMessage: string | null;
  }>;
}

interface CronStatusData {
  success: boolean;
  generatedAt: string;
  jobs: CronJobStatus[];
  schedules: Record<string, { schedule: string; description: string }>;
}

// ── Formatters ──

function formatBDT(amount: number): string {
  if (amount == null || isNaN(amount)) return "৳0";
  return `৳${amount.toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number): string {
  if (value == null || isNaN(value)) return "0";
  return value.toLocaleString("en-BD");
}

function formatPercent(value: number, digits = 1): string {
  if (value == null || isNaN(value)) return "0%";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function dayNameFromDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return "";
  }
}

// ── Tier + status badge helpers ──

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    free: "bg-slate-100 text-slate-700 border-slate-200",
    pro: "bg-blue-100 text-blue-700 border-blue-200",
    pro_ai: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent",
  };
  const label = tier === "pro_ai" ? "Pro+AI" : tier === "pro" ? "Pro" : "Free";
  return (
    <Badge variant="outline" className={cn("text-xs", styles[tier] || styles.free)}>
      {tier === "pro_ai" && <Crown className="h-3 w-3" />}
      {label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trial: "bg-amber-100 text-amber-800 border-amber-200",
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    suspended: "bg-red-100 text-red-800 border-red-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", styles[status] || styles.cancelled)}>
      {status}
    </Badge>
  );
}

// ── Auth fetch helper ──

async function authFetch<T = unknown>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...options, headers });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

// ── Map the raw API AI-usage payload into our documented interface ──
// The API may emit `flag` (instead of `severity`) and split sqlRouter/cache
// into today/thisMonth buckets; this adapter flattens to the spec'd shape.

function normalizeAIUsage(raw: any): AIUsageData {
  // byBusiness: API emits {businessId, businessName, subscriptionTier, calls, tokens, cost}
  // Spec wants {business: {id, name}|null, calls, tokens, cost}
  const byBusiness: ByBusinessRow[] = Array.isArray(raw?.byBusiness)
    ? raw.byBusiness.map((r: any) => ({
        business:
          r?.business != null
            ? { id: r.business.id, name: r.business.name }
            : r?.businessId
              ? { id: r.businessId, name: r.businessName ?? "Unknown" }
              : null,
        calls: Number(r?.calls ?? 0),
        tokens: Number(r?.tokens ?? 0),
        cost: Number(r?.cost ?? 0),
      }))
    : [];

  // topSpendersToday: API emits {businessId, businessName, subscriptionTier, aiEnabled,
  // callsToday, tokensToday, costToday} — flatten business object
  const topSpendersToday: TopSpenderRow[] | undefined = Array.isArray(raw?.topSpendersToday)
    ? raw.topSpendersToday.map((r: any) => ({
        business:
          r?.business != null
            ? { id: r.business.id, name: r.business.name }
            : r?.businessId
              ? { id: r.businessId, name: r.businessName ?? "Unknown" }
              : null,
        businessId: String(r?.businessId ?? r?.business?.id ?? ""),
        callsToday: Number(r?.callsToday ?? 0),
        tokensToday: Number(r?.tokensToday ?? 0),
        costToday: Number(r?.costToday ?? 0),
      }))
    : undefined;

  // abuseFlags: API emits `flag` and omits tokensToday/costToday/limitUtilizationPercent.
  // Normalize `flag` → `severity` and synthesize the missing fields defensively.
  const abuseFlags: AbuseFlag[] | undefined = Array.isArray(raw?.abuseFlags)
    ? raw.abuseFlags.map((r: any) => {
        const severity: AbuseSeverity =
          (r?.severity as AbuseSeverity) ??
          (r?.flag === "possible_abuse" ? "possible_abuse" : "high_usage");
        const dailyLimit = Number(r?.aiDailyLimit ?? 50);
        const callsToday = Number(r?.callsToday ?? 0);
        const limitUtilizationPercent =
          dailyLimit > 0 ? Math.min(100, Math.round((callsToday / dailyLimit) * 100)) : 0;
        return {
          businessId: String(r?.businessId ?? ""),
          businessName: String(r?.businessName ?? "Unknown"),
          aiEnabled: Boolean(r?.aiEnabled ?? false),
          subscriptionTier: String(r?.subscriptionTier ?? "free"),
          aiDailyLimit: dailyLimit,
          callsToday,
          tokensToday: Number(r?.tokensToday ?? 0),
          costToday: Number(r?.costToday ?? 0),
          severity,
          limitUtilizationPercent,
        };
      })
    : undefined;

  const abuseThresholds = raw?.abuseThresholds ?? { highUsage: 20, possibleAbuse: 40 };

  // sqlRouter: API emits {today:{routerHits,llmCalls,total,hitRate}, thisMonth:{...}}
  // Spec wants a flat {hitRate, totalChatCalls, sqlRouterHits, llmCalls, byPattern, targetHitRate}.
  // We use `today` as the headline view (the dashboard surfaces today's data).
  const rawSql = raw?.sqlRouter;
  const sqlToday =
    rawSql && typeof rawSql === "object" && "today" in rawSql
      ? (rawSql.today as any)
      : (rawSql as any);
  const sqlRouter: SQLRouterMetric | undefined = rawSql
    ? {
        hitRate: Number(sqlToday?.hitRate ?? 0),
        totalChatCalls: Number(sqlToday?.total ?? 0),
        sqlRouterHits: Number(sqlToday?.routerHits ?? 0),
        llmCalls: Number(sqlToday?.llmCalls ?? 0),
        byPattern: Array.isArray(rawSql?.byPattern)
          ? rawSql.byPattern.map((p: any) => ({
              pattern: String(p?.pattern ?? ""),
              calls: Number(p?.calls ?? 0),
            }))
          : [],
        targetHitRate: Number(rawSql?.targetHitRate ?? 0.5),
      }
    : undefined;

  // cache: same shape-flattening
  const rawCache = raw?.cache;
  const cacheToday =
    rawCache && typeof rawCache === "object" && "today" in rawCache
      ? (rawCache.today as any)
      : (rawCache as any);
  const cache: CacheMetric | undefined = rawCache
    ? {
        hitRate: Number(cacheToday?.hitRate ?? 0),
        totalCalls: Number(cacheToday?.total ?? 0),
        cacheHits: Number(cacheToday?.cacheHits ?? 0),
        llmCalls: Number(cacheToday?.llmCalls ?? 0),
        byFeature: Array.isArray(rawCache?.byFeature)
          ? rawCache.byFeature.map((f: any) => ({
              feature: String(f?.feature ?? ""),
              hits: Number(f?.hits ?? 0),
            }))
          : [],
        targetHitRate: Number(rawCache?.targetHitRate ?? 0.5),
      }
    : undefined;

  // last7Days: API emits {date, calls, tokens, cost, successes, failures} — we add dayName
  const last7Days: Last7DaysRow[] = Array.isArray(raw?.last7Days)
    ? raw.last7Days.map((r: any) => ({
        date: String(r?.date ?? ""),
        dayName: String(r?.dayName ?? dayNameFromDate(r?.date ?? "")),
        calls: Number(r?.calls ?? 0),
        tokens: Number(r?.tokens ?? 0),
        cost: Number(r?.cost ?? 0),
      }))
    : [];

  return {
    summary: raw?.summary ?? { today: { calls: 0, tokens: 0, cost: 0 }, thisMonth: { calls: 0, tokens: 0, cost: 0 } },
    byFeature: Array.isArray(raw?.byFeature)
      ? raw.byFeature.map((r: any) => ({
          feature: String(r?.feature ?? ""),
          calls: Number(r?.calls ?? 0),
          tokens: Number(r?.tokens ?? 0),
          cost: Number(r?.cost ?? 0),
        }))
      : [],
    byBusiness,
    last7Days,
    topSpendersToday,
    abuseFlags,
    abuseThresholds,
    sqlRouter,
    cache,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Login Screen
// ──────────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = (await res.json().catch(() => ({}))) as LoginResponse;
      if (!res.ok || !body.success || !body.token) {
        setError(body.error || `Login failed (${res.status})`);
        return;
      }
      setToken(body.token);
      onLogin(body.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl text-white shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Super Admin</CardTitle>
            <CardDescription className="text-slate-300">
              InventoryOS Platform Control
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-200">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                />
              </div>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Summary cards row
// ──────────────────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: BusinessesSummary | null }) {
  const cards = [
    {
      label: "Businesses",
      value: summary ? formatNumber(summary.totalBusinesses) : "—",
      icon: Building2,
      color: "from-blue-500 to-cyan-500",
    },
    {
      label: "AI Enabled",
      value: summary ? formatNumber(summary.aiEnabledCount) : "—",
      icon: Sparkles,
      color: "from-purple-500 to-pink-500",
    },
    {
      label: "AI Calls (Month)",
      value: summary ? formatNumber(summary.totalAICallsThisMonth) : "—",
      icon: Zap,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "AI Cost (Month)",
      value: summary ? formatBDT(summary.totalAICostThisMonth) : "—",
      icon: DollarSign,
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden">
            <CardContent className="flex items-center gap-4 pt-0">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                  c.color
                )}
              >
                <c.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold tracking-tight">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Abuse Alerts card
// ──────────────────────────────────────────────────────────────────────────

function AbuseAlertsCard({
  flags,
  thresholds,
  onSuspend,
  suspendingId,
}: {
  flags: AbuseFlag[];
  thresholds: { highUsage: number; possibleAbuse: number } | undefined;
  onSuspend: (id: string, name: string) => void;
  suspendingId: string | null;
}) {
  if (!flags || flags.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            Abuse Alerts
            <Badge variant="destructive" className="ml-1">
              {flags.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Businesses exceeding{" "}
            <span className="font-medium text-red-700 dark:text-red-400">
              {thresholds?.highUsage ?? 20} calls/day
            </span>{" "}
            (high usage) or{" "}
            <span className="font-medium text-red-700 dark:text-red-400">
              {thresholds?.possibleAbuse ?? 40} calls/day
            </span>{" "}
            (possible abuse).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.map((flag) => (
            <div
              key={flag.businessId}
              className={cn(
                "flex flex-col gap-3 rounded-lg border bg-white p-3 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between",
                flag.severity === "possible_abuse"
                  ? "border-red-400 dark:border-red-700"
                  : "border-amber-300 dark:border-amber-700"
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{flag.businessName || "Unknown"}</span>
                  <Badge
                    variant={flag.severity === "possible_abuse" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {flag.severity === "possible_abuse" ? "Possible Abuse" : "High Usage"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <Zap className="mr-1 inline h-3 w-3" />
                    {formatNumber(flag.callsToday)} calls today
                  </span>
                  <span>
                    Limit: {formatNumber(flag.aiDailyLimit)} (
                    {flag.limitUtilizationPercent}% used)
                  </span>
                  <TierBadge tier={flag.subscriptionTier} />
                  {flag.aiEnabled && (
                    <Badge variant="outline" className="text-xs">
                      AI On
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={suspendingId === flag.businessId || !flag.aiEnabled}
                onClick={() => onSuspend(flag.businessId, flag.businessName)}
              >
                {suspendingId === flag.businessId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                Suspend AI
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AI Cost Today card (orange-bordered, with 7-day sparkline)
// ──────────────────────────────────────────────────────────────────────────

function AICostTodayCard({ data }: { data: AIUsageData }) {
  const today = data.summary.today;
  const month = data.summary.thisMonth;
  const last7 = data.last7Days ?? [];
  const maxCost = Math.max(1, ...last7.map((d) => d.cost));
  const todayCost = today.cost ?? 0;

  return (
    <Card className="border-orange-300 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <DollarSign className="h-5 w-5" />
          AI Cost Today
        </CardTitle>
        <CardDescription>Today's platform-wide AI spend in BDT</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-4xl font-bold tracking-tight text-orange-600 dark:text-orange-300">
            {formatBDT(todayCost)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> {formatNumber(today.calls)} calls
            </span>
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" /> {formatNumber(today.tokens)} tokens
            </span>
          </div>
        </div>

        {/* 7-day sparkline bar chart */}
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>7-day cost trend</span>
            <span>
              {formatBDT(last7.reduce((s, d) => s + d.cost, 0))} total
            </span>
          </div>
          <div className="flex h-20 items-end gap-1.5">
            {last7.map((d, i) => {
              const h = Math.max(4, Math.round((d.cost / maxCost) * 100));
              const isToday = i === last7.length - 1;
              return (
                <div
                  key={d.date}
                  className="group relative flex flex-1 flex-col items-center gap-1"
                  title={`${d.dayName}: ${formatBDT(d.cost)}`}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={cn(
                      "w-full rounded-t-md",
                      isToday
                        ? "bg-orange-500"
                        : "bg-orange-300 dark:bg-orange-700"
                    )}
                    style={{ minHeight: 4 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.dayName}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Month-to-date</span>
          <span className="font-semibold">{formatBDT(month.cost)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Top Spenders Today
// ──────────────────────────────────────────────────────────────────────────

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];

function TopSpendersCard({ data }: { data: AIUsageData }) {
  const spenders = data.topSpendersToday ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-500" />
          Top Spenders Today
        </CardTitle>
        <CardDescription>Top 5 businesses by AI call count today</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {spenders.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No AI calls today yet.
          </div>
        ) : (
          spenders.map((s, i) => (
            <div
              key={s.businessId || i}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">
                {i < 3 ? MEDAL_EMOJI[i] : <span className="text-sm font-semibold">#{i + 1}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {s.business?.name ?? "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(s.callsToday)} calls ·{" "}
                  {formatNumber(s.tokensToday)} tokens
                </div>
              </div>
              <div className="text-right text-sm font-semibold">
                {formatBDT(s.costToday)}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SQL Router Hit Rate card (cyan-bordered)
// ──────────────────────────────────────────────────────────────────────────

function SQLRouterCard({ data }: { data: AIUsageData }) {
  const sql = data.sqlRouter;
  if (!sql) return null;
  const pct = sql.hitRate ?? 0;
  const targetPct = sql.targetHitRate ?? 0.5;
  const progressPct = Math.min(100, Math.round((pct / targetPct) * 100));
  const meetsTarget = pct >= targetPct;

  return (
    <Card className="border-cyan-300 dark:border-cyan-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
          <Shield className="h-5 w-5" />
          SQL Router Hit Rate
        </CardTitle>
        <CardDescription>
          How often chat queries are answered from the SQL router cache vs the LLM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-4xl font-bold text-cyan-600 dark:text-cyan-300">
              {formatPercent(pct)}
            </div>
            <div className="text-xs text-muted-foreground">
              Target: {formatPercent(targetPct, 0)}
            </div>
          </div>
          <Badge
            variant={meetsTarget ? "default" : "secondary"}
            className={cn(
              meetsTarget
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
            )}
          >
            {meetsTarget ? (
              <>
                <Check className="h-3 w-3" /> On target
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" /> Below target
              </>
            )}
          </Badge>
        </div>

        <div>
          <Progress value={progressPct} className="h-2 bg-cyan-100 dark:bg-cyan-900/40" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md bg-cyan-50 p-2 dark:bg-cyan-950/30">
            <div className="font-semibold text-cyan-700 dark:text-cyan-300">
              {formatNumber(sql.sqlRouterHits)}
            </div>
            <div className="text-xs text-muted-foreground">SQL hits</div>
          </div>
          <div className="rounded-md bg-orange-50 p-2 dark:bg-orange-950/30">
            <div className="font-semibold text-orange-700 dark:text-orange-300">
              {formatNumber(sql.llmCalls)}
            </div>
            <div className="text-xs text-muted-foreground">LLM calls</div>
          </div>
          <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-900/50">
            <div className="font-semibold">{formatNumber(sql.totalChatCalls)}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>

        {sql.byPattern && sql.byPattern.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Top patterns</div>
            <div className="space-y-1">
              {sql.byPattern.slice(0, 5).map((p) => (
                <div
                  key={p.pattern}
                  className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-xs"
                >
                  <code className="truncate font-mono text-cyan-700 dark:text-cyan-400">
                    {p.pattern}
                  </code>
                  <span className="font-semibold">{formatNumber(p.calls)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AI Usage by Feature
// ──────────────────────────────────────────────────────────────────────────

function FeatureUsageCard({ data }: { data: AIUsageData }) {
  const features = data.byFeature ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-500" />
          AI Usage by Feature
        </CardTitle>
        <CardDescription>This month's AI calls broken down by feature</CardDescription>
      </CardHeader>
      <CardContent>
        {features.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No feature usage recorded this month.
          </div>
        ) : (
          <div className="space-y-2">
            {features.map((f) => (
              <div
                key={f.feature}
                className="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.feature}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(f.calls)} calls · {formatNumber(f.tokens)} tokens
                  </div>
                </div>
                <div className="text-right text-sm font-semibold">
                  {formatBDT(f.cost)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AI Usage Last 7 Days (bar chart)
// ──────────────────────────────────────────────────────────────────────────

function Usage7DaysCard({ data }: { data: AIUsageData }) {
  const days = data.last7Days ?? [];
  const maxCalls = Math.max(1, ...days.map((d) => d.calls));
  const totalCalls = days.reduce((s, d) => s + d.calls, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          AI Usage Last 7 Days
        </CardTitle>
        <CardDescription>
          Daily AI calls — {formatNumber(totalCalls)} total in the last week
        </CardDescription>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No usage data available.
          </div>
        ) : (
          <div className="flex h-40 items-end gap-2">
            {days.map((d, i) => {
              const h = Math.max(4, Math.round((d.calls / maxCalls) * 100));
              const isToday = i === days.length - 1;
              return (
                <div
                  key={d.date}
                  className="group flex flex-1 flex-col items-center gap-1"
                  title={`${d.dayName}: ${formatNumber(d.calls)} calls`}
                >
                  <span className="text-xs font-medium">
                    {formatNumber(d.calls)}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={cn(
                      "w-full rounded-t-md",
                      isToday
                        ? "bg-gradient-to-t from-blue-500 to-cyan-400"
                        : "bg-blue-300 dark:bg-blue-700"
                    )}
                    style={{ minHeight: 4 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.dayName}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Background Jobs card
// ──────────────────────────────────────────────────────────────────────────

function jobStatusColor(status: string | undefined): string {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "running":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function jobStatusLabel(status: string | undefined): string {
  if (!status) return "never";
  return status;
}

function BackgroundJobsCard({
  jobs,
  onRunNow,
  runningJob,
}: {
  jobs: CronJobStatus[];
  onRunNow: (jobName: string) => void;
  runningJob: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          Background Jobs
        </CardTitle>
        <CardDescription>Cron jobs and their latest run status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No jobs configured.
          </div>
        ) : (
          jobs.map((job) => {
            const last = job.latestRun;
            return (
              <div
                key={job.jobName}
                className="rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-slate-100">
                        {job.jobName}
                      </code>
                      <code className="font-mono text-xs text-muted-foreground">
                        {job.schedule}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {job.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={runningJob === job.jobName}
                    onClick={() => onRunNow(job.jobName)}
                  >
                    {runningJob === job.jobName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Run Now
                  </Button>
                </div>
                <Separator className="my-2" />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", jobStatusColor(last?.status))}
                  >
                    {jobStatusLabel(last?.status)}
                  </Badge>
                  {last && (
                    <>
                      <span className="text-muted-foreground">
                        Last run: {formatRelativeTime(last.startedAt)}
                      </span>
                      <span className="text-muted-foreground">
                        Duration: {formatDuration(last.durationMs)}
                      </span>
                      {last.recordsWritten > 0 && (
                        <span className="text-muted-foreground">
                          Records: {formatNumber(last.recordsWritten)}
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-muted-foreground">
                    Total runs: {formatNumber(job.totalRuns)}
                  </span>
                </div>
                {last?.errorMessage && (
                  <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    {last.errorMessage}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Edit Business dialog
// ──────────────────────────────────────────────────────────────────────────

interface EditState {
  subscriptionTier: string;
  subscriptionStatus: string;
  aiEnabled: boolean;
  aiDailyLimit: number;
  aiMonthlyLimit: number;
  aiTokenBudget: number;
}

function EditBusinessDialog({
  business,
  onClose,
  onSave,
  saving,
}: {
  business: BusinessRow | null;
  onClose: () => void;
  onSave: (state: EditState) => void;
  saving: boolean;
}) {
  const [state, setState] = useState<EditState>({
    subscriptionTier: "free",
    subscriptionStatus: "trial",
    aiEnabled: false,
    aiDailyLimit: 50,
    aiMonthlyLimit: 1000,
    aiTokenBudget: 100_000,
  });

  useEffect(() => {
    if (business) {
      setState({
        subscriptionTier: business.subscription.tier,
        subscriptionStatus: business.subscription.status,
        aiEnabled: business.ai.enabled,
        aiDailyLimit: business.ai.dailyLimit,
        aiMonthlyLimit: business.ai.monthlyLimit,
        aiTokenBudget: business.ai.tokenBudget,
      });
    }
  }, [business]);

  return (
    <Dialog open={!!business} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Edit Business
          </DialogTitle>
          <DialogDescription>
            {business?.name} · {business?.phone ?? "no phone"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-tier">Subscription Tier</Label>
            <Select
              value={state.subscriptionTier}
              onValueChange={(v) => setState((s) => ({ ...s, subscriptionTier: v }))}
            >
              <SelectTrigger id="edit-tier" className="w-full">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="pro_ai">Pro + AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Subscription Status</Label>
            <Select
              value={state.subscriptionStatus}
              onValueChange={(v) => setState((s) => ({ ...s, subscriptionStatus: v }))}
            >
              <SelectTrigger id="edit-status" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">AI Enabled</div>
              <div className="text-xs text-muted-foreground">
                Toggle AI features for this business
              </div>
            </div>
            <Switch
              checked={state.aiEnabled}
              onCheckedChange={(v) => setState((s) => ({ ...s, aiEnabled: v }))}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-daily">Daily Limit</Label>
              <Input
                id="edit-daily"
                type="number"
                min={0}
                value={state.aiDailyLimit}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    aiDailyLimit: parseInt(e.target.value || "0", 10) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-monthly">Monthly Limit</Label>
              <Input
                id="edit-monthly"
                type="number"
                min={0}
                value={state.aiMonthlyLimit}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    aiMonthlyLimit: parseInt(e.target.value || "0", 10) || 0,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tokens">Token Budget</Label>
              <Input
                id="edit-tokens"
                type="number"
                min={0}
                value={state.aiTokenBudget}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    aiTokenBudget: parseInt(e.target.value || "0", 10) || 0,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button onClick={() => onSave(state)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Business list
// ──────────────────────────────────────────────────────────────────────────

function BusinessList({
  businesses,
  onToggleAI,
  onEdit,
  togglingId,
}: {
  businesses: BusinessRow[];
  onToggleAI: (b: BusinessRow) => void;
  onEdit: (b: BusinessRow) => void;
  togglingId: string | null;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.owner?.phone.toLowerCase().includes(q) ||
        b.owner?.name?.toLowerCase().includes(q)
    );
  }, [businesses, query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Businesses
              <Badge variant="secondary" className="text-xs">
                {formatNumber(filtered.length)}
                {filtered.length !== businesses.length && ` / ${formatNumber(businesses.length)}`}
              </Badge>
            </CardTitle>
            <CardDescription>All businesses on the platform</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {businesses.length === 0
              ? "No businesses registered yet."
              : "No businesses match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((b) => (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{b.name}</span>
                    <TierBadge tier={b.subscription.tier} />
                    <StatusBadge status={b.subscription.status} />
                    {b.ai.enabled && (
                      <Badge
                        variant="outline"
                        className="border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                      >
                        <Sparkles className="h-3 w-3" /> AI
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{b.phone ?? b.owner?.phone ?? "—"}</span>
                    <span>·</span>
                    <span>{formatNumber(b.usage.products)} products</span>
                    <span>·</span>
                    <span>{formatNumber(b.usage.sales)} sales</span>
                    <span>·</span>
                    <span className="text-purple-600 dark:text-purple-400">
                      AI: {formatNumber(b.usage.aiUsageThisMonth.calls)} calls ·{" "}
                      {formatBDT(b.usage.aiUsageThisMonth.cost)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant={b.ai.enabled ? "default" : "outline"}
                    disabled={togglingId === b.id}
                    onClick={() => onToggleAI(b)}
                    className={
                      b.ai.enabled
                        ? "bg-purple-500 hover:bg-purple-600 text-white"
                        : ""
                    }
                  >
                    {togglingId === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : b.ai.enabled ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                    {b.ai.enabled ? "AI On" : "AI Off"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEdit(b)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Top-level Dashboard
// ──────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Dashboard state
  const [businessesData, setBusinessesData] = useState<BusinessesData | null>(null);
  const [aiData, setAiData] = useState<AIUsageData | null>(null);
  const [cronData, setCronData] = useState<CronStatusData | null>(null);

  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Toggling / suspending / running job state (keyed by id)
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editBusiness, setEditBusiness] = useState<BusinessRow | null>(null);

  // Lightweight toast state
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Hydrate token from localStorage on mount
  useEffect(() => {
    setTokenState(getToken());
    setHydrated(true);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setLoadingAll(true);
    setError(null);
    try {
      const [biz, ai, cron] = await Promise.all([
        authFetch<BusinessesData>("/api/super-admin/businesses", token),
        authFetch<any>("/api/super-admin/ai-usage", token).then(normalizeAIUsage),
        authFetch<CronStatusData>("/api/cron/status", token),
      ]);
      setBusinessesData(biz);
      setAiData(ai);
      setCronData(cron);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (/unauthorized/i.test(msg)) {
        setToken(null);
        setTokenState(null);
      }
    } finally {
      setLoadingAll(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void refreshAll();
    }
  }, [token, refreshAll]);

  function handleLogin(newToken: string) {
    setToken(newToken);
    setTokenState(newToken);
  }

  function handleLogout() {
    setToken(null);
    setTokenState(null);
    setToken(null);
    setBusinessesData(null);
    setAiData(null);
    setCronData(null);
  }

  async function handleToggleAI(b: BusinessRow) {
    if (!token) return;
    setTogglingId(b.id);
    try {
      await authFetch(`/api/super-admin/businesses/${b.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ aiEnabled: !b.ai.enabled }),
      });
      notify("ok", `${b.name}: AI ${!b.ai.enabled ? "enabled" : "disabled"}`);
      await refreshAll();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Failed to toggle AI");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSuspendAI(id: string, name: string) {
    if (!token) return;
    setSuspendingId(id);
    try {
      await authFetch(`/api/super-admin/businesses/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ aiEnabled: false }),
      });
      notify("ok", `${name}: AI suspended`);
      await refreshAll();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Failed to suspend AI");
    } finally {
      setSuspendingId(null);
    }
  }

  async function handleRunJob(jobName: string) {
    if (!token) return;
    setRunningJob(jobName);
    try {
      await authFetch(`/api/super-admin/trigger-cron/${jobName}`, token, {
        method: "POST",
      });
      notify("ok", `Job "${jobName}" triggered successfully`);
      // Give it a moment to write a CronJobLog row, then refresh
      setTimeout(() => void refreshAll(), 800);
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Failed to run job");
    } finally {
      setRunningJob(null);
    }
  }

  async function handleSaveEdit(state: EditState) {
    if (!token || !editBusiness) return;
    setSaving(true);
    try {
      await authFetch(`/api/super-admin/businesses/${editBusiness.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          subscriptionTier: state.subscriptionTier,
          subscriptionStatus: state.subscriptionStatus,
          aiEnabled: state.aiEnabled,
          aiDailyLimit: state.aiDailyLimit,
          aiMonthlyLimit: state.aiMonthlyLimit,
          aiTokenBudget: state.aiTokenBudget,
        }),
      });
      notify("ok", `${editBusiness.name} updated`);
      setEditBusiness(null);
      await refreshAll();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Failed to update business");
    } finally {
      setSaving(false);
    }
  }

  // ── Render: login screen until we hydrate + have a token ──
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const summary = businessesData?.summary ?? null;
  const abuseFlags = aiData?.abuseFlags ?? [];
  const aiNormalized = aiData ?? (null as AIUsageData | null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight sm:text-lg">
                Super Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                InventoryOS Platform Control
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
              Help
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshAll()}
              disabled={loadingAll}
            >
              {loadingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Summary cards */}
        <SummaryCards summary={summary} />

        {/* Phase 5: Operations Health Dashboard (top — most actionable) */}
        <Phase5OpsCard token={token!} />

        {/* Abuse alerts (only if there are flags) */}
        <AbuseAlertsCard
          flags={abuseFlags}
          thresholds={aiData?.abuseThresholds}
          onSuspend={handleSuspendAI}
          suspendingId={suspendingId}
        />

        {/* Row: AI Cost Today + Top Spenders + SQL Router */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {aiNormalized && <AICostTodayCard data={aiNormalized} />}
          {aiNormalized && <TopSpendersCard data={aiNormalized} />}
          {aiNormalized && <SQLRouterCard data={aiNormalized} />}
        </div>

        {/* Row: Feature usage + 7-day usage + Background jobs */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {aiNormalized && <FeatureUsageCard data={aiNormalized} />}
          {aiNormalized && <Usage7DaysCard data={aiNormalized} />}
          {cronData && (
            <BackgroundJobsCard
              jobs={cronData.jobs}
              onRunNow={handleRunJob}
              runningJob={runningJob}
            />
          )}
        </div>

        {/* Phase 1: AI Configuration (tunable cost-control knobs) */}
        <AiConfigCard token={token!} />

        {/* Phase 4: Kill-Switch + Notification Recipients */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <KillSwitchCard token={token!} />
          <NotificationRecipientsCard token={token!} />
        </div>

        {/* Phase B: Generated Reports Viewer */}
        <GeneratedReportsViewer token={token!} />

        {/* Business list */}
        {businessesData && (
          <BusinessList
            businesses={businessesData.businesses}
            onToggleAI={handleToggleAI}
            onEdit={(b) => setEditBusiness(b)}
            togglingId={togglingId}
          />
        )}
      </main>

      {/* Edit dialog */}
      <EditBusinessDialog
        business={editBusiness}
        onClose={() => setEditBusiness(null)}
        onSave={handleSaveEdit}
        saving={saving}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            className={cn(
              "fixed bottom-6 left-1/2 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg",
              toast.kind === "ok"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            )}
          >
            {toast.kind === "ok" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4: Super Admin Help off-canvas */}
      <SuperAdminHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
