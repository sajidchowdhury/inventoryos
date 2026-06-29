"use client";

// /admin/api-setup/page.tsx — API Setup page with 6 tabs.
// Phase 2: Consolidates ALL cross-project infrastructure config in one place.
//
// Tabs:
//   1. SMTP — email config status + Send Test Email button
//   2. AI — Z.ai config + per-feature max_tokens (AiConfigCard)
//   3. Database — connection status + latency + PgBouncer + Redis
//   4. Cron — CRON_SECRET status + all 7 jobs with schedules + last-run
//   5. Alerts — notification recipients (up to 3 emails)
//   6. Kill-Switch — 4 trigger thresholds + active alerts + history

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Activity, Database, Clock, Bell, ShieldAlert,
  CheckCircle2, XCircle, Loader2, Send, AlertCircle, RefreshCw,
  Settings, Zap, Save,
} from "lucide-react";
import { useAdmin } from "../AdminContext";
import { AiConfigCard } from "../AiConfigCard";
import { KillSwitchCard } from "../KillSwitchCard";
import { NotificationRecipientsCard } from "../NotificationRecipientsCard";

// ── Types ──
interface HealthData {
  status: string;
  uptime: number;
  checks: {
    database: { status: string; latencyMs: number };
    redis: { status: string; configured: boolean; connected: boolean };
  };
  version?: string;
  environment?: string;
}

interface CronStatusData {
  success: boolean;
  jobs: Array<{
    jobName: string;
    schedule: string;
    description: string;
    latestRun: {
      status: string;
      startedAt: string;
      durationMs: number | null;
      errorMessage: string | null;
    } | null;
    totalRuns: number;
  }>;
}

