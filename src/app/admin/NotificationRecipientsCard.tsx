"use client";

// ── NotificationRecipientsCard ──
// Phase 4: Manage up to 3 email addresses that receive kill-switch alerts.

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Plus, Trash2, Loader2, Check, AlertCircle, MailWarning,
} from "lucide-react";

interface Recipient {
  id: string;
  email: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
}

interface RecipientsResponse {
  success: boolean;
  recipients: Recipient[];
  maxAllowed: number;
  smtpConfigured: boolean;
}

export function NotificationRecipientsCard({ token }: { token: string }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [maxAllowed, setMaxAllowed] = useState(3);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/kill-switch/recipients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: RecipientsResponse = await res.json();
      setRecipients(data.recipients || []);
      setMaxAllowed(data.maxAllowed || 3);
      setSmtpConfigured(data.smtpConfigured || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/kill-switch/recipients", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), label: newLabel.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast(`Added ${newEmail}`);
      setNewEmail("");
      setNewLabel("");
      await load();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from notification recipients?`)) return;
    try {
      const res = await fetch(`/api/super-admin/kill-switch/recipients?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setToast(`Removed ${email}`);
      await load();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const slotsLeft = maxAllowed - recipients.length;

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Mail className="h-5 w-5" />
          Notification Recipients
        </CardTitle>
        <CardDescription>
          Up to {maxAllowed} email addresses that receive kill-switch alerts. When a trigger fires,
          all active recipients are emailed simultaneously.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        )}

        {/* SMTP warning */}
        {!loading && !smtpConfigured && (
          <div className="flex items-start gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <MailWarning className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>SMTP not configured.</strong> Emails will be logged to NotificationLog instead of sent.
              To enable real email delivery, set these environment variables:{" "}
              <code className="text-xs">SMTP_HOST</code>,{" "}
              <code className="text-xs">SMTP_PORT</code>,{" "}
              <code className="text-xs">SMTP_USER</code>,{" "}
              <code className="text-xs">SMTP_PASS</code>.
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Current recipients */}
            <div className="space-y-2">
              {recipients.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No recipients configured. Kill-switch alerts will be logged only.
                </div>
              ) : (
                recipients.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{r.email}</div>
                        {r.label && <div className="text-xs text-muted-foreground">{r.label}</div>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(r.id, r.email)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </motion.div>
                ))
              )}
            </div>

            {/* Add new recipient */}
            {slotsLeft > 0 ? (
              <div className="space-y-3 border-t pt-4">
                <div className="text-sm font-medium">
                  Add Recipient ({slotsLeft} slot{slotsLeft > 1 ? "s" : ""} left)
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !adding) handleAdd(); }}
                    className="flex-1"
                  />
                  <Input
                    type="text"
                    placeholder="Label (optional)"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !adding) handleAdd(); }}
                    className="flex-1"
                  />
                  <Button onClick={handleAdd} disabled={adding || !newEmail.trim()}>
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                Maximum {maxAllowed} recipients reached. Remove one to add a new email.
              </div>
            )}

            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              >
                <Check className="h-4 w-4" />
                <span>{toast}</span>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
