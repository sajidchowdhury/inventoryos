"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Crown, Sparkles, Check, X, Zap, TrendingUp,
  Bot, MessageSquare, Package, Brain, Activity, DollarSign, AlertTriangle,
  Users, Boxes, ShieldCheck, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// ── Tier styling ──
const tierTheme: Record<string, {
  gradient: string;
  ring: string;
  badge: string;
  accent: string;
  text: string;
  glow: string;
  icon: typeof Crown;
}> = {
  free: {
    gradient: "from-emerald-500 via-teal-500 to-emerald-600",
    ring: "ring-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accent: "text-emerald-600",
    text: "text-white",
    glow: "shadow-emerald-500/20",
    icon: Crown,
  },
  pro: {
    gradient: "from-blue-500 via-sky-500 to-blue-600",
    ring: "ring-blue-200",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    accent: "text-blue-600",
    text: "text-white",
    glow: "shadow-blue-500/20",
    icon: Zap,
  },
  pro_ai: {
    gradient: "from-purple-500 via-violet-500 to-fuchsia-600",
    ring: "ring-purple-200",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    accent: "text-purple-600",
    text: "text-white",
    glow: "shadow-purple-500/20",
    icon: Sparkles,
  },
};

const tierDisplay: Record<string, { name: string; tagline: string; monthlyPrice: number }> = {
  free: { name: "Free", tagline: "Starter plan for small pharmacies", monthlyPrice: 0 },
  pro: { name: "Pro", tagline: "Unlimited products & multi-user", monthlyPrice: 500 },
  pro_ai: { name: "Pro AI", tagline: "Full inventory + AI automation", monthlyPrice: 1000 },
};

// ── Feature comparison rows ──
const featureRows: { key: string; label: string; icon: typeof Check }[] = [
  { key: "reports", label: "Reports", icon: Activity },
  { key: "analytics", label: "Sales analytics", icon: TrendingUp },
  { key: "suppliers", label: "Suppliers", icon: Package },
  { key: "customerCredit", label: "Customer credit", icon: DollarSign },
  { key: "csvImport", label: "CSV import", icon: Boxes },
  { key: "auditTrail", label: "Audit trail", icon: ShieldCheck },
  { key: "aiInsights", label: "AI business insights", icon: Brain },
  { key: "aiChat", label: "AI chat assistant", icon: MessageSquare },
  { key: "smartReorder", label: "Smart reorder", icon: Bot },
  { key: "demandForecast", label: "Demand forecast", icon: TrendingUp },
  { key: "expiryOptimizer", label: "Expiry optimizer", icon: Sparkles },
];

const allTiers = ["free", "pro", "pro_ai"] as const;
const tierLimitsPreview: Record<string, { products: string; users: string; ai: string }> = {
  free: { products: "100", users: "1", ai: "—" },
  pro: { products: "∞", users: "∞", ai: "—" },
  pro_ai: { products: "∞", users: "∞", ai: "1,000/mo" },
};

// ── Helpers ──
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-BD");
}

