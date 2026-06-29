"use client";

// ── ScheduleManagerCard ──
// Phase C: Create, edit, and manage report schedules from /admin.
//
// Shows a list of schedules with a "Create Schedule" button.
// Clicking create/edit opens a form with 5 sections:
//   1. Basic Info (name, description)
//   2. Frequency (weekly/monthly/date_range + day picker)
//   3. Occasions (multi-select chips with impact weight)
//   4. Target Clients (all or selected businesses)
//   5. Delivery Channels (email/whatsapp checkboxes)
// Plus a Preview panel showing next 3 run dates.

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Plus, Edit2, Trash2, Play, X, Save, Loader2,
  Check, AlertCircle, Users, Mail, MessageCircle, CalendarClock,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { formatFrequency } from "@/lib/schedule-compute";

interface Schedule {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  startDate: string | null;
  endDate: string | null;
  occasions: string;
  considerSeasons: boolean;
  considerEpidemics: boolean;
  targetClientMode: string;
  targetClientIds: string | null;
  deliveryChannels: string;
  reportPeriodDays: number;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

interface Occasion {
  id: string;
  name: string;
  slug: string;
  type: string;
  impactWeight: number;
  isActive: boolean;
}

interface Business {
  id: string;
  name: string;
  subscriptionTier: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ScheduleManagerCard({ token }: { token: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    frequency: "weekly" as "weekly" | "monthly" | "date_range",
    dayOfWeek: 1,
    dayOfMonth: 1,
    startDate: "",
    endDate: "",
    selectedOccasions: [] as string[],
    considerSeasons: true,
    considerEpidemics: true,
    targetClientMode: "all" as "all" | "selected",
    selectedBusinessIds: [] as string[],
    deliveryChannels: ["email"] as string[],
    reportPeriodDays: 7,
    isActive: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedRes, occRes] = await Promise.all([
        fetch("/api/super-admin/report-scheduling/schedules", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/super-admin/report-scheduling/occasions", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const schedData = await schedRes.json();
      const occData = await occRes.json();
      if (schedData.schedules) setSchedules(schedData.schedules);
      if (occData.occasions) setOccasions(occData.occasions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load businesses when switching to "selected" mode
  const loadBusinesses = useCallback(async () => {
    if (businesses.length > 0) return;
    try {
      const res = await fetch("/api/super-admin/businesses", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.businesses) setBusinesses(data.businesses.map((b: any) => ({ id: b.id, name: b.name, subscriptionTier: b.subscriptionTier })));
    } catch {}
  }, [token, businesses.length]);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm({
      name: "", description: "", frequency: "weekly", dayOfWeek: 1, dayOfMonth: 1,
      startDate: "", endDate: "", selectedOccasions: [], considerSeasons: true,
      considerEpidemics: true, targetClientMode: "all", selectedBusinessIds: [],
      deliveryChannels: ["email"], reportPeriodDays: 7, isActive: true,
    });
    setShowForm(true);
  };

  const handleEdit = (s: Schedule) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      frequency: s.frequency as any,
      dayOfWeek: s.dayOfWeek ?? 1,
      dayOfMonth: s.dayOfMonth ?? 1,
      startDate: s.startDate ? s.startDate.split("T")[0] : "",
      endDate: s.endDate ? s.endDate.split("T")[0] : "",
      selectedOccasions: JSON.parse(s.occasions || "[]"),
      considerSeasons: s.considerSeasons,
      considerEpidemics: s.considerEpidemics,
      targetClientMode: s.targetClientMode as any,
      selectedBusinessIds: JSON.parse(s.targetClientIds || "[]"),
      deliveryChannels: JSON.parse(s.deliveryChannels || "[\"email\"]"),
      reportPeriodDays: s.reportPeriodDays,
      isActive: s.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Schedule name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        frequency: form.frequency,
        dayOfWeek: form.frequency === "weekly" ? form.dayOfWeek : null,
        dayOfMonth: form.frequency === "monthly" ? form.dayOfMonth : null,
        startDate: form.frequency === "date_range" && form.startDate ? form.startDate : null,
        endDate: form.frequency === "date_range" && form.endDate ? form.endDate : null,
        occasions: form.selectedOccasions,
        considerSeasons: form.considerSeasons,
        considerEpidemics: form.considerEpidemics,
        targetClientMode: form.targetClientMode,
        targetClientIds: form.targetClientMode === "selected" ? form.selectedBusinessIds : null,
        deliveryChannels: form.deliveryChannels,
        reportPeriodDays: form.reportPeriodDays,
        isActive: form.isActive,
      };

      const url = editingId
        ? `/api/super-admin/report-scheduling/schedules/${editingId}`
        : "/api/super-admin/report-scheduling/schedules";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      showToast(editingId ? "Schedule updated" : "Schedule created");
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete schedule "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/super-admin/report-scheduling/schedules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      showToast("Schedule deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleTrigger = async (id: string) => {
    setTriggeringId(id);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/report-scheduling/schedules/${id}/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const msg = data.totalTarget > 3
        ? `Triggered! Processing first 3 of ${data.totalTarget} businesses (${data.succeeded} succeeded, ${data.failed} failed)`
        : `Triggered! Processed ${data.processed} businesses (${data.succeeded} succeeded, ${data.failed} failed)`;
      showToast(msg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trigger failed");
    } finally {
      setTriggeringId(null);
    }
  };

  const toggleOccasion = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedOccasions: prev.selectedOccasions.includes(id)
        ? prev.selectedOccasions.filter((o) => o !== id)
        : [...prev.selectedOccasions, id],
    }));
  };

