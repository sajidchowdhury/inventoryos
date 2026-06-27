"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Edit2, Trash2, Percent, Tag, ToggleLeft,
  ToggleRight, Award, AlertCircle, Check, Loader2, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface DiscountRule {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  conditionType: string;
  conditionValue: string | null;
  scope: string;
  scopeValue: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  priority: number;
  timesUsed: number;
  totalDiscountGiven: number;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const emptyForm = {
  name: "",
  description: "",
  type: "percent",
  value: "",
  conditionType: "none",
  conditionValue: "",
  scope: "all",
  scopeValue: "",
  startDate: "",
  endDate: "",
  isActive: true,
  priority: "0",
};

const conditionLabels: Record<string, string> = {
  none: "No condition (always apply)",
  min_quantity: "Minimum quantity",
  min_amount: "Minimum order amount",
  customer_tag: "Customer tag",
  schedule_type: "Schedule type",
  time_based: "Time-based",
};

const scopeLabels: Record<string, string> = {
  all: "All products",
  category: "Specific category",
  product: "Specific product",
  schedule_type: "Schedule type",
};

export function DiscountRulesManager() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DiscountRule | null>(null);

  const fetchRules = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/discount-rules`);
      const data = await res.json();
      if (data.success) setRules(data.rules || []);
    } catch (err) {
      console.error("Fetch rules error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DiscountRule) => {
    setForm({
      name: rule.name,
      description: rule.description || "",
      type: rule.type,
      value: rule.value.toString(),
      conditionType: rule.conditionType,
      conditionValue: rule.conditionValue || "",
      scope: rule.scope,
      scopeValue: rule.scopeValue || "",
      startDate: rule.startDate ? rule.startDate.split("T")[0] : "",
      endDate: rule.endDate ? rule.endDate.split("T")[0] : "",
      isActive: rule.isActive,
      priority: rule.priority.toString(),
    });
    setEditingId(rule.id);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !form.name.trim() || !form.value) {
      setError("Name and value are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/businesses/${businessId}/discount-rules/${editingId}`
        : `/api/businesses/${businessId}/discount-rules`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDialogOpen(false);
      fetchRules();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: DiscountRule) => {
    if (!businessId) return;
    try {
      await fetch(`/api/businesses/${businessId}/discount-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      fetchRules();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !deleteConfirm) return;
    try {
      await fetch(`/api/businesses/${businessId}/discount-rules/${deleteConfirm.id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      fetchRules();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Discount Rules</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-primary">{rules.length}</p>
          <p className="text-[9px] text-muted-foreground">Total Rules</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-green-600">{rules.filter(r => r.isActive).length}</p>
          <p className="text-[9px] text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-orange-600">
            ৳{rules.reduce((s, r) => s + r.totalDiscountGiven, 0).toFixed(0)}
          </p>
          <p className="text-[9px] text-muted-foreground">Given</p>
        </CardContent></Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}</div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Award className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No discount rules yet</p>
            <p className="text-sm text-muted-foreground">
              Create rules to auto-apply discounts based on conditions
            </p>
            <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
              <Plus className="h-3.5 w-3.5" /> Create Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id} className={cn("overflow-hidden", !rule.isActive && "opacity-60")}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{rule.name}</p>
                      <Badge variant="outline" className="text-[9px]">
                        {rule.type === "percent" ? `${rule.value}%` : `৳${rule.value}`}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[9px]">
                        {scopeLabels[rule.scope]}
                      </Badge>
                      {rule.conditionType !== "none" && (
                        <Badge variant="secondary" className="text-[9px]">
                          {conditionLabels[rule.conditionType]}{rule.conditionValue ? `: ${rule.conditionValue}` : ""}
                        </Badge>
                      )}
                    </div>
                    {rule.timesUsed > 0 && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Used {rule.timesUsed}× · ৳{rule.totalDiscountGiven.toFixed(0)} given
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      className="p-1 rounded hover:bg-muted"
                      onClick={() => handleToggleActive(rule)}
                      title={rule.isActive ? "Deactivate" : "Activate"}
                    >
                      {rule.isActive
                        ? <ToggleRight className="h-4 w-4 text-green-600" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button className="p-1 rounded hover:bg-muted" onClick={() => openEditDialog(rule)}>
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button className="p-1 rounded hover:bg-red-50" onClick={() => setDeleteConfirm(rule)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Rule" : "Add Discount Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rule Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" placeholder="e.g., Bulk 10% off" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[40px] text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat Amount (৳)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Value *</Label>
                <Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="h-10" placeholder="10" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Condition</Label>
              <Select value={form.conditionType} onValueChange={(v) => setForm({ ...form, conditionType: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(conditionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.conditionType !== "none" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Condition Value</Label>
                <Input
                  value={form.conditionValue}
                  onChange={(e) => setForm({ ...form, conditionValue: e.target.value })}
                  className="h-10"
                  placeholder={form.conditionType === "min_quantity" ? "e.g., 10" : form.conditionType === "min_amount" ? "e.g., 1000" : "value"}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Scope</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(scopeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priority</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-10" />
              </div>
              <div className="flex items-center justify-between pt-5">
                <Label className="text-xs font-medium">Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
            </div>

            <Button className="w-full h-10 gap-2" onClick={handleSave} disabled={saving || !form.name.trim() || !form.value}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {saving ? "Saving..." : editingId ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Rule</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm">Delete <strong>{deleteConfirm?.name}</strong>?</p>
            {deleteConfirm && deleteConfirm.timesUsed > 0 && (
              <p className="text-xs text-muted-foreground">
                This rule has been used {deleteConfirm.timesUsed} times (৳{deleteConfirm.totalDiscountGiven.toFixed(0)} given).
                Historical data will be preserved.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
