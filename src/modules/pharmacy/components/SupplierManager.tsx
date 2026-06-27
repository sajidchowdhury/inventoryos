"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, Truck, Phone, Mail, MapPin,
  Edit2, Trash2, ChevronRight, Package, DollarSign,
  AlertCircle, Check, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export function SupplierManager() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, editingCustomerId } = useNavStore();
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

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Suppliers</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {search && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-primary">{suppliers.length}</p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-orange-600">
            ৳{suppliers.reduce((s, sup) => s + sup.balance, 0).toFixed(0)}
          </p>
          <p className="text-[9px] text-muted-foreground">Outstanding</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-blue-600">
            ৳{suppliers.reduce((s, sup) => s + sup.totalPurchased, 0).toFixed(0)}
          </p>
          <p className="text-[9px] text-muted-foreground">Purchased</p>
        </CardContent></Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">{search ? "No suppliers found" : "No suppliers yet"}</p>
            {!search && <Button size="sm" className="gap-1.5" onClick={openCreateDialog}><Plus className="h-3.5 w-3.5" /> Add Supplier</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { /* Could open detail */ }}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Truck className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{supplier.name}</p>
                    {supplier.code && <Badge variant="secondary" className="text-[9px]">{supplier.code}</Badge>}
                  </div>
                  {supplier.contactPerson && <p className="text-[10px] text-muted-foreground">{supplier.contactPerson}</p>}
                  {supplier.phone && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {supplier.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[9px]">
                      <Package className="h-2.5 w-2.5 mr-0.5" />
                      {supplier._count?.purchases || 0} purchase(s)
                    </Badge>
                    {supplier.balance > 0 && (
                      <Badge variant="outline" className="text-[9px] text-red-600 border-red-300">
                        ৳{supplier.balance.toFixed(0)} due
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button className="p-1.5 rounded hover:bg-muted" onClick={(e) => { e.stopPropagation(); openEditDialog(supplier.id); }}>
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(supplier); }}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
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
            <Button className="w-full h-10 gap-2" onClick={handleSave} disabled={saving || !form.name.trim()}>
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
