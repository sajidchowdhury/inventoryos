"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, Phone,
  Edit2, Trash2, ShoppingBag,
  AlertCircle, Check, Loader2, UserPlus, Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalSpent: number;
  visitCount: number;
  lastVisitAt: string | null;
  _count?: { sales: number };
  balance?: number;
  createdAt: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gender: "",
  chronicConditions: "",
  allergies: "",
  notes: "",
};

/** Build initials from a customer name (e.g., "Rahim Uddin" → "RU"). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map a customer's outstanding balance to a colored status badge. */
function getCreditStatus(balance?: number) {
  const due = balance ?? 0;
  if (due <= 0) {
    return {
      label: "Clear",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (due < 1000) {
    return {
      label: `৳${due.toFixed(0)} due`,
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      dot: "bg-amber-500",
    };
  }
  return {
    label: `৳${due.toFixed(0)} due`,
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
  };
}

export function CustomerManager() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveCustomerId, editingCustomerId } = useNavStore();
  const businessId = session?.business?.id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "50");
      const res = await fetch(`/api/businesses/${businessId}/customers?${params}`);
      const data = await res.json();
      if (data.success) setCustomers(data.customers || []);
    } catch (err) {
      console.error("Fetch customers error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setEditingCustomerId(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (customerId: string) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/customers/${customerId}`);
      const data = await res.json();
      if (data.success) {
        const c = data.customer;
        setForm({
          name: c.name,
          phone: c.phone || "",
          email: c.email || "",
          address: c.address || "",
          gender: c.gender || "",
          chronicConditions: c.chronicConditions || "",
          allergies: c.allergies || "",
          notes: c.notes || "",
        });
        setEditingCustomerId(customerId);
        setError(null);
        setDialogOpen(true);
      }
    } catch (err) {
      console.error("Edit fetch error:", err);
    }
  };

  const handleSave = async () => {
    if (!businessId || !form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingCustomerId
        ? `/api/businesses/${businessId}/customers/${editingCustomerId}`
        : `/api/businesses/${businessId}/customers`;
      const method = editingCustomerId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDialogOpen(false);
      fetchCustomers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !deleteConfirm) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/customers/${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setDeleteConfirm(null);
      fetchCustomers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0);
  const activeCount = customers.filter(c => c.visitCount > 0).length;

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen space-y-4 p-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl hover:bg-emerald-50"
          onClick={() => setActiveView("dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Customers</h1>
          <p className="text-[11px] text-muted-foreground">Manage your pharmacy customer base</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(
            "h-11 rounded-2xl border-slate-200 bg-white pl-10 pr-9 shadow-pharmacy",
            "transition-all duration-200",
            "focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100 focus-visible:ring-offset-0",
          )}
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-emerald-50"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="shadow-pharmacy border-slate-200/70">
          <CardContent className="p-3 text-center">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">{customers.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-slate-200/70">
          <CardContent className="p-3 text-center">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
              <ShoppingBag className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">{activeCount}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-slate-200/70">
          <CardContent className="p-3 text-center">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
              <span className="text-[10px] font-bold text-sky-600">৳</span>
            </div>
            <p className="text-lg font-bold text-slate-900">৳{totalSpentAll.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Total Spent</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden border-slate-200/70">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-1/3 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                  <div className="skeleton h-6 w-16 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card className="card-hover shadow-pharmacy border-slate-200/70">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50">
              <Users className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                {search ? "No customers found" : "No customers yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Add your first customer to track purchases"}
              </p>
            </div>
            {!search && (
              <Button
                size="sm"
                className="gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
                onClick={openCreateDialog}
              >
                <UserPlus className="h-4 w-4" /> Add Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {customers.map((customer) => {
            const status = getCreditStatus(customer.balance);
            return (
              <Card
                key={customer.id}
                className="card-hover stagger-in cursor-pointer overflow-hidden border-slate-200/70 shadow-pharmacy"
                onClick={() => { setActiveCustomerId(customer.id); setActiveView("customer-detail"); }}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    {/* Gradient avatar with initials */}
                    <div className="relative shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white shadow-sm">
                        {getInitials(customer.name)}
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white", status.dot)} />
                    </div>

                    {/* Name + phone + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{customer.name}</p>
                          {customer.phone && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" /> {customer.phone}
                            </p>
                          )}
                        </div>
                        {/* Credit balance badge */}
                        <span className={cn("shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          <ShoppingBag className="h-2.5 w-2.5 text-slate-400" />
                          {customer.visitCount} visit{customer.visitCount !== 1 ? "s" : ""}
                        </span>
                        {customer.totalSpent > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            ৳{customer.totalSpent.toFixed(0)} spent
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); openEditDialog(customer.id); }}
                        aria-label="Edit customer"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-600" />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(customer); }}
                        aria-label="Delete customer"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-rose-600" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomerId ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v === "__none__" ? "" : v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not specified</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="min-h-[50px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Chronic Conditions (comma-separated)</Label>
              <Input value={form.chronicConditions} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })} className="h-10" placeholder="diabetes, hypertension" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Allergies (comma-separated)</Label>
              <Input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} className="h-10" placeholder="penicillin, sulfa" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[50px] text-sm" />
            </div>
            <Button className="w-full h-10 gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCustomerId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {saving ? "Saving..." : editingCustomerId ? "Update" : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Customer</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <p className="text-sm">
              Delete <strong>{deleteConfirm?.name}</strong>?
              {deleteConfirm && deleteConfirm.visitCount > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">
                  They have {deleteConfirm.visitCount} past sale(s) which will be preserved in history.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5 rounded-xl" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
