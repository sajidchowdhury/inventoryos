"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Bell, Clock, TrendingDown, ShieldAlert,
  Mail, Phone, Check, AlertCircle, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";

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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("alerts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("alerts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Alert Settings</h1>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-500/50 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4 shrink-0" /> Settings saved successfully!
          </CardContent>
        </Card>
      )}

      {/* Expiry Thresholds */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Clock className="h-4 w-4" /> Expiry Alert Thresholds
          </div>
          <p className="text-xs text-muted-foreground">
            Configure when to trigger alerts before batches expire. Days must be in order: critical &lt; warning &lt; notice.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-red-600">Critical (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={prefs.expiryCriticalDays}
                  onChange={(e) => update("expiryCriticalDays", parseInt(e.target.value) || 7)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-orange-600">Warning (days)</Label>
                <Input
                  type="number"
                  min={7}
                  max={90}
                  value={prefs.expiryWarningDays}
                  onChange={(e) => update("expiryWarningDays", parseInt(e.target.value) || 30)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-blue-600">Notice (days)</Label>
                <Input
                  type="number"
                  min={30}
                  max={365}
                  value={prefs.expiryNoticeDays}
                  onChange={(e) => update("expiryNoticeDays", parseInt(e.target.value) || 90)}
                  className="h-10"
                />
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 text-[11px] text-muted-foreground">
              <strong>How it works:</strong> Batches within {prefs.expiryCriticalDays}d → critical alert · {prefs.expiryWarningDays}d → warning · {prefs.expiryNoticeDays}d → notice
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <TrendingDown className="h-4 w-4" /> Low Stock Alerts
            </div>
            <Switch
              checked={prefs.lowStockEnabled}
              onCheckedChange={(v) => update("lowStockEnabled", v)}
            />
          </div>
          {prefs.lowStockEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Alert when quantity falls to or below</Label>
              <Input
                type="number"
                min={1}
                value={prefs.lowStockThreshold}
                onChange={(e) => update("lowStockThreshold", parseInt(e.target.value) || 10)}
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground">
                Products with stock ≤ {prefs.lowStockThreshold} units will trigger an alert
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quarantine Alerts */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldAlert className="h-4 w-4" /> Quarantine Alerts
            </div>
            <Switch
              checked={prefs.quarantineAlerts}
              onCheckedChange={(v) => update("quarantineAlerts", v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Get notified when batches are quarantined and need attention.
          </p>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Bell className="h-4 w-4" /> Notification Channels
          </div>
          <p className="text-xs text-muted-foreground">
            Configure how you want to receive alert digests. (Coming soon — currently in-app only)
          </p>

          {/* Email */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Notifications
              </Label>
              <Switch
                checked={prefs.emailEnabled}
                onCheckedChange={(v) => update("emailEnabled", v)}
              />
            </div>
            {prefs.emailEnabled && (
              <Input
                type="email"
                placeholder="pharmacy@example.com"
                value={prefs.email || ""}
                onChange={(e) => update("email", e.target.value)}
                className="h-10"
              />
            )}
          </div>

          <Separator />

          {/* SMS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> SMS Notifications
              </Label>
              <Switch
                checked={prefs.smsEnabled}
                onCheckedChange={(v) => update("smsEnabled", v)}
              />
            </div>
            {prefs.smsEnabled && (
              <Input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={prefs.phone || ""}
                onChange={(e) => update("phone", e.target.value)}
                className="h-10"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Digest Frequency */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Bell className="h-4 w-4" /> Digest Frequency
          </div>
          <p className="text-xs text-muted-foreground">
            How often should we send a summary of all alerts?
          </p>
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
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Clock className="h-4 w-4" /> Quiet Hours
          </div>
          <p className="text-xs text-muted-foreground">
            Pause push notifications during these hours (alerts still recorded).
          </p>
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

      {/* Save Button */}
      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </motion.div>
  );
}
