"use client";

// ── Shelf Scanner AI Config ──
// Editable prompts + performance tuning for Gemini, Z.ai, and future providers.
// Reads/writes shelf-scanner fields on GET/PUT /api/super-admin/ai-config

import { useCallback, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ScanLine,
  Save,
  RotateCcw,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";

interface ShelfConfig {
  feature: string;
  maxOutputTokens: number;
  maxInputImages: number | null;
  systemPrompt: string | null;
  userPromptTemplate: string | null;
  temperature: number | null;
  disableThinking: boolean | null;
  updatedAt?: string;
  updatedBy?: string | null;
}

interface PromptDefaults {
  systemPrompt: string;
  userPromptTemplate: string;
}

const MODEL_RECOMMENDATIONS = [
  {
    provider: "Google Gemini",
    model: "gemini-2.0-flash",
    badge: "Best value",
    note: "Fast, cheap, strong vision OCR. No thinking-token issues. Recommended default.",
  },
  {
    provider: "Google Gemini",
    model: "gemini-2.5-flash",
    badge: "Higher accuracy",
    note: "Better on hard labels. Keep “Disable thinking” ON below or it may return empty text.",
  },
  {
    provider: "Z.ai",
    model: "glm-ocr",
    badge: "Best for labels",
    note: "Specialized OCR for small text on boxes (English + Bangla). Two-step: OCR → JSON.",
  },
  {
    provider: "Z.ai",
    model: "glm-4.6v-flash",
    badge: "Fast vision",
    note: "Single-call multimodal vision. Good when glm-ocr is unavailable.",
  },
];

export function ShelfScannerConfigCard({ token }: { token: string }) {
  const [config, setConfig] = useState<ShelfConfig | null>(null);
  const [defaults, setDefaults] = useState<PromptDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [edit, setEdit] = useState({
    maxOutputTokens: "4096",
    maxInputImages: "3",
    systemPrompt: "",
    userPromptTemplate: "",
    temperature: "0.1",
    disableThinking: true,
    useCustomPrompts: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const shelf = (data.configs as ShelfConfig[]).find((c) => c.feature === "shelf-scanner");
      if (!shelf) throw new Error("shelf-scanner config not found");

      const promptDefaults = data.defaults?.["shelf-scanner"]?.promptDefaults as PromptDefaults | undefined;
      if (promptDefaults) {
        setDefaults(promptDefaults);
      }

      setConfig(shelf);
      const hasCustom = Boolean(shelf.systemPrompt?.trim() || shelf.userPromptTemplate?.trim());
      setEdit({
        maxOutputTokens: String(shelf.maxOutputTokens),
        maxInputImages: shelf.maxInputImages != null ? String(shelf.maxInputImages) : "3",
        systemPrompt: shelf.systemPrompt?.trim() || promptDefaults?.systemPrompt || "",
        userPromptTemplate: shelf.userPromptTemplate?.trim() || promptDefaults?.userPromptTemplate || "",
        temperature: String(shelf.temperature ?? 0.1),
        disableThinking: shelf.disableThinking ?? true,
        useCustomPrompts: hasCustom,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shelf scanner config");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        feature: "shelf-scanner",
        maxOutputTokens: Number(edit.maxOutputTokens),
        maxInputImages: Number(edit.maxInputImages),
        temperature: Number(edit.temperature),
        disableThinking: edit.disableThinking,
      };

      if (edit.useCustomPrompts) {
        body.systemPrompt = edit.systemPrompt.trim() || null;
        body.userPromptTemplate = edit.userPromptTemplate.trim() || null;
      } else {
        body.resetPrompts = true;
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
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast("Shelf scanner settings saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPrompts = () => {
    if (!defaults) return;
    setEdit((prev) => ({
      ...prev,
      useCustomPrompts: false,
      systemPrompt: defaults.systemPrompt,
      userPromptTemplate: defaults.userPromptTemplate,
    }));
  };

  return (
    <Card className="border-teal-200 dark:border-teal-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
          <ScanLine className="h-5 w-5" />
          Shelf Scanner — Prompts &amp; Performance
        </CardTitle>
        <CardDescription>
          Tune prompts and performance for whichever vision provider is active (Gemini or Z.ai).
          Changes apply on the next scan — no redeploy needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Model recommendations */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Recommended models (set in AI Vision Providers above)
              </div>
              <div className="space-y-2">
                {MODEL_RECOMMENDATIONS.map((m) => (
                  <div key={`${m.provider}-${m.model}`} className="flex flex-wrap items-start gap-2 text-xs">
                    <Badge variant="outline" className="font-mono shrink-0">{m.model}</Badge>
                    <Badge className="bg-teal-100 text-teal-800 shrink-0">{m.badge}</Badge>
                    <span className="text-muted-foreground">{m.note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Performance (all providers)</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Max Output Tokens</Label>
                  <Input
                    type="number"
                    min={512}
                    max={8192}
                    value={edit.maxOutputTokens}
                    onChange={(e) => setEdit((p) => ({ ...p, maxOutputTokens: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">4096 recommended for crowded shelves</p>
                </div>
                <div>
                  <Label className="text-xs">Max Photos per Scan</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={edit.maxInputImages}
                    onChange={(e) => setEdit((p) => ({ ...p, maxInputImages: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Temperature</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={edit.temperature}
                    onChange={(e) => setEdit((p) => ({ ...p, temperature: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">0.1 = consistent OCR (recommended)</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Disable Gemini thinking</div>
                  <p className="text-xs text-muted-foreground">
                    Prevents gemini-2.5+ from burning output tokens on internal reasoning and returning empty JSON.
                    Ignored by Z.ai. Keep ON unless you know you need deep reasoning.
                  </p>
                </div>
                <Switch
                  checked={edit.disableThinking}
                  onCheckedChange={(v) => setEdit((p) => ({ ...p, disableThinking: v }))}
                />
              </div>

              <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  JSON output mode is always enabled for shelf scans (Gemini <code className="font-mono">responseMimeType</code>, Z.ai <code className="font-mono">response_format</code>) so medicine names parse reliably.
                </span>
              </div>
            </div>

            {/* Prompts */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Custom prompts</div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="use-custom-prompts" className="text-xs text-muted-foreground">
                    Use custom prompts
                  </Label>
                  <Switch
                    id="use-custom-prompts"
                    checked={edit.useCustomPrompts}
                    onCheckedChange={(v) => setEdit((p) => ({ ...p, useCustomPrompts: v }))}
                  />
                </div>
              </div>

              {edit.useCustomPrompts && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5 border border-amber-200">
                  Custom prompts must ask for a JSON <code className="font-mono">medicines</code> array with <code className="font-mono">brand_name</code> and <code className="font-mono">full_name</code> fields.
                  If scans return empty, turn off custom prompts or click Reset prompts to defaults.
                </p>
              )}

              <div>
                <Label className="text-xs">System prompt</Label>
                <Textarea
                  value={edit.systemPrompt}
                  onChange={(e) => setEdit((p) => ({ ...p, systemPrompt: e.target.value, useCustomPrompts: true }))}
                  disabled={!edit.useCustomPrompts}
                  rows={10}
                  className="mt-1 font-mono text-xs"
                  placeholder="Instructions for the vision model…"
                />
              </div>

              <div>
                <Label className="text-xs">User prompt template</Label>
                <Textarea
                  value={edit.userPromptTemplate}
                  onChange={(e) => setEdit((p) => ({ ...p, userPromptTemplate: e.target.value, useCustomPrompts: true }))}
                  disabled={!edit.useCustomPrompts}
                  rows={3}
                  className="mt-1 font-mono text-xs"
                  placeholder="Use {{imageCount}} for the number of photos…"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Placeholder <code className="font-mono">{"{{imageCount}}"}</code> is replaced with the actual photo count.
                </p>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={handleResetPrompts}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset prompts to defaults
              </Button>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              {config?.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  Last updated: {new Date(config.updatedAt).toLocaleString()}
                  {config.updatedBy ? ` by ${config.updatedBy}` : ""}
                </span>
              )}
              <Button onClick={handleSave} disabled={saving} className="ml-auto">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save shelf scanner settings
              </Button>
            </div>

            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800"
              >
                <Check className="h-4 w-4" />
                {toast}
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