interface FeatureUsage {
  feature: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface DayUsage {
  date: string;
  calls: number;
  tokens: number;
  cost: number;
  successes: number;
  failures: number;
}

interface SubscriptionData {
  subscription: {
    tier: string;
    tierLabel: string;
    tierPrice: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
  };
  limits: {
    maxProducts: number | null;
    multiUserEnabled: boolean;
    aiEnabled: boolean;
    aiDailyLimit: number;
    aiMonthlyLimit: number;
    aiTokenBudget: number;
    businessOverrides?: {
      aiEnabled: boolean | null;
      aiDailyLimit: number | null;
      aiMonthlyLimit: number | null;
      aiTokenBudget: number | null;
    };
  };
  features: Record<string, boolean>;
  usage: {
    products: { current: number; max: number | null; unlimited: boolean };
    users: { current: number; max: number | null; unlimited: boolean };
    ai: {
      callsToday: number;
      callsThisMonth: number;
      tokensThisMonth: number;
      costThisMonth: number;
      perFeature: FeatureUsage[];
      last7Days: DayUsage[];
      successFailure: { success: number; failure: number; successRate: number | null };
    } | null;
  };
}

export function SubscriptionStatus() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!businessId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/subscription`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load subscription");
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Loading state ──
  if (loading) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pharmacy-bg min-h-screen rounded-xl -mx-1 px-1 py-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shadow-pharmacy rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="shadow-pharmacy">
          <CardContent className="p-6 space-y-4">
            <div className="h-32 w-full skeleton rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 skeleton rounded-xl" />
              <div className="h-24 skeleton rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (error || !data) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pharmacy-bg min-h-screen rounded-xl -mx-1 px-1 py-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shadow-pharmacy rounded-full" onClick={() => setActiveView("profile")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Subscription</h1>
        </div>
        <Card className="border-rose-200 bg-rose-50/80 shadow-pharmacy">
          <CardContent className="p-5 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            <p className="text-sm text-rose-700">{error || "Failed to load subscription"}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fetchData()}>
              <RefreshCw className="h-3.5 w-3.5" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const { subscription, limits, features, usage } = data;
  const tier = subscription.tier || "free";
  const theme = tierTheme[tier] || tierTheme.free;
  const display = tierDisplay[tier] || tierDisplay.free;
  const TierIcon = theme.icon;
  const isAI = limits.aiEnabled && !!usage.ai;
  const ai = usage.ai;
  const maxCalls = limits.businessOverrides?.aiMonthlyLimit || limits.aiMonthlyLimit;
  const maxDaily = limits.businessOverrides?.aiDailyLimit || limits.aiDailyLimit;
  const maxTokens = limits.businessOverrides?.aiTokenBudget || limits.aiTokenBudget;

  // Usage percentages
  const dailyPct = ai && maxDaily ? Math.min(100, (ai.callsToday / maxDaily) * 100) : 0;
  const monthlyPct = ai && maxCalls ? Math.min(100, (ai.callsThisMonth / maxCalls) * 100) : 0;
  const tokenPct = ai && maxTokens ? Math.min(100, (ai.tokensThisMonth / maxTokens) * 100) : 0;
  const productPct = usage.products.unlimited ? 0 : usage.products.max ? Math.min(100, (usage.products.current / usage.products.max) * 100) : 0;

  // 7-day max for bar scaling
  const max7DayCalls = ai?.last7Days ? Math.max(1, ...ai.last7Days.map((d) => d.calls)) : 1;

  const successRate = ai?.successFailure?.successRate;
  const successRatePct = successRate !== null && successRate !== undefined ? Math.round(successRate * 100) : null;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen rounded-xl -mx-1 px-1 py-1">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy rounded-full" onClick={() => setActiveView("profile")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Subscription</h1>
          <p className="text-[11px] text-muted-foreground">Manage your plan &amp; AI usage</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 shadow-pharmacy rounded-full"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {/* ── Current plan card ── */}
      <Card className={cn(
        "stagger-in border-0 overflow-hidden shadow-pharmacy-xl bg-gradient-to-br relative",
        theme.gradient
      )}>
        {/* Decorative orbs */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <CardContent className="p-5 relative">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                <TierIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight">{display.name}</h2>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    subscription.status === "active" ? "bg-white/25 text-white" : "bg-white/15 text-white/80"
                  )}>
                    {subscription.status || "active"}
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-0.5">{display.tagline}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white leading-none">
                {subscription.tierPrice === 0 ? "Free" : formatBDT(subscription.tierPrice)}
              </p>
              {subscription.tierPrice > 0 && <p className="text-[10px] text-white/80 mt-0.5">per month</p>}
            </div>
          </div>

          {/* Dates & AI badge */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-2.5 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/70 text-[10px] uppercase tracking-wide font-semibold">
                <Calendar className="h-3 w-3" /> Started
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">{formatDate(subscription.startDate)}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-2.5 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/70 text-[10px] uppercase tracking-wide font-semibold">
                <Calendar className="h-3 w-3" /> Renews
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">{formatDate(subscription.endDate)}</p>
            </div>
          </div>

          {/* AI badge */}
          <div className="mt-3 flex items-center gap-2">
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
              isAI ? "bg-white/20 text-white border border-white/30" : "bg-white/10 text-white/70 border border-white/10"
            )}>
              {isAI ? <Sparkles className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {isAI ? "AI enabled" : "AI not included"}
            </div>
            {limits.multiUserEnabled && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/10">
                <Users className="h-3 w-3" /> Multi-user
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Product & user usage ── */}
      <div className="grid grid-cols-2 gap-3 stagger-in">
        <Card className="card-hover shadow-pharmacy">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Boxes className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Products</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(usage.products.current)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {usage.products.unlimited ? "∞" : formatNumber(usage.products.max ?? 0)}
              </span>
            </p>
            {!usage.products.unlimited && (
              <div className="mt-2">
                <Progress value={productPct} className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-emerald-500" />
                <p className="text-[10px] text-muted-foreground mt-1">{Math.round(productPct)}% used</p>
              </div>
            )}
            {usage.products.unlimited && <p className="text-[10px] text-emerald-600 mt-1">Unlimited</p>}
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Users</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatNumber(usage.users.current)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {usage.users.unlimited ? "∞" : formatNumber(usage.users.max ?? 0)}
              </span>
            </p>
            {usage.users.unlimited ? (
              <p className="text-[10px] text-blue-600 mt-2">Multi-user enabled</p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-2">Single user only</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── AI usage (only if enabled) ── */}
      {isAI && ai && (
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <h2 className="text-sm font-semibold tracking-tight">AI Usage</h2>
              </div>
              {successRatePct !== null && (
                <Badge className={cn(
                  "border-0 text-[10px] font-semibold",
                  successRatePct >= 90 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : successRatePct >= 70 ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                  : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                )}>
                  <Check className="h-3 w-3 mr-0.5" /> {successRatePct}% success
                </Badge>
              )}
            </div>

            {/* Calls today */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Calls today</span>
                <span className="font-mono text-muted-foreground">{ai.callsToday} / {maxDaily ? formatNumber(maxDaily) : "∞"}</span>
              </div>
              <Progress value={dailyPct} className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-purple-500" />
            </div>

            {/* Calls this month */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Calls this month</span>
                <span className="font-mono text-muted-foreground">{formatNumber(ai.callsThisMonth)} / {maxCalls ? formatNumber(maxCalls) : "∞"}</span>
              </div>
              <Progress value={monthlyPct} className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-violet-500" />
            </div>

            {/* Token budget */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Token usage</span>
                <span className="font-mono text-muted-foreground">
                  {formatNumber(ai.tokensThisMonth)} / {maxTokens ? formatNumber(maxTokens) : "∞"}
                </span>
              </div>
              <Progress value={tokenPct} className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-fuchsia-500" />
            </div>

            {/* Cost + success/failure */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-center">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-0.5" />
                <p className="text-sm font-bold text-emerald-700">{formatBDT(ai.costThisMonth)}</p>
                <p className="text-[9px] text-muted-foreground">Cost (month)</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-center">
                <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-0.5" />
                <p className="text-sm font-bold text-emerald-700">{formatNumber(ai.successFailure?.success ?? 0)}</p>
                <p className="text-[9px] text-muted-foreground">Successes</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-center">
                <X className="h-3.5 w-3.5 text-rose-600 mx-auto mb-0.5" />
                <p className="text-sm font-bold text-rose-700">{formatNumber(ai.successFailure?.failure ?? 0)}</p>
                <p className="text-[9px] text-muted-foreground">Failures</p>
              </div>
            </div>

            {/* 7-day trend bars */}
            {ai.last7Days && ai.last7Days.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">7-day activity</p>
                <div className="flex items-end justify-between gap-1 h-16">
                  {ai.last7Days.map((day, i) => {
                    const heightPct = (day.calls / max7DayCalls) * 100;
                    const dayLabel = new Date(day.date).toLocaleDateString("en-GB", { weekday: "short" }).charAt(0);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className="w-full bg-gradient-to-t from-purple-500 to-violet-400 rounded-t-md min-h-[2px] transition-all hover:from-purple-600 hover:to-violet-500"
                            style={{ height: `${Math.max(heightPct, 4)}%` }}
                            title={`${day.calls} calls · ${day.tokens} tokens`}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-feature breakdown */}
            {ai.perFeature && ai.perFeature.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Per feature (this month)</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {ai.perFeature.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30">
                      <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
                        <Sparkles className="h-3 w-3 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium capitalize truncate">{f.feature.replace(/_/g, " ")}</p>
                        <p className="text-[9px] text-muted-foreground">{formatNumber(f.calls)} calls · {formatNumber(f.tokens)} tokens</p>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-emerald-700 shrink-0">{formatBDT(f.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Feature comparison table ── */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Plan comparison
            </h2>
          </div>
          {/* Header row */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[11px] font-semibold border-b">
            <div className="p-2.5 text-muted-foreground">Feature</div>
            {allTiers.map((t) => {
              const tTheme = tierTheme[t];
              const isCurrent = t === tier;
              const TIcon = tTheme.icon;
              return (
                <div key={t} className={cn(
                  "p-2.5 text-center flex flex-col items-center gap-0.5",
                  isCurrent && "bg-muted/40"
                )}>
                  <div className={cn("h-5 w-5 rounded-full bg-gradient-to-br flex items-center justify-center", tTheme.gradient)}>
                    <TIcon className="h-3 w-3 text-white" />
                  </div>
                  <span className={cn(isCurrent ? tTheme.accent : "text-foreground")}>{tierDisplay[t].name}</span>
                  {isCurrent && <span className="text-[8px] text-muted-foreground font-normal">Current</span>}
                </div>
              );
            })}
          </div>
          {/* Limits preview */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[11px] border-b">
            <div className="p-2.5 text-muted-foreground font-medium">Max products</div>
            {allTiers.map((t) => (
              <div key={t} className={cn("p-2.5 text-center font-mono", t === tier && tierTheme[t].accent)}>
                {tierLimitsPreview[t].products}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[11px] border-b">
            <div className="p-2.5 text-muted-foreground font-medium">Users</div>
            {allTiers.map((t) => (
              <div key={t} className={cn("p-2.5 text-center font-mono", t === tier && tierTheme[t].accent)}>
                {tierLimitsPreview[t].users}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[11px] border-b">
            <div className="p-2.5 text-muted-foreground font-medium">AI calls</div>
            {allTiers.map((t) => (
              <div key={t} className={cn("p-2.5 text-center font-mono", t === tier && tierTheme[t].accent)}>
                {tierLimitsPreview[t].ai}
              </div>
            ))}
          </div>
          {/* Feature rows */}
          {featureRows.map((row, idx) => {
            const RowIcon = row.icon;
            return (
              <div key={row.key} className={cn(
                "grid grid-cols-[1.4fr_1fr_1fr_1fr] text-[11px] border-b last:border-0",
                idx % 2 === 1 && "bg-muted/20"
              )}>
                <div className="p-2.5 flex items-center gap-1.5 text-foreground/80">
                  <RowIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                  {row.label}
                </div>
                {allTiers.map((t) => {
                  // For free, use the feature flag from data.features when current; otherwise default tier config
                  const isAvailable = t === tier
                    ? !!features?.[row.key]
                    : isFeatureAvailableForTier(t, row.key);
                  return (
                    <div key={t} className={cn("p-2.5 flex items-center justify-center", t === tier && "bg-muted/40")}>
                      {isAvailable ? (
                        <div className={cn("h-5 w-5 rounded-full flex items-center justify-center bg-muted/40")}>
                          <Check className={cn("h-3 w-3", tierTheme[t].accent)} />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full flex items-center justify-center bg-muted/60">
                          <X className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Upgrade notice (only on free or pro) ── */}
      {tier !== "pro_ai" && (
        <Card className="stagger-in border-0 overflow-hidden shadow-pharmacy-lg bg-gradient-to-br from-purple-500 via-violet-500 to-fuchsia-600 relative">
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <CardContent className="p-5 relative space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {tier === "free" ? "Upgrade to Pro AI" : "Unlock AI features"}
                </h3>
                <p className="text-[11px] text-white/80">Smart reorder, demand forecast, AI insights &amp; more</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/90 flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15">
                <Check className="h-3 w-3" /> 1,000 AI calls/mo
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15">
                <Check className="h-3 w-3" /> Unlimited products
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15">
                <Check className="h-3 w-3" /> Multi-user
              </span>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-sm p-3 border border-white/15">
              <p className="text-[11px] text-white/90 leading-snug">
                <strong className="text-white">Contact your distributor to upgrade.</strong> Your plan can be activated within minutes — no card required.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ── Helper: default feature availability per tier (used for non-current tiers in comparison table) ──
function isFeatureAvailableForTier(tier: string, feature: string): boolean {
  const aiFeatures = ["aiInsights", "aiChat", "smartReorder", "demandForecast", "expiryOptimizer"];
  if (aiFeatures.includes(feature)) return tier === "pro_ai";
  // All non-AI features available on all tiers per feature-gate.ts
  return true;
}
