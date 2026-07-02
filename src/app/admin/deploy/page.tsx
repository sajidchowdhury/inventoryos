"use client";

// /admin/deploy/page.tsx — Deployment Checklist & System Info
// Shows exactly what's configured, what's missing, and what manual steps
// are needed to deploy to Hostinger (or any VPS).

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
  Server, Database, Mail, Clock, ShieldCheck, Globe,
  Lock, Terminal, Zap, HardDrive, Cpu, Activity, Rocket,
} from "lucide-react";
import { useAdmin } from "../AdminContext";

interface ChecklistItem {
  id: string;
  label: string;
  status: "ok" | "missing" | "error" | "optional" | "manual" | "done";
  detail: string;
  autoDetected: boolean;
}

interface DeployData {
  systemInfo: {
    nodeVersion: string;
    platform: string;
    uptime: number;
    memoryUsage: number;
    environment: string;
    pid: number;
  };
  envVars: Array<{ name: string; value: string; configured: boolean; required: boolean; description: string }>;
  dbStatus: { connected: boolean; latencyMs: number; tableCount: number; error: string | null };
  smtpStatus: { configured: boolean; source: string };
  buildStatus: { hasStandalone: boolean; hasNextDir: boolean };
  checklist: ChecklistItem[];
  summary: {
    autoOk: number;
    autoTotal: number;
    manualDone: number;
    manualTotal: number;
    overallPercent: number;
  };
}

const STATUS_META: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  ok: { color: "text-emerald-600", bg: "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10", icon: CheckCircle2, label: "OK" },
  missing: { color: "text-red-600", bg: "border-red-200 bg-red-50/50 dark:bg-red-950/10", icon: XCircle, label: "Missing" },
  error: { color: "text-red-600", bg: "border-red-200 bg-red-50/50 dark:bg-red-950/10", icon: AlertCircle, label: "Error" },
  optional: { color: "text-blue-600", bg: "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10", icon: Activity, label: "Optional" },
  manual: { color: "text-amber-600", bg: "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10", icon: Clock, label: "Manual" },
  done: { color: "text-emerald-600", bg: "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10", icon: CheckCircle2, label: "Done" },
};

