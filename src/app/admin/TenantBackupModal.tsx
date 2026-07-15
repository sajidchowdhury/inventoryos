"use client";

// TenantBackupModal — shows last 7 tenant-wise backups for a single business.
// Lets the super admin create new backups, download existing ones, and restore.
//
// SUPER-ADMIN ONLY — never rendered in client admin panels or main software.
//
// Props:
//   businessId     — the tenant to back up
//   businessName   — shown in the header + used as the restore confirmation
//   token          — super-admin bearer token for API auth
//   open           — controlled open state
//   onOpenChange   — controlled open state setter

import { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Database, Download, RotateCcw, Plus, Loader2, AlertTriangle,
  CheckCircle2, Clock, HardDrive, FileJson, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BackupRecord {
  id: string;
  fileName: string;
  fileSizeKb: number;
  recordCount: number;
  tableCount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

interface Props {
  businessId: string;
  businessName: string;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantBackupModal({ businessId, businessName, token, open, onOpenChange }: Props) {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Load the list of backups whenever the modal opens
  const loadBackups = useCallback(async () => {
    if (!token || !businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/super-admin/businesses/${businessId}/backups`, {
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
  }, [token, businessId]);

  useEffect(() => {
    if (open) {
      void loadBackups();
      setToast(null);
    }
  }, [open, loadBackups]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/super-admin/businesses/${businessId}/backups`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual" }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ kind: "ok", msg: `Backup created — ${data.backup.recordCount} records, ${(data.backup.fileSizeKb / 1024).toFixed(2)} MB` });
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

  const handleDownload = async (backup: BackupRecord) => {
    setDownloadingId(backup.id);
    try {
      const res = await fetch(
        `/api/super-admin/businesses/${businessId}/backups/${backup.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
    if (!restoreId) return;
    if (restoreConfirm.trim() !== businessName.trim()) {
      setToast({ kind: "err", msg: `Type "${businessName}" exactly to confirm` });
      return;
    }
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/super-admin/businesses/${businessId}/backups/${restoreId}/restore`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ confirmName: restoreConfirm.trim() }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setToast({
          kind: "ok",
          msg: `Restore complete — ${data.recordsRestored} records restored. Pre-restore backup saved as safety net.`,
        });
        setRestoreId(null);
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
    if (reason === "pre-delete") return <Badge variant="danger" className="text-[9px]">pre-delete</Badge>;
    return <Badge variant="secondary" className="text-[9px]">manual</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Backup — {businessName}
          </DialogTitle>
          <DialogDescription>
            Last 7 backups are kept. Older backups are auto-deleted. Every restore creates a pre-restore backup first as a safety net.
          </DialogDescription>
        </DialogHeader>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileJson className="h-3 w-3" />
              {backups.length} / 7 backups
            </span>
            {backups.length > 0 && (
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatSize(backups.reduce((sum, b) => sum + b.fileSizeKb, 0))} total
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBackups()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Backup
            </Button>
          </div>
        </div>

        {/* Backup list */}
        {loading && backups.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Database className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No backups yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Create Backup" to make your first one.</p>
          </div>
        ) : (
          <div className="space-y-2">
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
                      <span>{b.recordCount} records</span>
                      <span>{b.tableCount} tables</span>
                      <span>by {b.createdBy}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void handleDownload(b)}
                      disabled={downloadingId === b.id}
                      title="Download JSON"
                    >
                      {downloadingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => { setRestoreId(b.id); setRestoreConfirm(""); }}
                      disabled={restoring}
                      title="Restore from this backup"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Restore confirmation inline panel */}
        {restoreId && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Restore from backup?
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                  This will <strong>REPLACE ALL CURRENT DATA</strong> for <strong>{businessName}</strong> with the backup snapshot.
                  A pre-restore backup will be created automatically first, so you can roll back if needed.
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-amber-900 dark:text-amber-200">
                Type <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">{businessName}</code> to confirm:
              </label>
              <Input
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setRestoreId(null); setRestoreConfirm(""); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleRestore()}
                disabled={restoring || restoreConfirm.trim() !== businessName.trim()}
              >
                {restoring ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Restoring...</> : <><RotateCcw className="h-3.5 w-3.5" /> Restore Now</>}
              </Button>
            </div>
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
      </DialogContent>
    </Dialog>
  );
}
