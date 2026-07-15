"use client";

// BackupAuditLogCard — shows recent backup/restore actions from BackupAuditLog.
// Lives on the /admin dashboard under SystemBackupCard.
//
// SUPER-ADMIN ONLY — never rendered in client admin panels or main software.
//
// Each row shows: action (backup/restore), scope (tenant/system), business name
// if tenant-scoped, file name, status (success/failed), duration, size,
// triggered-by username, time ago. Failed entries are highlighted red.

import { useEffect, useState, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, HardDrive, Database, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  action: string;        // 'backup' | 'restore'
  scope: string;         // 'tenant' | 'system'
  businessId: string | null;
  fileName: string | null;
  status: string;        // 'success' | 'failed'
  durationMs: number | null;
  recordCount: number | null;
  fileSizeKb: number | null;
  errorMessage: string | null;
  triggeredBy: string;
  createdAt: string;
}

interface Props {
  token: string;
}

export function BackupAuditLogCard({ token }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/backups/audit-log?limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const formatSize = (kb: number | null): string => {
    if (kb === null) return "—";
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  };

  const formatTimeAgo = (iso: string): string => {
    const d = new Date(iso);
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              Backup Audit Log
            </CardTitle>
            <CardDescription>
              Last 20 backup + restore actions — who did what, when, and whether it succeeded.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void loadLogs()}
            disabled={loading}
            title="Refresh"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No backup actions yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Once you create or restore a backup, the action will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => {
              const isFailed = log.status === "failed";
              const isRestore = log.action === "restore";
              const isTenant = log.scope === "tenant";

              return (
                <div
                  key={log.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    isFailed
                      ? "border-destructive/30 bg-destructive/10"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                      isFailed
                        ? "bg-destructive/20 text-destructive"
                        : isRestore
                        ? "bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
                        : "bg-success/40 text-success-foreground"
                    )}>
                      {isFailed ? (
                        <XCircle className="h-4 w-4" />
                      ) : isRestore ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {isRestore ? "Restore" : "Backup"}
                          {" · "}
                          {isTenant ? "tenant" : "system"}
                        </span>
                        <Badge
                          variant={isFailed ? "destructive" : "success"}
                          className="text-[9px]"
                        >
                          {log.status}
                        </Badge>
                        {log.businessId && (
                          <Badge variant="outline" className="text-[9px] font-mono">
                            {log.businessId.slice(-8)}
                          </Badge>
                        )}
                      </div>

                      {/* Detail row */}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                        {log.fileName && (
                          <span className="font-mono truncate max-w-[200px]" title={log.fileName || ""}>
                            {log.fileName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDuration(log.durationMs)}
                        </span>
                        {!isRestore && log.fileSizeKb !== null && (
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-2.5 w-2.5" />
                            {formatSize(log.fileSizeKb)}
                          </span>
                        )}
                        {log.recordCount !== null && (
                          <span className="flex items-center gap-1">
                            <Database className="h-2.5 w-2.5" />
                            {log.recordCount} records
                          </span>
                        )}
                        <span>by {log.triggeredBy}</span>
                        <span>·</span>
                        <span>{formatTimeAgo(log.createdAt)}</span>
                      </div>

                      {/* Error message (if failed) */}
                      {isFailed && log.errorMessage && (
                        <p className="text-[10px] text-destructive mt-1.5 font-mono bg-destructive/10 rounded p-1.5">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
