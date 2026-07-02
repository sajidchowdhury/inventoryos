"use client";

// ── AI Configuration Card ──
// Phase 1 super-admin UI for editing AI cost-control knobs.
//
// Reads from GET /api/super-admin/ai-config
// Writes to PUT /api/super-admin/ai-config
//
// Each of the 4 LLM features has:
//   - maxOutputTokens (max_tokens on the LLM call, 64-8192)
//   - maxInputBatches (expiry-optimizer only: row cap on batch query, 1-500)
//   - maxInputProducts (product-assistant only: cap on products array, 1-100)

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings2,
  Save,
  RotateCcw,
  Loader2,
  Check,
  AlertCircle,
  Zap,
  Clock,
  Package,
  Pill,
  ScanLine,
  X,
} from "lucide-react";

interface AiConfigValue {
  feature: string;
  maxOutputTokens: number;
  maxInputBatches: number | null;
  maxInputProducts: number | null;
  maxInputImages: number | null;
  updatedAt?: string;
  updatedBy?: string | null;
}

interface AiConfigResponse {
  success: boolean;
  configs: AiConfigValue[];
  defaults?: Record<string, any>;
}

const FEATURE_META: Record<
  string,
  { label: string; icon: any; description: string; color: string }
> = {
  chat: {
    label: "AI Chat",
    icon: Zap,
    description: "Natural-language Q&A about pharmacy data. Default 1024 tokens (~700 words).",
    color: "text-emerald-600",
  },
  insights: {
    label: "AI Insights",
    icon: Clock,
    description: "Daily business health analysis with JSON insights + recommendations. Default 2048 tokens.",
    color: "text-blue-600",
  },
  "expiry-optimizer": {
    label: "AI Expiry Optimizer",
    icon: Package,
    description: "Analyzes near-expiry batches and recommends actions. Default 2048 tokens + 50 batch cap.",
    color: "text-amber-600",
  },
  "product-assistant": {
    label: "AI Product Assistant",
    icon: Pill,
    description: "Generate descriptions + check drug interactions. Default 512 tokens + 20 med cap.",
    color: "text-purple-600",
  },
  "shelf-scanner": {
    label: "AI Shelf Scanner",
    icon: ScanLine,
    description: "Vision model that detects medicines from shelf photos. Default 2048 tokens + 3 photo cap.",
    color: "text-teal-600",
  },
};