// ── Main page ──
export default function ApiSetupPage() {
  const { token, notify } = useAdmin();
  const [activeTab, setActiveTab] = useState("smtp");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
        <TabsTrigger value="smtp" className="flex flex-col items-center gap-1 py-2 text-xs">
          <Mail className="h-4 w-4" />
          SMTP
        </TabsTrigger>
        <TabsTrigger value="ai" className="flex flex-col items-center gap-1 py-2 text-xs">
          <Zap className="h-4 w-4" />
          AI
        </TabsTrigger>
        <TabsTrigger value="database" className="flex flex-col items-center gap-1 py-2 text-xs">
          <Database className="h-4 w-4" />
          Database
        </TabsTrigger>
        <TabsTrigger value="cron" className="flex flex-col items-center gap-1 py-2 text-xs">
          <Clock className="h-4 w-4" />
          Cron
        </TabsTrigger>
        <TabsTrigger value="alerts" className="flex flex-col items-center gap-1 py-2 text-xs">
          <Bell className="h-4 w-4" />
          Alerts
        </TabsTrigger>
        <TabsTrigger value="kill-switch" className="flex flex-col items-center gap-1 py-2 text-xs">
          <ShieldAlert className="h-4 w-4" />
          Kill-Switch
        </TabsTrigger>
      </TabsList>

      <TabsContent value="smtp" className="space-y-4">
        <SmtpTab token={token!} notify={notify} />
      </TabsContent>

      <TabsContent value="ai" className="space-y-4">
        <AiConfigCard token={token!} />
      </TabsContent>

      <TabsContent value="database" className="space-y-4">
        <DatabaseTab />
      </TabsContent>

      <TabsContent value="cron" className="space-y-4">
        <CronTab token={token!} />
      </TabsContent>

      <TabsContent value="alerts" className="space-y-4">
        <NotificationRecipientsCard token={token!} />
      </TabsContent>

      <TabsContent value="kill-switch" className="space-y-4">
        <KillSwitchCard token={token!} />
      </TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════
// SMTP TAB
// ═══════════════════════════════════════════════════
function SmtpTab({ token, notify }: { token: string; notify: (kind: "ok" | "err", msg: string) => void }) {
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    source: string;
    config: any;
    envFallback: any;
  } | null>(null);
  const [form, setForm] = useState({
    host: "",
    port: "587",
    user: "",
    password: "",
    fromEmail: "",
    fromName: "InventoryOS",
    isActive: true,
  });

  const loadSmtpConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/smtp-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSmtpStatus(data);
      if (data.config) {
        setForm({
          host: data.config.host || "",
          port: String(data.config.port || 587),
          user: data.config.user || "",
          password: data.config.password || "", // masked if already set
          fromEmail: data.config.fromEmail || "",
          fromName: data.config.fromName || "InventoryOS",
          isActive: data.config.isActive ?? true,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSmtpConfig();
    // Check recipient count
    fetch("/api/super-admin/kill-switch/recipients", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRecipientCount(data.recipients?.length ?? 0))
      .catch(() => setRecipientCount(0));
  }, [token, loadSmtpConfig]);

  const handleSave = async () => {
    if (!form.host || !form.user) {
      notify("err", "Host and User are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/smtp-config", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host,
          port: parseInt(form.port),
          user: form.user,
          password: form.password || undefined, // don't send if empty (keep existing)
          fromEmail: form.fromEmail || null,
          fromName: form.fromName,
          isActive: form.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      notify("ok", "SMTP configuration saved. Email delivery is now active.");
      await loadSmtpConfig(); // reload to show updated state
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/super-admin/test-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      notify("ok", `Test email sent to ${data.recipients?.length || 0} recipient(s)`);
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Test email failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Mail className="h-5 w-5" />
          SMTP / Email Configuration
        </CardTitle>
        <CardDescription>
          Configure SMTP for: kill-switch alerts, weekly AI health emails, and scheduled report delivery.
          Settings are saved to the database and take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Status banner */}
            <div className={`rounded-lg border-2 p-3 ${smtpStatus?.configured ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/10"}`}>
              <div className="flex items-center gap-2">
                {smtpStatus?.configured ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )}
                <span className="font-medium text-sm">
                  {smtpStatus?.configured
                    ? `SMTP configured via ${smtpStatus.source === "database" ? "database (editable below)" : "environment variables"}`
                    : "SMTP NOT configured — emails will be logged to console only"}
                </span>
              </div>
              {smtpStatus?.source === "env" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Currently using environment variables. Save the form below to switch to database config
                  (which can be edited from this panel without restarting the server).
                </p>
              )}
            </div>

            {/* SMTP config form */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">SMTP Host *</label>
                  <Input
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Port *</label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                    placeholder="587"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Username (Email) *</label>
                  <Input
                    type="email"
                    value={form.user}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                    placeholder="noreply@inventoryos.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Password / App Password {smtpStatus?.config ? "(leave blank to keep current)" : "*"}
                  </label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={smtpStatus?.config ? "•••••••• (unchanged)" : "Your app password"}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">From Email (optional)</label>
                  <Input
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                    placeholder="Defaults to username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">From Name (optional)</label>
                  <Input
                    value={form.fromName}
                    onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                    placeholder="InventoryOS"
                    className="mt-1"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (uncheck to disable email delivery)
              </label>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || !form.host || !form.user}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save SMTP Configuration
              </Button>
            </div>

            {/* Gmail setup guide */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">Gmail Setup Guide (Free SMTP)</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Enable 2-Factor Authentication on your Gmail account</li>
                <li>Go to Google Account → Security → App Passwords</li>
                <li>Generate a new app password for "Mail"</li>
                <li>Use that 16-character password as the Password field above (not your Gmail password)</li>
                <li>Set Host=smtp.gmail.com, Port=587, Username=your@gmail.com</li>
                <li>Click "Save SMTP Configuration" — email delivery starts immediately</li>
              </ol>
            </div>

            {/* Test email section */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Test Email</span>
                {recipientCount !== null && (
                  recipientCount > 0 ? (
                    <Badge className="bg-emerald-100 text-emerald-700">{recipientCount} recipient(s)</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">No recipients — add in Alerts tab</Badge>
                  )
                )}
              </div>
              <Button onClick={handleTestEmail} disabled={sending || recipientCount === 0 || !smtpStatus?.configured}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Test Email
              </Button>
              {recipientCount === 0 && (
                <p className="text-xs text-red-600">Add at least one recipient in the Alerts tab before testing.</p>
              )}
              {!smtpStatus?.configured && (
                <p className="text-xs text-amber-600">Save SMTP configuration first before sending a test email.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// DATABASE TAB
// ═══════════════════════════════════════════════════
function DatabaseTab() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dbStatus = health?.checks?.database;
  const redisStatus = health?.checks?.redis;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-600" />
              Database & Cache Status
            </CardTitle>
            <CardDescription>Real-time connection status from /api/health</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : health ? (
          <>
            {/* Overall status */}
            <div className={`rounded-lg border-2 p-4 ${health.status === "ok" ? "border-emerald-300 bg-emerald-50/50" : health.status === "degraded" ? "border-amber-300 bg-amber-50/50" : "border-red-300 bg-red-50/50"}`}>
              <div className="flex items-center gap-2 mb-2">
                {health.status === "ok" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
                <span className="font-bold text-lg capitalize">{health.status}</span>
                <Badge variant="outline" className="ml-auto">Uptime: {Math.floor(health.uptime / 60)}min</Badge>
              </div>
              {health.version && <p className="text-xs text-muted-foreground">Version: {health.version}</p>}
              {health.environment && <p className="text-xs text-muted-foreground">Environment: {health.environment}</p>}
            </div>

            {/* Database detail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-sm">PostgreSQL</span>
                  {dbStatus?.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 ml-auto" />
                  )}
                </div>
                <div className="text-2xl font-bold">{dbStatus?.latencyMs ?? "—"}ms</div>
                <div className="text-xs text-muted-foreground">Connection latency</div>
                <div className="text-xs text-muted-foreground mt-1">Status: {dbStatus?.status ?? "unknown"}</div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-sm">Redis Cache</span>
                  {redisStatus?.connected ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-600 ml-auto" />
                  )}
                </div>
                <div className="text-2xl font-bold capitalize">{redisStatus?.status ?? "disabled"}</div>
                <div className="text-xs text-muted-foreground">
                  {redisStatus?.configured ? "Configured" : "Not configured (optional)"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {redisStatus?.connected ? "Connected" : "Using in-memory fallback"}
                </div>
              </div>
            </div>

            {/* PgBouncer info */}
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 p-4">
              <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-1">PgBouncer Connection Pooling</h4>
              <p className="text-xs text-muted-foreground">
                In production, PgBouncer sits between the app and PostgreSQL with transaction pooling mode
                (200 max clients, 20 default pool, 5 reserve). Configured in docker/pgbouncer/pgbouncer.ini.
                Two DATABASE_URLs: pooled (runtime) + DIRECT_DATABASE_URL (migrations).
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            Failed to load health data. Is the server running?
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// CRON TAB
// ═══════════════════════════════════════════════════
function CronTab({ token }: { token: string }) {
  const [data, setData] = useState<CronStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleTrigger = async (jobName: string) => {
    setTriggering(jobName);
    try {
      const res = await fetch(`/api/super-admin/trigger-cron/${jobName}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await load();
    } catch {
      // ignore
    } finally {
      setTriggering(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Background Jobs (Cron)
            </CardTitle>
            <CardDescription>
              7 automated jobs. External scheduler must trigger POST /api/cron/&lt;jobName&gt;
              with x-cron-secret header.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data?.jobs ? (
          <div className="space-y-2">
            {data.jobs.map((job) => {
              const isRunning = triggering === job.jobName;
              const lastStatus = job.latestRun?.status;
              return (
                <div key={job.jobName} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{job.jobName}</span>
                        {lastStatus === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        {lastStatus === "failed" && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                        {lastStatus === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{job.description}</div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{job.schedule}</span>
                        <span>{job.totalRuns} total runs</span>
                        {job.latestRun && (
                          <span>Last: {new Date(job.latestRun.startedAt).toLocaleString()}</span>
                        )}
                        {job.latestRun?.durationMs != null && (
                          <span>{job.latestRun.durationMs}ms</span>
                        )}
                      </div>
                      {job.latestRun?.errorMessage && (
                        <div className="text-xs text-red-600 mt-1 font-mono truncate">{job.latestRun.errorMessage}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrigger(job.jobName)}
                      disabled={isRunning}
                    >
                      {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run Now"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">Failed to load cron status</div>
        )}

        {/* External scheduler guide */}
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4">
          <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">External Scheduler Setup</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Set CRON_SECRET env var, then configure an external scheduler (cron-job.org, Vercel Cron, systemd) to trigger these endpoints:
          </p>
          <div className="font-mono text-xs space-y-1 text-muted-foreground">
            <div>*/15 * * * * → POST /api/cron/report-schedule-checker</div>
            <div>*/5 * * * * → POST /api/cron/report-worker (Phase 4 optimized)</div>
            <div>* * * * * → POST /api/cron/report-delivery-worker</div>
            <div>0 * * * * → POST /api/cron/hourly-subscriptions</div>
            <div>0 1 * * * → POST /api/cron/nightly-stats</div>
            <div>30 1 * * * → POST /api/cron/daily-maintenance</div>
            <div>0 6 * * 1 → POST /api/cron/weekly-ai-health</div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">All require header: <code className="font-mono">x-cron-secret: YOUR_SECRET</code></p>
        </div>
      </CardContent>
    </Card>
  );
}
