"use client";

// /admin/deploy/page.tsx — Deployment Status & System Info
// Shows live status of system info, DB/SMTP/Build, and the auto-detected
// configuration checklist. Manual Hostinger setup steps, environment
// variables table, and the quick deploy guide were removed to keep this
// page focused on live server status.

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
  Server, Database, Mail, Clock, ShieldCheck,
  Terminal, Zap, HardDrive, Cpu, Activity, Rocket,
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
                <Rocket className="h-5 w-5 text-primary" />
                Deployment Readiness
              </CardTitle>
              <CardDescription>
                {data?.summary.overallPercent === 100
                  ? "All checks passed. Ready to go live!"
                  : "Complete these checks before going live."}
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
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
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
                <Server className="h-5 w-5 text-primary" />
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
                : "Not configured — set up in System Config → SMTP tab"}
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

          {/* Configuration Checklist (full list — manual Hostinger steps + env vars + deploy guide were removed to keep this page focused on live status) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Configuration Checklist
                <Badge variant="outline" className="ml-auto">
                  {data.summary.autoOk}/{data.summary.autoTotal} passed
                </Badge>
              </CardTitle>
              <CardDescription>Live status of every check the server can detect automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.checklist.map((item, i) => {
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
    <div className="rounded-lg border border-border p-3">
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
