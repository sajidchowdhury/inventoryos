"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Bell, Clock, TrendingDown, ShieldAlert,
  Mail, Phone, Check, AlertCircle, Loader2, BellRing, CalendarClock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface Preferences {
  expiryCriticalDays: number;
  expiryWarningDays: number;
  expiryNoticeDays: number;
  lowStockEnabled: boolean;
  lowStockThreshold: number;
  quarantineAlerts: boolean;
  emailEnabled: boolean;
  email: string | null;
  smsEnabled: boolean;
  phone: string | null;
  digestFrequency: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

function SectionHeader({
  dotClass,
  icon: Icon,
  title,
  description,
}: {
  dotClass: string;
  icon: typeof Bell;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative mt-0.5">
        <span className={cn("absolute -inset-1 rounded-full opacity-30 animate-pulse-soft", dotClass)} />
        <span className={cn("relative block h-2.5 w-2.5 rounded-full", dotClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  iconBg,
  label,
  description,
  children,
}: {
  icon: typeof Bell;
  iconBg: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">{label}</p>
          {description && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AlertPreferences() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/alert-preferences`);
      const data = await res.json();
      if (data.success) setPrefs(data.preferences);
    } catch (err) {
      console.error("Prefs fetch error:", err);
    }
  }, [businessId]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => prev ? { ...prev, [key]: value } : null);
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!businessId || !prefs) return;

    // Validate
    if (prefs.expiryCriticalDays >= prefs.expiryWarningDays ||
        prefs.expiryWarningDays >= prefs.expiryNoticeDays) {
      setError("Thresholds must be: critical < warning < notice");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/alert-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pharmacy-bg min-h-[60vh] rounded-xl p-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("alerts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-5 space-y-3">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="h-3 w-48 skeleton rounded" />
                <div className="h-10 w-full skeleton rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen rounded-xl -mx-1 px-1 py-1">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy rounded-full" onClick={() => setActiveView("alerts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <BellRing className="h-5 w-5 text-emerald-600" />
            Alert Preferences
          </h1>
          <p className="text-[11px] text-muted-foreground">Tune how and when InventoryOS notifies you</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="stagger-in"
        >
          <Card className="border-rose-200/70 bg-rose-50/80 shadow-pharmacy">
            <CardContent className="p-3 flex items-center gap-2 text-sm text-rose-700">
              <div className="h-7 w-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <span>{error}</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="stagger-in"
        >
          <Card className="border-emerald-200/70 bg-emerald-50/80 shadow-pharmacy">
            <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700">
              <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <span>Settings saved successfully!</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Expiry Alerts ── */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-5 space-y-4">
          <SectionHeader
            dotClass="bg-rose-500"
            icon={Clock}
            title="Expiry Alerts"
            description="Get notified before medicine batches expire. Days must be in order: critical &lt; warning &lt; notice."
          />
          <Separator />

          <div className="space-y-4 pt-1">
            {/* Critical threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Critical threshold
                </Label>
                <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-200 font-mono">
                  {prefs.expiryCriticalDays} days
                </Badge>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[prefs.expiryCriticalDays]}
                onValueChange={(v) => update("expiryCriticalDays", v[0])}
                className="[&_[data-slot=slider-range]]:bg-rose-500 [&_[data-slot=slider-thumb]]:border-rose-500"
              />
              <p className="text-[10px] text-muted-foreground">Trigger red alert when batches expire within this many days.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Warning threshold
                </Label>
                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 font-mono">
                  {prefs.expiryWarningDays} days
                </Badge>
              </div>
              <Slider
                min={7}
                max={90}
                step={1}
                value={[prefs.expiryWarningDays]}
                onValueChange={(v) => update("expiryWarningDays", v[0])}
                className="[&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500"
              />
              <p className="text-[10px] text-muted-foreground">Yellow alert — batches approaching expiry.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Notice threshold
                </Label>
                <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 font-mono">
                  {prefs.expiryNoticeDays} days
                </Badge>
              </div>
              <Slider
                min={30}
                max={365}
                step={1}
                value={[prefs.expiryNoticeDays]}
                onValueChange={(v) => update("expiryNoticeDays", v[0])}
                className="[&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500"
              />
              <p className="text-[10px] text-muted-foreground">Informational notice — earliest reminder window.</p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-blue-50 rounded-xl p-3 text-[11px] text-muted-foreground border border-muted/50">
              <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                <Clock className="h-3.5 w-3.5 text-emerald-600" /> How it works
              </div>
              Batches within <strong className="text-rose-600">{prefs.expiryCriticalDays}d</strong> → critical ·{" "}
              <strong className="text-amber-600">{prefs.expiryWarningDays}d</strong> → warning ·{" "}
              <strong className="text-blue-600">{prefs.expiryNoticeDays}d</strong> → notice
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stock Alerts ── */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-5 space-y-3">
          <SectionHeader
            dotClass="bg-amber-500"
            icon={TrendingDown}
            title="Stock Alerts"
            description="Trigger alerts when product inventory falls below your safety levels."
          />
          <Separator />

          <SettingRow
            icon={TrendingDown}
            iconBg="bg-amber-100 text-amber-700"
            label="Low stock alerts"
            description="Enable alerts when quantity drops to threshold."
          >
            <Switch
              checked={prefs.lowStockEnabled}
              onCheckedChange={(v) => update("lowStockEnabled", v)}
            />
          </SettingRow>

          {prefs.lowStockEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-2 pt-2"
            >
              <Label className="text-xs font-medium">Alert when quantity falls to or below</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  value={prefs.lowStockThreshold}
                  onChange={(e) => update("lowStockThreshold", parseInt(e.target.value) || 10)}
                  className="h-10 w-24 font-mono"
                />
                <div className="flex-1">
                  <Slider
                    min={1}
                    max={100}
                    step={1}
                    value={[Math.min(prefs.lowStockThreshold, 100)]}
                    onValueChange={(v) => update("lowStockThreshold", v[0])}
                    className="[&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:border-amber-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Products with stock ≤ <strong>{prefs.lowStockThreshold}</strong> units will trigger an alert
              </p>
            </motion.div>
          )}

          <Separator />

          <SettingRow
            icon={ShieldAlert}
            iconBg="bg-rose-100 text-rose-700"
            label="Quarantine alerts"
            description="Get notified when batches are quarantined and need attention."
          >
            <Switch
              checked={prefs.quarantineAlerts}
              onCheckedChange={(v) => update("quarantineAlerts", v)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* ── Notification Channels ── */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-5 space-y-3">
          <SectionHeader
            dotClass="bg-blue-500"
            icon={Bell}
            title="Notification Channels"
            description="Choose how you want to receive alert digests. Email & SMS are coming soon."
          />
          <Separator />

          <SettingRow
            icon={BellRing}
            iconBg="bg-emerald-100 text-emerald-700"
            label="In-app notifications"
            description="Always-on, visible in the bell dropdown."
          >
            <Switch checked disabled />
          </SettingRow>

          <Separator />

          <SettingRow
            icon={Mail}
            iconBg="bg-blue-100 text-blue-700"
            label="Email notifications"
            description="Receive digest emails (coming soon)."
          >
            <Switch
              checked={prefs.emailEnabled}
              onCheckedChange={(v) => update("emailEnabled", v)}
            />
          </SettingRow>
          {prefs.emailEnabled && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <Input
                type="email"
                placeholder="pharmacy@example.com"
                value={prefs.email || ""}
                onChange={(e) => update("email", e.target.value)}
                className="h-10"
              />
            </motion.div>
          )}

          <Separator />

          <SettingRow
            icon={Phone}
            iconBg="bg-purple-100 text-purple-700"
            label="SMS notifications"
            description="Receive text alerts (coming soon)."
          >
            <Switch
              checked={prefs.smsEnabled}
              onCheckedChange={(v) => update("smsEnabled", v)}
            />
          </SettingRow>
          {prefs.smsEnabled && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <Input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={prefs.phone || ""}
                onChange={(e) => update("phone", e.target.value)}
                className="h-10"
              />
            </motion.div>
          )}

          <Separator />

          <div className="pt-1 space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-blue-600" /> Digest frequency
            </Label>
            <Select
              value={prefs.digestFrequency}
              onValueChange={(v) => update("digestFrequency", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="none">None (in-app only)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">How often should we send a summary of all alerts?</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Quiet Hours ── */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-5 space-y-3">
          <SectionHeader
            dotClass="bg-slate-500"
            icon={Clock}
            title="Quiet Hours"
            description="Pause push notifications during these hours. Alerts are still recorded in-app."
          />
          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start (hour)</Label>
              <Select
                value={prefs.quietHoursStart?.toString() || "__none__"}
                onValueChange={(v) => update("quietHoursStart", v === "__none__" ? null : parseInt(v))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Off" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Off</SelectItem>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End (hour)</Label>
              <Select
                value={prefs.quietHoursEnd?.toString() || "__none__"}
                onValueChange={(v) => update("quietHoursEnd", v === "__none__" ? null : parseInt(v))}
                disabled={prefs.quietHoursStart === null}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Off" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Off</SelectItem>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ── */}
      <div className="stagger-in pt-1">
        <Button
          size="lg"
          className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-pharmacy-lg border-0"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </motion.div>
  );
}