export default function DeployPage() {
  const { apiFetch } = useAdmin();
  const [data, setData] = useState<DeployData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/super-admin/deploy-status");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      {/* Progress banner */}
      <Card className={data?.summary.overallPercent === 100 ? "border-emerald-300" : "border-amber-300"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-purple-600" />
                Deployment Readiness
              </CardTitle>
              <CardDescription>
                {data?.summary.overallPercent === 100
                  ? "All checks passed. Ready to go live!"
                  : "Complete these steps before going live on Hostinger."}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${data?.summary.overallPercent === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                {data?.summary.overallPercent ?? 0}%
              </div>
              <div className="text-xs text-muted-foreground">
                {data ? `${data.summary.autoOk + data.summary.manualDone}/${data.summary.autoTotal + data.summary.manualTotal} steps` : "Loading..."}
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${data?.summary.overallPercent === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${data?.summary.overallPercent ?? 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5 text-purple-600" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <InfoTile icon={Cpu} label="Node.js" value={data.systemInfo.nodeVersion} />
                <InfoTile icon={Terminal} label="Platform" value={data.systemInfo.platform} />
                <InfoTile icon={Activity} label="Environment" value={data.systemInfo.environment} />
                <InfoTile icon={Clock} label="Uptime" value={`${Math.floor(data.systemInfo.uptime / 60)}min`} />
                <InfoTile icon={HardDrive} label="Memory" value={`${data.systemInfo.memoryUsage}MB`} />
                <InfoTile icon={Server} label="PID" value={String(data.systemInfo.pid)} />
              </div>
            </CardContent>
          </Card>

          {/* Database & Build Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatusTile
              icon={Database}
              label="Database"
              status={data.dbStatus.connected ? "ok" : "error"}
              detail={data.dbStatus.connected
                ? `Connected · ${data.dbStatus.latencyMs}ms · ${data.dbStatus.tableCount} tables`
                : data.dbStatus.error || "Not connected"}
            />
            <StatusTile
              icon={Mail}
              label="SMTP Email"
              status={data.smtpStatus.configured ? "ok" : "missing"}
              detail={data.smtpStatus.configured
                ? `Configured via ${data.smtpStatus.source}`
                : "Not configured — set up in API Setup → SMTP tab"}
            />
            <StatusTile
              icon={Zap}
              label="Build Status"
              status={data.buildStatus.hasStandalone ? "ok" : data.buildStatus.hasNextDir ? "ok" : "missing"}
              detail={data.buildStatus.hasStandalone
                ? "Standalone build ready for production"
                : data.buildStatus.hasNextDir
                ? "Build exists (.next/)"
                : "Run: npm run build"}
            />
          </div>

          {/* Auto-Detected Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Auto-Detected Checks
                <Badge variant="outline" className="ml-auto">
                  {data.summary.autoOk}/{data.summary.autoTotal} passed
                </Badge>
              </CardTitle>
              <CardDescription>These are checked automatically from the running application.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.checklist.filter(c => c.autoDetected).map((item, i) => {
                  const meta = STATUS_META[item.status] || STATUS_META.manual;
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${meta.bg}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                      </div>
                      <Badge className={`${meta.bg} ${meta.color} text-xs border-0`}>{meta.label}</Badge>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Manual Checklist (Hostinger-specific) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-5 w-5 text-amber-600" />
                Manual Setup Steps (Hostinger VPS)
                <Badge variant="outline" className="ml-auto">
                  {data.summary.manualDone}/{data.summary.manualTotal} done
                </Badge>
              </CardTitle>
              <CardDescription>These steps can't be auto-detected. Complete them on your Hostinger server.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.checklist.filter(c => !c.autoDetected).map((item, i) => {
                  const meta = STATUS_META[item.status] || STATUS_META.manual;
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`rounded-lg border p-4 ${meta.bg}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${meta.color}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.label}</span>
                            <Badge className={`${meta.bg} ${meta.color} text-xs border-0`}>{meta.label}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-mono bg-slate-100 dark:bg-slate-900 rounded p-2">
                            {item.detail}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Environment Variables */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-5 w-5 text-blue-600" />
                Environment Variables
              </CardTitle>
              <CardDescription>Check which env vars are set on this server. Required vars must be set for production.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Variable</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">Required?</th>
                      <th className="text-left p-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.envVars.map((v) => (
                      <tr key={v.name} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2 font-mono text-xs font-bold">{v.name}</td>
                        <td className="p-2">
                          {v.configured ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ Set</Badge>
                          ) : v.required ? (
                            <Badge className="bg-red-100 text-red-700 text-xs">✗ Missing</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not set</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          {v.required ? (
                            <Badge className="bg-red-100 text-red-700 text-xs">Required</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Optional</Badge>
                          )}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{v.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Hostinger Quick Deploy Guide */}
          <Card className="border-purple-200 dark:border-purple-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-5 w-5 text-purple-600" />
                Hostinger VPS Quick Deploy Guide
              </CardTitle>
              <CardDescription>Step-by-step commands to deploy InventoryOS on a Hostinger VPS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { step: 1, title: "SSH into your Hostinger VPS", cmd: "ssh root@your-server-ip" },
                  { step: 2, title: "Install Node.js 20+ (if not pre-installed)", cmd: "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\napt-get install -y nodejs" },
                  { step: 3, title: "Clone the repository", cmd: "cd /var/www\ngit clone https://github.com/sajidchowdhury/inventoryos.git\ncd inventoryos" },
                  { step: 4, title: "Install dependencies", cmd: "npm install" },
                  { step: 5, title: "Set up environment variables", cmd: "cp .env.example .env\nnano .env  # Edit with your values" },
                  { step: 6, title: "Set up database (SQLite for dev, PostgreSQL for prod)", cmd: "# For SQLite (dev):\n# DATABASE_URL=file:./db/custom.db\n# For PostgreSQL (prod):\n# Install PostgreSQL, create DB, set DATABASE_URL" },
                  { step: 7, title: "Run database migration", cmd: "npx prisma db push\nnpx prisma generate" },
                  { step: 8, title: "Seed initial data", cmd: "node scripts/seed-ai-config.js\nnode scripts/seed-kill-switch-defaults.js\nnode scripts/seed-report-scheduling.js" },
                  { step: 9, title: "Build the project", cmd: "npm run build" },
                  { step: 10, title: "Install PM2 (process manager)", cmd: "npm install -g pm2\npm2 start npm --name inventoryos -- start\npm2 save\npm2 startup  # Follow instructions" },
                  { step: 11, title: "Install Caddy (reverse proxy + SSL)", cmd: "apt install caddy\n# Edit /etc/caddy/Caddyfile:\n# yourdomain.com {\n#   reverse_proxy localhost:3000\n# }\nsystemctl restart caddy" },
                  { step: 12, title: "Set up cron jobs", cmd: "# Edit crontab:\ncrontab -e\n# Add these lines:\n# */2 * * * * curl -X POST -H 'x-cron-secret: YOUR_SECRET' http://localhost:3000/api/cron/report-worker\n# 0 * * * * curl -X POST -H 'x-cron-secret: YOUR_SECRET' http://localhost:3000/api/cron/report-schedule-checker\n# 0 * * * * curl -X POST -H 'x-cron-secret: YOUR_SECRET' http://localhost:3000/api/cron/hourly-subscriptions\n# 0 1 * * * curl -X POST -H 'x-cron-secret: YOUR_SECRET' http://localhost:3000/api/cron/nightly-stats\n# 30 1 * * * curl -X POST -H 'x-cron-secret: YOUR_SECRET' http://localhost:3000/api/cron/daily-maintenance" },
                  { step: 13, title: "Configure SMTP (from admin panel)", cmd: "# After deployment:\n# 1. Go to https://yourdomain.com/admin\n# 2. Login as superadmin\n# 3. Go to API Setup → SMTP tab\n# 4. Enter your Gmail SMTP credentials\n# 5. Click 'Save SMTP Configuration'" },
                  { step: 14, title: "Set up database backups", cmd: "# Add to crontab:\n# 0 2 * * * /var/www/inventoryos/scripts/backup/backup.sh" },
                  { step: 15, title: "Verify deployment", cmd: "curl http://localhost:3000/api/health\n# Should return {\"status\":\"ok\",...}" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center shrink-0 font-bold text-purple-600 text-sm">
                      {s.step}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{s.title}</div>
                      <pre className="mt-1 text-xs font-mono bg-slate-900 text-slate-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                        {s.cmd}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh Status
          </Button>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Failed to load deployment status. Try refreshing.
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Sub-components ──
function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-bold truncate">{value}</div>
    </div>
  );
}

function StatusTile({ icon: Icon, label, status, detail }: { icon: any; label: string; status: string; detail: string }) {
  const meta = STATUS_META[status] || STATUS_META.manual;
  const StatusIcon = meta.icon;
  return (
    <div className={`rounded-lg border-2 p-4 ${meta.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${meta.color}`} />
        <span className="font-medium text-sm">{label}</span>
        <StatusIcon className={`h-4 w-4 ml-auto ${meta.color}`} />
      </div>
      <div className={`text-xs ${meta.color}`}>{detail}</div>
    </div>
  );
}
