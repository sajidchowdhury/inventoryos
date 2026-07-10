"use client";

// ── KillSwitchCard ──
// Phase 4 super-admin UI for the platform-wide kill-switch.
//
// Shows:
//   - Red banner if any kill-switch is currently active
//   - 4 threshold editors (value + enable/disable toggle)
//   - Active kill-switches with reset buttons
//   - History table (last 20 triggers)

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
  ShieldAlert, Save, RotateCcw, Loader2, Check, AlertCircle,
  Power, Activity, Zap, DollarSign, Clock,
} from "lucide-react";

interface Threshold {
  trigger: string;
  threshold: number;
  unit: string;
  isActive: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
}

interface KillSwitchRecord {
  id: string;
  trigger: string;
  thresholdValue: number;
  actualValue: number;
  triggeredAt: string;
  triggeredBy: string;
  isActive: boolean;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  notes: string | null;
}

const TRIGGER_META: Record<string, {
  label: string; icon: any; color: string; description: string;
}> = {
  per_pharmacy_monthly: {
    label: "Per-Pharmacy Monthly Cost",
    icon: DollarSign,
    color: "text-red-600",
    description: "Max BDT a single pharmacy can spend on AI per month. Blocks that pharmacy only. Manual reset.",
  },
  per_pharmacy_24h: {
    label: "Per-Pharmacy 24h Tokens",
    icon: Clock,
    color: "text-orange-600",
    description: "Max tokens a single pharmacy can use in 24 hours. Blocks that pharmacy only. Manual reset. Early warning before circuit breaker trips.",
  },
  platform_monthly: {
    label: "Platform Monthly Cost",
    icon: Activity,
    color: "text-purple-600",
    description: "Max BDT the ENTIRE platform can spend on AI per month. Blocks ALL pharmacies. Manual reset.",
  },
  zai_error_rate: {
    label: "Z.ai Error Rate (1h)",
    icon: Zap,
    color: "text-blue-600",
    description: "Max % of AI calls that can fail in 1 hour. Blocks ALL pharmacies in fallback-only mode. AUTO-RECOVERS when error rate drops below 1% for 30 min.",
  },
};

