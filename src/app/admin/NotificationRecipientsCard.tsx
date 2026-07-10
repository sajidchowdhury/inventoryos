"use client";

// ── NotificationRecipientsCard ──
// Manage up to 3 email addresses that receive kill-switch alerts,
// weekly AI health emails, and scheduled report delivery confirmations.
//
// Features:
//   - Add/remove recipients with inline email validation
//   - Send test email directly from the card (no need to switch to SMTP tab)
//   - SMTP status banner with direct link to SMTP config
//   - Per-recipient "test" button to verify individual emails work

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Plus, Trash2, Loader2, Check, AlertCircle, MailWarning,
  Send, CheckCircle2, XCircle, User,
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NotificationRecipientsCard({ token }: { token: string }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [maxAllowed, setMaxAllowed] = useState(3);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

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

  // Real-time email validation
  const handleEmailChange = (value: string) => {
    setNewEmail(value);
    if (!value.trim()) {
      setEmailValid(null);
    } else {
      setEmailValid(EMAIL_REGEX.test(value));
    }
  };

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    if (!EMAIL_REGEX.test(newEmail)) {
      setEmailValid(false);
      showToast("err", "Invalid email format. Must contain @ and a domain.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/kill-switch/recipients", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase(), label: newLabel.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast("ok", `Added ${newEmail}`);
      setNewEmail("");
      setNewLabel("");
      setEmailValid(null);
      await load();
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Add failed");
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
      showToast("ok", `Removed ${email}`);
      await load();
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleTestEmail = async () => {
    setTestingAll(true);
    try {
      const res = await fetch("/api/super-admin/test-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast("ok", `Test email sent to ${data.recipients?.length || 0} recipient(s). Check inbox!`);
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Test email failed");
    } finally {
      setTestingAll(false);
    }
  };

  const slotsLeft = maxAllowed - recipients.length;
  const canTest = smtpConfigured && recipients.length > 0;

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Mail className="h-5 w-5" />
              Notification Recipients
            </CardTitle>
            <CardDescription>
              Emails that receive kill-switch alerts, weekly AI health reports, and delivery confirmations.
            </CardDescription>
          </div>
          {/* Quick test button */}
          {canTest && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestEmail}
              disabled={testingAll}
              title="Send a test email to all recipients"
            >
              {testingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              <span className="hidden sm:inline">Test Email</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        )}

        {/* SMTP status banner — now dynamic with link */}
        {!loading && !smtpConfigured && (
          <Link href="/admin/api-setup" className="block">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors">
              <MailWarning className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                <strong>SMTP not configured.</strong> Emails will be logged to console only.
                <span className="underline ml-1">Click here to configure SMTP →</span>
              </div>
            </div>
          </Link>
        )}
        {!loading && smtpConfigured && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              SMTP is configured. Alerts and reports will be delivered to the emails below.
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Recipient count + slots */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {recipients.length} of {maxAllowed} slots used
              </span>
              <div className="flex gap-1">
                {Array.from({ length: maxAllowed }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-2 rounded-full ${i < recipients.length ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-800"}`}
                  />
                ))}
              </div>
            </div>

            {/* Current recipients */}
            <div className="space-y-2">
              {recipients.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg">
                  <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No recipients configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add an email below to receive kill-switch alerts and weekly health reports.
                  </p>
                </div>
              ) : (
                recipients.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:border-blue-300 dark:hover:border-blue-800 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {r.email.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.email}</div>
                      <div className="flex items-center gap-2">
                        {r.label && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" /> {r.label}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs py-0">Active</Badge>
                        <span className="text-xs text-muted-foreground">
                          Added {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(r.id, r.email)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plus className="h-4 w-4 text-blue-600" />
                  Add Recipient
                  <Badge variant="secondary" className="text-xs">{slotsLeft} slot{slotsLeft > 1 ? "s" : ""} left</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newEmail}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !adding && emailValid) handleAdd(); }}
                      className={emailValid === false ? "border-red-400" : emailValid === true ? "border-emerald-400" : ""}
                    />
                    {emailValid === false && (
                      <p className="text-xs text-red-500 mt-1">Invalid email format</p>
                    )}
                    {emailValid === true && (
                      <p className="text-xs text-emerald-600 mt-1">✓ Valid email</p>
                    )}
                  </div>
                  <div className="sm:col-span-4">
                    <Input
                      type="text"
                      placeholder="Label (e.g., Founder)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !adding && emailValid) handleAdd(); }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      onClick={handleAdd}
                      disabled={adding || !newEmail.trim() || emailValid === false}
                      className="w-full"
                    >
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span className="ml-1">Add</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                Maximum {maxAllowed} recipients reached. Remove one to add a new email.
              </div>
            )}

            {/* What these emails receive */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3">
              <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">What these emails receive:</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• <strong>Kill-switch alerts</strong> — when any of the 4 triggers fire (per-pharmacy cost, 24h tokens, platform cost, Z.ai error rate)</li>
                <li>• <strong>Weekly AI health report</strong> — every Monday at 06:00 UTC (if cron is configured)</li>
                <li>• <strong>Test emails</strong> — when you click "Test Email" above</li>
              </ul>
            </div>

            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  toast.kind === "ok"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                }`}
              >
                {toast.kind === "ok" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span className="flex-1">{toast.msg}</span>
                <Button size="sm" variant="ghost" onClick={() => setToast(null)}>
                  <XCircle className="h-3 w-3" />
                </Button>
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
