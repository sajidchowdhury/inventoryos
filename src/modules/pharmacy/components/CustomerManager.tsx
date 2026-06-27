"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, User, Phone, Mail, MapPin,
  Edit2, Trash2, ChevronRight, ShoppingBag, Calendar,
  AlertCircle, Check, Loader2,
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

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Customers</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, email..."
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
          <p className="text-base font-bold text-primary">{customers.length}</p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-green-600">{customers.filter(c => c.visitCount > 0).length}</p>
          <p className="text-[9px] text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <p className="text-base font-bold text-blue-600">
            ৳{customers.reduce((s, c) => s + c.totalSpent, 0).toFixed(0)}
          </p>
          <p className="text-[9px] text-muted-foreground">Total Spent</p>
        </CardContent></Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <User className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">{search ? "No customers found" : "No customers yet"}</p>
            <p className="text-sm text-muted-foreground">
              {search ? "Try a different search" : "Add your first customer to track purchases"}
            </p>
            {!search && (
              <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" /> Add Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {customers.map((customer) => (
            <Card key={customer.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setActiveCustomerId(customer.id); setActiveView("customer-detail"); }}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{customer.name}</p>
                  {customer.phone && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {customer.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px]">
                      <ShoppingBag className="h-2.5 w-2.5 mr-0.5" />
                      {customer.visitCount} visit{customer.visitCount !== 1 ? "s" : ""}
                    </Badge>
                    {customer.totalSpent > 0 && (
                      <span className="text-[10px] text-muted-foreground">৳{customer.totalSpent.toFixed(0)} spent</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button className="p-1.5 rounded hover:bg-muted" onClick={(e) => { e.stopPropagation(); openEditDialog(customer.id); }}>
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(customer); }}>
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
            <Button className="w-full h-10 gap-2" onClick={handleSave} disabled={saving || !form.name.trim()}>
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