  const toggleBusiness = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedBusinessIds: prev.selectedBusinessIds.includes(id)
        ? prev.selectedBusinessIds.filter((b) => b !== id)
        : [...prev.selectedBusinessIds, id],
    }));
  };

  const toggleChannel = (channel: string) => {
    setForm((prev) => ({
      ...prev,
      deliveryChannels: prev.deliveryChannels.includes(channel)
        ? prev.deliveryChannels.filter((c) => c !== channel)
        : [...prev.deliveryChannels, channel],
    }));
  };

  // ── Form View ──
  if (showForm) {
    return (
      <Card className="border-purple-200 dark:border-purple-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Calendar className="h-5 w-5" />
                {editingId ? "Edit Schedule" : "Create Schedule"}
              </CardTitle>
              <CardDescription>Configure when and how reports are generated</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">1. Basic Info</Label>
            <div>
              <Label htmlFor="sched-name">Schedule Name *</Label>
              <Input id="sched-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Weekly Eid-Aware Report" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="sched-desc">Description (optional)</Label>
              <Input id="sched-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this schedule is for" className="mt-1" />
            </div>
          </div>

          {/* Section 2: Frequency */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">2. Frequency</Label>
            <div className="flex gap-2">
              {(["weekly", "monthly", "date_range"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setForm({ ...form, frequency: f })}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.frequency === f
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  {f === "date_range" ? "Date Range" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {form.frequency === "weekly" && (
              <div className="flex gap-1 flex-wrap">
                {DAY_NAMES.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setForm({ ...form, dayOfWeek: i })}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      form.dayOfWeek === i
                        ? "border-purple-500 bg-purple-500 text-white"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
            {form.frequency === "monthly" && (
              <div>
                <Label>Day of month (1-28)</Label>
                <Input type="number" min={1} max={28} value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: parseInt(e.target.value) || 1 })}
                  className="mt-1 w-24" />
                <p className="text-xs text-muted-foreground mt-1">Capped at 28 to avoid skipped months (Feb has 28 days)</p>
              </div>
            )}
            {form.frequency === "date_range" && (
              <div className="flex gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}
            <div>
              <Label>Prediction period: {form.reportPeriodDays} days ahead</Label>
              <input type="range" min={7} max={30} value={form.reportPeriodDays}
                onChange={(e) => setForm({ ...form, reportPeriodDays: parseInt(e.target.value) })}
                className="w-full mt-1" />
              <p className="text-xs text-muted-foreground">7 = weekly, 14 = biweekly, 30 = monthly forecast</p>
            </div>
          </div>

          {/* Section 3: Occasions */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">3. Occasions to Consider</Label>
            <p className="text-xs text-muted-foreground">Select which occasions influence predictions. Empty = consider all active occasions.</p>
            <div className="flex flex-wrap gap-2">
              {occasions.filter((o) => o.isActive).map((occ) => {
                const selected = form.selectedOccasions.includes(occ.id);
                return (
                  <button
                    key={occ.id}
                    onClick={() => toggleOccasion(occ.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selected
                        ? "border-purple-500 bg-purple-500 text-white"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    {occ.name} ({occ.impactWeight}x)
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.considerSeasons}
                  onChange={(e) => setForm({ ...form, considerSeasons: e.target.checked })} />
                Consider seasons (Winter/Summer/Monsoon)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.considerEpidemics}
                  onChange={(e) => setForm({ ...form, considerEpidemics: e.target.checked })} />
                Consider active epidemics (Dengue/COVID)
              </label>
            </div>
          </div>

          {/* Section 4: Target Clients */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">4. Target Clients</Label>
            <div className="flex gap-2">
              <button onClick={() => setForm({ ...form, targetClientMode: "all" })}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.targetClientMode === "all"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700"
                    : "border-slate-200 dark:border-slate-800"
                }`}>
                All Pro+AI businesses
              </button>
              <button onClick={() => { setForm({ ...form, targetClientMode: "selected" }); loadBusinesses(); }}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.targetClientMode === "selected"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700"
                    : "border-slate-200 dark:border-slate-800"
                }`}>
                Selected businesses
              </button>
            </div>
            {form.targetClientMode === "selected" && (
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2 space-y-1">
                {businesses.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-4">Loading businesses...</div>
                ) : (
                  businesses.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded cursor-pointer">
                      <input type="checkbox" checked={form.selectedBusinessIds.includes(b.id)}
                        onChange={() => toggleBusiness(b.id)} />
                      <span className="text-sm flex-1">{b.name}</span>
                      <Badge variant="outline" className="text-xs">{b.subscriptionTier}</Badge>
                    </label>
                  ))
                )}
              </div>
            )}
            {form.targetClientMode === "selected" && form.selectedBusinessIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{form.selectedBusinessIds.length} business(es) selected</p>
            )}
          </div>

          {/* Section 5: Delivery Channels */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">5. Delivery Channels</Label>
            <div className="flex gap-3">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                form.deliveryChannels.includes("email")
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-800"
              }`}>
                <input type="checkbox" checked={form.deliveryChannels.includes("email")}
                  onChange={() => toggleChannel("email")} />
                <Mail className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Email</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                form.deliveryChannels.includes("whatsapp")
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30" : "border-slate-200 dark:border-slate-800"
              }`}>
                <input type="checkbox" checked={form.deliveryChannels.includes("whatsapp")}
                  onChange={() => toggleChannel("whatsapp")} />
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">WhatsApp</span>
              </label>
            </div>
            {form.deliveryChannels.length === 0 && (
              <p className="text-xs text-red-600">Select at least one delivery channel</p>
            )}
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Schedule is active (uncheck to pause without deleting)
          </label>

          {/* Save */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || form.deliveryChannels.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {editingId ? "Update Schedule" : "Create Schedule"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── List View ──
  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Calendar className="h-5 w-5" />
              Report Schedules
            </CardTitle>
            <CardDescription>Create and manage automated report delivery schedules</CardDescription>
          </div>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create Schedule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300 mb-3">
            <AlertCircle className="h-4 w-4" /> {error}
            <Button size="sm" variant="ghost" onClick={() => setError(null)} className="ml-auto">Dismiss</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No schedules yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Create Schedule" to set up your first report delivery.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => {
              const occasions = JSON.parse(s.occasions || "[]");
              const channels = JSON.parse(s.deliveryChannels || "[]");
              const targetIds = JSON.parse(s.targetClientIds || "[]");
              const isExpanded = expandedId === s.id;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg border p-3 ${!s.isActive ? "opacity-60" : ""} ${
                    s.nextRunAt && new Date(s.nextRunAt) <= new Date()
                      ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{s.name}</span>
                        {!s.isActive && <Badge variant="secondary" className="text-xs">PAUSED</Badge>}
                        {s.nextRunAt && new Date(s.nextRunAt) <= new Date() && s.isActive && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">DUE NOW</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatFrequency(s.frequency, s.dayOfWeek, s.dayOfMonth, s.startDate ? new Date(s.startDate) : null, s.endDate ? new Date(s.endDate) : null)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {s.targetClientMode === "all" ? "All Pro+AI" : `${targetIds.length} selected`}
                        </span>
                        <span className="flex items-center gap-1">
                          {channels.includes("email") && <Mail className="h-3 w-3 text-blue-600" />}
                          {channels.includes("whatsapp") && <MessageCircle className="h-3 w-3 text-green-600" />}
                        </span>
                      </div>
                      {s.nextRunAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Next run: {new Date(s.nextRunAt).toLocaleString()}
                          {s.lastRunAt && ` · Last run: ${new Date(s.lastRunAt).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleTrigger(s.id)} disabled={triggeringId === s.id}
                        title="Trigger now (generate reports immediately)">
                        {triggeringId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(s)} title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id, s.name)} title="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                          {s.description && <p className="text-muted-foreground">{s.description}</p>}
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">Prediction: {s.reportPeriodDays} days</Badge>
                            {s.considerSeasons && <Badge className="bg-blue-100 text-blue-700 text-xs">+ Seasons</Badge>}
                            {s.considerEpidemics && <Badge className="bg-red-100 text-red-700 text-xs">+ Epidemics</Badge>}
                            {occasions.length > 0 && (
                              <Badge className="bg-purple-100 text-purple-700 text-xs">{occasions.length} occasion(s) selected</Badge>
                            )}
                            {occasions.length === 0 && (
                              <Badge variant="outline" className="text-xs">All occasions</Badge>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <Check className="h-4 w-4" /> {toast}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
