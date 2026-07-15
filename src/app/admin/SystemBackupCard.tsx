"use client";

// SystemBackupCard — system-wide backup/restore controls for the super admin.
// Lives on the /admin dashboard. Two buttons (Backup + Restore) + history table.
//
// SUPER-ADMIN ONLY — never rendered in client admin panels or main software.

import { useEffect, useState, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Database, Download, Upload, Loader2, AlertTriangle, CheckCircle2,
  HardDrive, Clock, RefreshCw, RotateCcw, FileArchive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemBackupRecord {
  id: string;
  fileName: string;
  fileSizeKb: number;
  format: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

interface Props {
  token: string;
}

export function SystemBackupCard({ token }: Props) {
  const [backups, setBackups] = useState<SystemBackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const loadBackups = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/backups", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/super-admin/backups", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual" }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          kind: "ok",
          msg: `System backup created — ${(data.backup.fileSizeKb / 1024).toFixed(2)} MB`,
        });
        await loadBackups();
      } else {
        setToast({ kind: "err", msg: data.error || "Failed to create backup" });
      }
    } catch {
      setToast({ kind: "err", msg: "Network error — failed to create backup" });
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup: SystemBackupRecord) => {
    setDownloadingId(backup.id);
    try {
      const res = await fetch(`/api/super-admin/backups/${backup.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ kind: "ok", msg: "Download started" });
    } catch {
      setToast({ kind: "err", msg: "Download failed" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      setToast({ kind: "err", msg: "Select a .sql backup file first" });
      return;
    }
    if (restoreConfirm.trim() !== "RESTORE ALL") {
      setToast({ kind: "err", msg: 'Type "RESTORE ALL" exactly to confirm' });
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", restoreFile);
      formData.append("confirmPhrase", restoreConfirm.trim());

      const res = await fetch("/api/super-admin/backups/restore", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          kind: "ok",
          msg: "System restore complete. A pre-restore backup was created as a safety net. Reload the page to see restored data.",
        });
        setRestoreModalOpen(false);
        setRestoreFile(null);
        setRestoreConfirm("");
        await loadBackups();
      } else {
        setToast({ kind: "err", msg: data.errorMessage || data.error || "Restore failed" });
      }
    } catch {
      setToast({ kind: "err", msg: "Network error — restore failed" });
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (kb: number): string => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const reasonBadge = (reason: string) => {
    if (reason === "pre-restore") return <Badge variant="warning" className="text-[9px]">pre-restore</Badge>;
    if (reason === "scheduled") return <Badge variant="info" className="text-[9px]">scheduled</Badge>;
    return <Badge variant="secondary" className="text-[9px]">manual</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" />
            System Backup & Restore
          </CardTitle>
          <CardDescription>
            Full-database pg_dump snapshots (last 10 kept). For disaster recovery only —
            use per-client backups for surgical restores. Restore requires typing RESTORE ALL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="gap-1.5"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {creating ? "Creating..." : "Backup Full Database"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRestoreModalOpen(true)}
              className="gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400"
            >
              <Upload className="h-4 w-4" />
              Restore Database
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadBackups()}
              disabled={loading}
              title="Refresh"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          {/* Stats row */}
          {backups.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileArchive className="h-3 w-3" />
                {backups.length} / 10 backups
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatSize(backups.reduce((sum, b) => sum + b.fileSizeKb, 0))} total
              </span>
            </div>
          )}

          {/* Backup history */}
          {loading && backups.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <Database className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No system backups yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Backup Full Database" to create your first snapshot.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {backups.map((b, idx) => (
                <div
                  key={b.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    idx === 0 ? "border-success-border bg-success/30" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono truncate">{b.fileName}</span>
                        {idx === 0 && <Badge variant="success" className="text-[9px]">latest</Badge>}
                        {reasonBadge(b.reason)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> {formatDate(b.createdAt)}
                        </span>
                        <span>{formatSize(b.fileSizeKb)}</span>
                        <span>by {b.createdBy}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void handleDownload(b)}
                      disabled={downloadingId === b.id}
                      title="Download .sql"
                    >
                      {downloadingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm flex items-start gap-2",
                toast.kind === "ok"
                  ? "border-success-border bg-success/50 text-success-foreground"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {toast.kind === "ok"
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span className="flex-1">{toast.msg}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore modal */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Restore Full Database
            </DialogTitle>
            <DialogDescription>
              Upload a .sql backup file (pg_dump custom format) to replace the entire database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Danger warning */}
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-destructive">DANGER ZONE</p>
                <p className="text-xs text-destructive/90 mt-1">
                  This will <strong>REPLACE THE ENTIRE DATABASE</strong> — all tenants, all users, all data.
                  A pre-restore backup will be created automatically first, so you can roll back if needed.
                  Requires <code className="font-mono bg-destructive/20 px-1 py-0.5 rounded">pg_restore</code> installed on the server.
                </p>
              </div>
            </div>

            {/* File picker */}
            <div>
              <label className="text-xs font-medium flex items-center gap-1 mb-1">
                <Upload className="h-3 w-3" /> Backup file (.sql, pg_dump custom format)
              </label>
              <Input
                type="file"
                accept=".sql,.sql.gz,application/octet-stream"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              {restoreFile && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Selected: {restoreFile.name} ({(restoreFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Confirmation phrase */}
            <div>
              <label className="text-xs font-medium flex items-center gap-1 mb-1">
                Type <code className="font-mono bg-muted px-1 py-0.5 rounded">RESTORE ALL</code> to confirm:
              </label>
              <Input
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                placeholder="RESTORE ALL"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setRestoreModalOpen(false); setRestoreFile(null); setRestoreConfirm(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleRestore()}
                disabled={restoring || !restoreFile || restoreConfirm.trim() !== "RESTORE ALL"}
              >
                {restoring ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Restoring...</>
                ) : (
                  <><RotateCcw className="h-4 w-4" /> Restore Now</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
