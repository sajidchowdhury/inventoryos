"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, Truck, Phone,
  Edit2, Trash2, Package,
  AlertCircle, Check, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
  totalPurchased: number;
  totalPaid: number;
  notes: string | null;
  _count?: { purchases: number };
  createdAt: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const emptyForm = {
  name: "",
  code: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

/** Map a supplier's outstanding balance to a colored status badge. */
function getBalanceStatus(balance: number) {
  if (balance <= 0) {
    return {
      label: "Clear",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (balance < 5000) {
    return {
      label: `৳${balance.toFixed(0)} due`,
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      dot: "bg-amber-500",
    };
  }
  return {
    label: `৳${balance.toFixed(0)} due`,
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
  };
}

export function SupplierManager() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveSupplierId } = useNavStore();
  const businessId = session?.business?.id;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "50");
      const res = await fetch(`/api/businesses/${businessId}/suppliers?${params}`);
      const data = await res.json();
      if (data.success) setSuppliers(data.suppliers || []);
    } catch (err) {
      console.error("Fetch suppliers error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (supplierId: string) => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${supplierId}`);
      const data = await res.json();
      if (data.success) {
        const s = data.supplier;
        setForm({
          name: s.name,
          code: s.code || "",
          contactPerson: s.contactPerson || "",
          phone: s.phone || "",
          email: s.email || "",
          address: s.address || "",
          notes: s.notes || "",
        });
        setEditingId(supplierId);
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
      const url = editingId
        ? `/api/businesses/${businessId}/suppliers/${editingId}`
        : `/api/businesses/${businessId}/suppliers`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDialogOpen(false);
      fetchSuppliers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !deleteConfirm) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setDeleteConfirm(null);
      fetchSuppliers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const totalOutstanding = suppliers.reduce((s, sup) => s + sup.balance, 0);
  const totalPurchasedAll = suppliers.reduce((s, sup) => s + sup.totalPurchased, 0);

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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="text-[11px] text-muted-foreground">Manage vendor relationships &amp; payables</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" /> Add Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, code..."
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
              <Truck className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">{suppliers.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-slate-200/70">
          <CardContent className="p-3 text-center">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <span className="text-[10px] font-bold text-rose-600">৳</span>
            </div>
            <p className="text-lg font-bold text-slate-900">৳{totalOutstanding.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-slate-200/70">
          <CardContent className="p-3 text-center">
            <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
              <Package className="h-3.5 w-3.5 text-sky-600" />
            </div>
            <p className="text-lg font-bold text-slate-900">৳{totalPurchasedAll.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Purchased</p>
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
                  <div className="skeleton h-12 w-12 rounded-2xl" />
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
      ) : suppliers.length === 0 ? (
        <Card className="card-hover shadow-pharmacy border-slate-200/70">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50">
              <Truck className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                {search ? "No suppliers found" : "No suppliers yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Add your first supplier to track purchases"}
              </p>
            </div>
            {!search && (
              <Button
                size="sm"
                className="gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4" /> Add Supplier
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {suppliers.map((supplier) => {
            const status = getBalanceStatus(supplier.balance);
            return (
              <Card
                key={supplier.id}
                className="card-hover stagger-in cursor-pointer overflow-hidden border-slate-200/70 shadow-pharmacy"
                onClick={() => { setActiveSupplierId(supplier.id); setActiveView("supplier-detail"); }}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    {/* Gradient truck icon */}
                    <div className="relative shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm">
                        <Truck className="h-5 w-5 text-white" />
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white", status.dot)} />
                    </div>

                    {/* Name + code + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">{supplier.name}</p>
                            {supplier.code && (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-600">
                                {supplier.code}
                              </span>
                            )}
                          </div>
                          {supplier.contactPerson && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{supplier.contactPerson}</p>
                          )}
                          {supplier.phone && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" /> {supplier.phone}
                            </p>
                          )}
                        </div>
                        {/* Balance badge */}
                        <span className={cn("shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", status.className)}>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          <Package className="h-2.5 w-2.5 text-slate-400" />
                          {supplier._count?.purchases || 0} purchase(s)
                        </span>
                        {supplier.totalPurchased > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            ৳{supplier.totalPurchased.toFixed(0)} purchased
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); openEditDialog(supplier.id); }}
                        aria-label="Edit supplier"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-600" />
                      </button>
                      <button
                        className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(supplier); }}
                        aria-label="Delete supplier"
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
          <DialogHeader><DialogTitle>{editingId ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" autoFocus placeholder="e.g., Square Pharmaceuticals" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Code (auto-generated if empty)</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10" placeholder="SUP-001" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contact Person</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" placeholder="01XXXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="min-h-[50px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[40px] text-sm" />
            </div>
            <Button className="w-full h-10 gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {saving ? "Saving..." : editingId ? "Update" : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <p className="text-sm">Delete <strong>{deleteConfirm?.name}</strong>?</p>
            {deleteConfirm && (deleteConfirm._count?.purchases || 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                They have {deleteConfirm._count?.purchases} past purchase(s) which will be preserved in history.
              </p>
            )}
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