export function AiConfigCard({ token }: { token: string }) {
  const [configs, setConfigs] = useState<AiConfigValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // feature name being saved
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AiConfigResponse = await res.json();
      setConfigs(data.configs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI config");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  // Local edit state: map of feature → { maxOutputTokens, maxInputBatches, maxInputProducts }
  const [edits, setEdits] = useState<Record<string, any>>({});

  // Initialize edits when configs load
  useEffect(() => {
    const newEdits: Record<string, any> = {};
    for (const cfg of configs) {
      newEdits[cfg.feature] = {
        maxOutputTokens: cfg.maxOutputTokens,
        maxInputBatches: cfg.maxInputBatches,
        maxInputProducts: cfg.maxInputProducts,
        maxInputImages: cfg.maxInputImages,
      };
    }
    setEdits(newEdits);
  }, [configs]);

  const handleSave = async (feature: string) => {
    setSaving(feature);
    setError(null);
    setToast(null);
    try {
      const updates = edits[feature];
      const body: any = { feature };
      // Find the original to compare
      const orig = configs.find((c) => c.feature === feature);
      if (orig) {
        if (updates.maxOutputTokens !== orig.maxOutputTokens) {
          body.maxOutputTokens = Number(updates.maxOutputTokens);
        }
        if (updates.maxInputBatches !== orig.maxInputBatches) {
          body.maxInputBatches =
            updates.maxInputBatches === null || updates.maxInputBatches === ""
              ? null
              : Number(updates.maxInputBatches);
        }
        if (updates.maxInputProducts !== orig.maxInputProducts) {
          body.maxInputProducts =
            updates.maxInputProducts === null || updates.maxInputProducts === ""
              ? null
              : Number(updates.maxInputProducts);
        }
        if (updates.maxInputImages !== orig.maxInputImages) {
          body.maxInputImages =
            updates.maxInputImages === null || updates.maxInputImages === ""
              ? null
              : Number(updates.maxInputImages);
        }
      }

      const res = await fetch("/api/super-admin/ai-config", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setToast(`Saved ${feature} config`);
      await loadConfigs();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset ALL AI configurations to defaults? This cannot be undone.")) return;
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-config", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setToast("All AI configs reset to defaults");
      await loadConfigs();
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const handleFieldChange = (feature: string, field: string, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [feature]: {
        ...prev[feature],
        [field]: value === "" ? null : value,
      },
    }));
  };

  const isDirty = (feature: string) => {
    const edit = edits[feature];
    const orig = configs.find((c) => c.feature === feature);
    if (!edit || !orig) return false;
    return (
      Number(edit.maxOutputTokens) !== orig.maxOutputTokens ||
      Number(edit.maxInputBatches) !== (orig.maxInputBatches ?? null) ||
      Number(edit.maxInputProducts) !== (orig.maxInputProducts ?? null) ||
      Number(edit.maxInputImages) !== (orig.maxInputImages ?? null)
    );
  };

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <Settings2 className="h-5 w-5" />
          AI Configuration
        </CardTitle>
        <CardDescription>
          Tunable cost-control knobs for the 5 LLM features. Changes take effect on
          the next AI call — no redeploy required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {configs.map((cfg) => {
                const meta = FEATURE_META[cfg.feature] || {
                  label: cfg.feature,
                  icon: Settings2,
                  description: "",
                  color: "",
                };
                const Icon = meta.icon;
                const dirty = isDirty(cfg.feature);
                return (
                  <motion.div
                    key={cfg.feature}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border p-4 transition-colors ${
                      dirty
                        ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/10"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Icon className={`mt-0.5 h-5 w-5 ${meta.color}`} />
                        <div>
                          <div className="font-medium">{meta.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {meta.description}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSave(cfg.feature)}
                        disabled={!dirty || saving === cfg.feature}
                      >
                        {saving === cfg.feature ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="mr-1 h-3 w-3" />
                        )}
                        Save
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <Label htmlFor={`${cfg.feature}-maxTokens`} className="text-xs">
                          Max Output Tokens
                        </Label>
                        <Input
                          id={`${cfg.feature}-maxTokens`}
                          type="number"
                          min={64}
                          max={8192}
                          value={edits[cfg.feature]?.maxOutputTokens ?? ""}
                          onChange={(e) =>
                            handleFieldChange(cfg.feature, "maxOutputTokens", e.target.value)
                          }
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Range: 64–8192</p>
                      </div>

                      {cfg.feature === "expiry-optimizer" && (
                        <div>
                          <Label htmlFor={`${cfg.feature}-maxBatches`} className="text-xs">
                            Max Batches per Call
                          </Label>
                          <Input
                            id={`${cfg.feature}-maxBatches`}
                            type="number"
                            min={1}
                            max={500}
                            value={edits[cfg.feature]?.maxInputBatches ?? ""}
                            onChange={(e) =>
                              handleFieldChange(cfg.feature, "maxInputBatches", e.target.value)
                            }
                            className="mt-1"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">Range: 1–500</p>
                        </div>
                      )}

                      {cfg.feature === "product-assistant" && (
                        <div>
                          <Label htmlFor={`${cfg.feature}-maxProducts`} className="text-xs">
                            Max Meds per Interaction Check
                          </Label>
                          <Input
                            id={`${cfg.feature}-maxProducts`}
                            type="number"
                            min={1}
                            max={100}
                            value={edits[cfg.feature]?.maxInputProducts ?? ""}
                            onChange={(e) =>
                              handleFieldChange(cfg.feature, "maxInputProducts", e.target.value)
                            }
                            className="mt-1"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">Range: 1–100</p>
                        </div>
                      )}

                      {cfg.feature === "shelf-scanner" && (
                        <div>
                          <Label htmlFor={`${cfg.feature}-maxImages`} className="text-xs">
                            Max Photos per Scan
                          </Label>
                          <Input
                            id={`${cfg.feature}-maxImages`}
                            type="number"
                            min={1}
                            max={10}
                            value={edits[cfg.feature]?.maxInputImages ?? ""}
                            onChange={(e) =>
                              handleFieldChange(cfg.feature, "maxInputImages", e.target.value)
                            }
                            className="mt-1"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">Range: 1–10</p>
                        </div>
                      )}
                    </div>

                    {cfg.updatedAt && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Last updated: {new Date(cfg.updatedAt).toLocaleString()}
                        {cfg.updatedBy ? ` by ${cfg.updatedBy}` : ""}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reset all to defaults
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void loadConfigs()}>
                Refresh
              </Button>
            </div>

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