export function KillSwitchCard({ token }: { token: string }) {
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [active, setActive] = useState<KillSwitchRecord[]>([]);
  const [history, setHistory] = useState<KillSwitchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { threshold: number; isActive: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [thrRes, ksRes] = await Promise.all([
        fetch("/api/super-admin/kill-switch/thresholds", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/super-admin/kill-switch", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const thrData = await thrRes.json();
      const ksData = await ksRes.json();
      if (thrData.thresholds) {
        setThresholds(thrData.thresholds);
        const newEdits: Record<string, { threshold: number; isActive: boolean }> = {};
        for (const t of thrData.thresholds) {
          newEdits[t.trigger] = { threshold: t.threshold, isActive: t.isActive };
        }
        setEdits(newEdits);
      }
      if (ksData.active) setActive(ksData.active);
      if (ksData.history) setHistory(ksData.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveThreshold = async (trigger: string) => {
    setSaving(trigger);
    setError(null);
    try {
      const edit = edits[trigger];
      const res = await fetch("/api/super-admin/kill-switch/thresholds", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trigger, threshold: Number(edit.threshold), isActive: edit.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast(`Saved ${trigger} threshold`);
      await load();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (id: string) => {
    if (!confirm("Reset this kill-switch? AI features will be re-enabled for the affected scope.")) return;
    setResetting(id);
    try {
      const res = await fetch(`/api/super-admin/kill-switch/${id}/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setToast("Kill-switch reset successfully");
      await load();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(null);
    }
  };

  const isDirty = (trigger: string) => {
    const edit = edits[trigger];
    const orig = thresholds.find((t) => t.trigger === trigger);
    if (!edit || !orig) return false;
    return Number(edit.threshold) !== orig.threshold || edit.isActive !== orig.isActive;
  };

  return (
    <Card className={active.length > 0 ? "border-red-500 dark:border-red-900 ring-2 ring-red-500/20" : "border-purple-200 dark:border-purple-900"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <ShieldAlert className="h-5 w-5" />
          Kill-Switch
          {active.length > 0 && (
            <Badge variant="destructive" className="ml-2 animate-pulse">
              {active.length} ACTIVE
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Platform-wide AI kill-switch with 4 configurable triggers. When a trigger fires,
          AI is blocked and all notification recipients are emailed.
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

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Active kill-switch banner */}
            {active.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/20 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  <span className="font-bold text-red-700 dark:text-red-400">
                    {active.length} Kill-Switch{active.length > 1 ? "es" : ""} Active — AI Blocked
                  </span>
                </div>
                <div className="space-y-2">
                  {active.map((ks) => {
                    const meta = TRIGGER_META[ks.trigger] || { label: ks.trigger, icon: AlertCircle, color: "" };
                    return (
                      <div key={ks.id} className="flex items-center justify-between rounded-md bg-white dark:bg-slate-900 p-3 border border-red-200 dark:border-red-900">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{meta.label}</div>
                          <div className="text-xs text-muted-foreground">
                            Actual: {ks.actualValue.toFixed(1)} / Threshold: {ks.thresholdValue}
                            {" · "}
                            Scope: {ks.triggeredBy === "platform" ? "ALL pharmacies" : ks.triggeredBy.substring(0, 12) + "..."}
                            {" · "}
                            Triggered: {new Date(ks.triggeredAt).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReset(ks.id)}
                          disabled={resetting === ks.id}
                        >
                          {resetting === ks.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1 h-3 w-3" />
                          )}
                          Reset
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Threshold editors */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Trigger Thresholds</h4>
              {thresholds.map((t) => {
                const meta = TRIGGER_META[t.trigger] || { label: t.trigger, icon: AlertCircle, color: "", description: "" };
                const Icon = meta.icon;
                const dirty = isDirty(t.trigger);
                return (
                  <div
                    key={t.trigger}
                    className={`rounded-lg border p-3 transition-colors ${
                      dirty ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/10" :
                      t.isActive ? "border-slate-200 dark:border-slate-800" : "border-slate-200 dark:border-slate-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <Icon className={`mt-0.5 h-4 w-4 ${meta.color}`} />
                        <div className="flex-1">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {meta.label}
                            {!t.isActive && <Badge variant="secondary" className="text-xs">DISABLED</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{meta.description}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSaveThreshold(t.trigger)}
                        disabled={!dirty || saving === t.trigger}
                      >
                        {saving === t.trigger ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                        Save
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={edits[t.trigger]?.threshold ?? 0}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [t.trigger]: { ...prev[t.trigger], threshold: Number(e.target.value) },
                            }))
                          }
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">{t.unit}</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edits[t.trigger]?.isActive ?? true}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [t.trigger]: { ...prev[t.trigger], isActive: e.target.checked },
                            }))
                          }
                          className="rounded"
                        />
                        <Power className="h-3.5 w-3.5" />
                        Active
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recent History (last 20)</h4>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Trigger</th>
                        <th className="text-right p-2">Actual</th>
                        <th className="text-right p-2">Threshold</th>
                        <th className="text-left p-2">Time</th>
                        <th className="text-center p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((ks) => (
                        <tr key={ks.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2">{ks.trigger}</td>
                          <td className="p-2 text-right">{ks.actualValue.toFixed(1)}</td>
                          <td className="p-2 text-right">{ks.thresholdValue}</td>
                          <td className="p-2">{new Date(ks.triggeredAt).toLocaleString()}</td>
                          <td className="p-2 text-center">
                            {ks.isActive ? (
                              <Badge variant="destructive" className="text-xs">ACTIVE</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Reset</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
