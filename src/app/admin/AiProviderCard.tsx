"use client";

// ── AiProviderCard ──
// Super-admin UI for managing which vision AI provider is active.
// Lets the founder set API keys for Gemini (free) and Z.ai (paid) and
// switch between them with one click — no redeploy needed.
//
// Reads from GET /api/super-admin/ai-providers
// Writes to PUT /api/super-admin/ai-providers

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
  Settings2, Save, Loader2, Check, AlertCircle, Sparkles, Key, Power, Eye, EyeOff,
} from "lucide-react";

interface ProviderInfo {
  provider: string;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
  baseUrl: string | null;
  isActive: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
}

const PROVIDER_META: Record<string, { label: string; description: string; color: string; link: string }> = {
  gemini: {
    label: "Google Gemini",
    description: "Free tier via Google AI Studio. Good for reading medicine labels. Model: gemini-2.0-flash.",
    color: "text-blue-600",
    link: "https://aistudio.google.com/apikey",
  },
  zai: {
    label: "Z.ai (GLM-4.6V)",
    description: "Paid Z.ai vision model. Higher accuracy, costs per token. Uses the z-ai-web-dev-sdk.",
    color: "text-purple-600",
    link: "https://z.ai",
  },
};

export function AiProviderCard({ token }: { token: string }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Edit state: map of provider → { apiKey, baseUrl, showKey }
  const [edits, setEdits] = useState<Record<string, { apiKey: string; baseUrl: string; showKey: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-providers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProviders(data.providers || []);
      // Initialize edit state
      const newEdits: Record<string, { apiKey: string; baseUrl: string; showKey: boolean }> = {};
      for (const p of data.providers || []) {
        newEdits[p.provider] = {
          apiKey: "", // don't prefill the key — user types a new one to replace
          baseUrl: p.baseUrl || "",
          showKey: false,
        };
      }
      setEdits(newEdits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveKey = async (provider: string) => {
    const edit = edits[provider];
    if (!edit || !edit.apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }
    setSaving(provider);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-providers", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: edit.apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast(`${PROVIDER_META[provider]?.label || provider} API key saved`);
      edit.apiKey = ""; // clear the input after save
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleActivate = async (provider: string) => {
    setSaving(provider + "-activate");
    setError(null);
    try {
      const res = await fetch("/api/super-admin/ai-providers", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider, isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast(`${PROVIDER_META[provider]?.label || provider} is now active`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setSaving(null);
    }
  };

  const toggleShowKey = (provider: string) => {
    setEdits((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], showKey: !prev[provider]?.showKey },
    }));
  };

  return (
    <Card className="border-teal-200 dark:border-teal-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
          <Sparkles className="h-5 w-5" />
          AI Vision Providers
        </CardTitle>
        <CardDescription>
          Control which AI provider powers the Shelf Scanner. Set an API key, then
          activate. Switch providers anytime — no redeploy needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((p) => {
              const meta = PROVIDER_META[p.provider] || { label: p.provider, description: "", color: "", link: "" };
              return (
                <motion.div
                  key={p.provider}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg border p-4 transition-colors ${
                    p.isActive
                      ? "border-teal-400 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-950/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Key className={`mt-0.5 h-5 w-5 ${meta.color}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{meta.label}</span>
                          {p.isActive && (
                            <Badge className="bg-teal-100 text-teal-700 text-[10px]">Active</Badge>
                          )}
                          {p.apiKeySet && !p.isActive && (
                            <Badge variant="outline" className="text-[10px]">Key set</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
                        {meta.link && (
                          <a href={meta.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline mt-1 inline-block">
                            Get API key →
                          </a>
                        )}
                      </div>
                    </div>
                    {p.apiKeyMasked && (
                      <code className="text-[11px] text-muted-foreground font-mono">{p.apiKeyMasked}</code>
                    )}
                  </div>

                  {/* API key input */}
                  <div className="space-y-2">
                    <Label className="text-xs">
                      {p.apiKeySet ? "Enter a new key to replace the existing one" : "API key"}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={edits[p.provider]?.showKey ? "text" : "password"}
                          value={edits[p.provider]?.apiKey ?? ""}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [p.provider]: { ...prev[p.provider], apiKey: e.target.value },
                            }))
                          }
                          placeholder={p.apiKeySet ? "•••••••• (saved)" : "Paste your API key here"}
                          className="pr-9 h-9 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowKey(p.provider)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {edits[p.provider]?.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        disabled={!edits[p.provider]?.apiKey?.trim() || saving === p.provider}
                        onClick={() => handleSaveKey(p.provider)}
                      >
                        {saving === p.provider ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save key
                      </Button>
                    </div>
                  </div>

                  {/* Activate button */}
                  <div className="mt-3 flex items-center justify-between">
                    {p.updatedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        Updated: {new Date(p.updatedAt).toLocaleString()}
                        {p.updatedBy ? ` by ${p.updatedBy}` : ""}
                      </span>
                    )}
                    {p.apiKeySet && !p.isActive && (
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 h-8 gap-1.5"
                        disabled={saving === p.provider + "-activate"}
                        onClick={() => handleActivate(p.provider)}
                      >
                        {saving === p.provider + "-activate" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                        Activate
                      </Button>
                    )}
                    {p.isActive && (
                      <Badge className="bg-teal-600 text-white gap-1">
                        <Check className="h-3 w-3" /> Currently active
                      </Badge>
                    )}
                  </div>
                </motion.div>
              );
            })}
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

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5 inline mr-1" />
          <strong>How it works:</strong> The Shelf Scanner uses whichever provider is
          <strong> Active</strong>. Set a key for Gemini (free) to start immediately.
          Later, add a Z.ai key and activate it to switch — the scan results stay the
          same, only the backend changes.
        </div>
      </CardContent>
    </Card>
  );
}
