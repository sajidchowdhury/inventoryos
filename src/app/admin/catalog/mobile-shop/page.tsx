"use client";

// /admin/catalog/mobile-shop — MobileShop Master Product Catalog management page.
// Search products, create/edit/delete, import CSV, review user-submitted products.

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Smartphone, Search, Loader2, RefreshCw, Upload, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, Package,
} from "lucide-react";
import { useAdmin } from "../../AdminContext";

interface MSMasterProduct {
  id: string;
  name: string;
  brand: string;
  model: string;
  sku: string | null;
  description: string | null;
  hsnCode: string | null;
  defaultCategoryName: string | null;
  defaultWarrantyMonths: number;
  defaultSerialTracked: boolean;
  defaultUnit: string;
  defaultImageUrl: string | null;
  defaultVatRate: number;
  defaultMrp: number | null;
  isActive: boolean;
  isApproved: boolean;
  manufacturer?: { id: string; name: string } | null;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "", brand: "", model: "", sku: "", description: "", hsnCode: "",
  defaultCategoryName: "", defaultWarrantyMonths: "12", defaultSerialTracked: true,
  defaultUnit: "piece", defaultImageUrl: "", defaultVatRate: "15", defaultMrp: "",
  manufacturer: "",
};

export default function MSCatalogPage() {
  const { apiFetch, notify } = useAdmin();
  const [products, setProducts] = useState<MSMasterProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);
  const [activeTab, setActiveTab] = useState<"approved" | "pending">("approved");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // CSV import state
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
        approved: activeTab === "approved" ? "true" : "false",
      });
      if (query) params.set("q", query);
      const res = await apiFetch(`/api/super-admin/mobile-shop-master-products?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, pageSize, query, activeTab]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (val: string) => {
    setQuery(val);
    setPage(0);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: MSMasterProduct) => {
    setForm({
      name: p.name, brand: p.brand, model: p.model, sku: p.sku || "",
      description: p.description || "", hsnCode: p.hsnCode || "",
      defaultCategoryName: p.defaultCategoryName || "",
      defaultWarrantyMonths: String(p.defaultWarrantyMonths),
      defaultSerialTracked: p.defaultSerialTracked,
      defaultUnit: p.defaultUnit, defaultImageUrl: p.defaultImageUrl || "",
      defaultVatRate: String(p.defaultVatRate),
      defaultMrp: p.defaultMrp ? String(p.defaultMrp) : "",
      manufacturer: p.manufacturer?.name || "",
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.brand.trim() || !form.model.trim()) {
      notify("err", "Name, brand, and model are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        defaultWarrantyMonths: parseInt(form.defaultWarrantyMonths) || 0,
        defaultVatRate: parseFloat(form.defaultVatRate) || 0,
        defaultMrp: form.defaultMrp ? parseFloat(form.defaultMrp) : null,
      };
      const url = editingId
        ? `/api/super-admin/mobile-shop-master-products/${editingId}`
        : `/api/super-admin/mobile-shop-master-products`;
      const res = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        notify("ok", editingId ? "Product updated" : "Product created");
        setShowForm(false);
        load();
      } else {
        notify("err", data.error || "Failed to save");
      }
    } catch {
      notify("err", "Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will deactivate it (soft delete).`)) return;
    try {
      const res = await apiFetch(`/api/super-admin/mobile-shop-master-products/${id}`, { method: "DELETE" });
      if (res.ok) {
        notify("ok", "Product deactivated");
        load();
      } else {
        notify("err", "Failed to delete");
      }
    } catch {
      notify("err", "Network error");
    }
  };

  const handleApprove = async (id: string, approve: boolean) => {
    try {
      const res = await apiFetch(`/api/super-admin/mobile-shop-master-products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: approve, isActive: approve }),
      });
      if (res.ok) {
        notify("ok", approve ? "Product approved" : "Product rejected");
        load();
      } else {
        notify("err", "Failed to update");
      }
    } catch {
      notify("err", "Network error");
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      notify("err", "Paste CSV data first");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      // Parse CSV and create products one by one
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        notify("err", "CSV needs a header row + at least 1 data row");
        return;
      }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      let created = 0, updated = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        const row: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) row[headers[j]] = (values[j] || "").trim();

        const name = row.name || row.productname;
        const brand = row.brand;
        const model = row.model;
        if (!name || !brand || !model) {
          errors.push(`Row ${i + 1}: missing name, brand, or model`);
          continue;
        }

        const payload = {
          name, brand, model,
          sku: row.sku || "", description: row.description || "",
          hsnCode: row.hsncode || row.hsn_code || "",
          defaultCategoryName: row.category || row.defaultcategoryname || "",
          defaultWarrantyMonths: parseInt(row.warranty || row.defaultwarrantymonths || "0") || 0,
          defaultSerialTracked: (row.serial || row.defaultserialtracked || "false").toLowerCase() === "true",
          defaultUnit: row.unit || "piece",
          defaultVatRate: parseFloat(row.vatrate || row.defaultvatrate || "0") || 0,
          defaultMrp: row.mrp ? parseFloat(row.mrp) : null,
          manufacturer: row.manufacturer || brand,
        };

        const res = await apiFetch("/api/super-admin/mobile-shop-master-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 201) created++;
        else if (res.status === 409) updated++;
        else errors.push(`Row ${i + 1}: ${brand} ${model} — failed`);
      }

      setImportResult({ created, updated, errors });
      if (created > 0 || updated > 0) {
        notify("ok", `Imported: ${created} created, ${updated} already existed`);
        load();
      }
    } catch {
      notify("err", "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-purple-400" />
            MobileShop Master Catalog
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage the shared MobileShop product catalog. Shops subscribe to these products.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={openCreate} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Tabs: Approved vs Pending Review */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "approved" ? "default" : "outline"}
          size="sm"
          onClick={() => { setActiveTab("approved"); setPage(0); }}
          className={activeTab === "approved" ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" /> Approved
        </Button>
        <Button
          variant={activeTab === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => { setActiveTab("pending"); setPage(0); }}
          className={activeTab === "pending" ? "bg-amber-600 hover:bg-amber-700" : ""}
        >
          <Package className="h-4 w-4 mr-1" /> Pending Review
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, brand, model, SKU, HSN code..."
            className="pl-10 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="text-sm text-slate-400">
        {loading ? "Loading..." : `${total} product${total !== 1 ? "s" : ""} ${activeTab === "pending" ? "pending review" : "in catalog"}`}
      </div>

      {/* Product table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Package className="h-10 w-10 mb-2 opacity-50" />
              <p>No products found</p>
              <p className="text-xs mt-1">
                {activeTab === "pending"
                  ? "User-submitted products will appear here for review"
                  : "Click 'Add Product' or 'Import CSV' to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Brand</th>
                    <th className="text-left p-3 font-medium">Model</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-right p-3 font-medium">MRP</th>
                    <th className="text-center p-3 font-medium">Serial</th>
                    <th className="text-center p-3 font-medium">Warranty</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-3 text-white max-w-xs">
                        <div className="truncate" title={p.name}>{p.name}</div>
                        {p.sku && <div className="text-xs text-slate-500">SKU: {p.sku}</div>}
                      </td>
                      <td className="p-3 text-slate-300">{p.brand}</td>
                      <td className="p-3 text-slate-300 font-mono text-xs">{p.model}</td>
                      <td className="p-3 text-slate-300">{p.defaultCategoryName || "—"}</td>
                      <td className="p-3 text-right text-slate-300">
                        {p.defaultMrp ? `৳${p.defaultMrp.toLocaleString()}` : "—"}
                      </td>
                      <td className="p-3 text-center">
                        {p.defaultSerialTracked ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-700">Yes</Badge>
                        ) : (
                          <span className="text-slate-600">No</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-300">
                        {p.defaultWarrantyMonths > 0 ? `${p.defaultWarrantyMonths}mo` : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {activeTab === "pending" ? (
                            <>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => handleApprove(p.id, true)}
                                className="text-emerald-400 hover:text-emerald-300 h-8 w-8 p-0"
                                title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => handleApprove(p.id, false)}
                                className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => openEdit(p)}
                                className="text-slate-400 hover:text-white h-8 w-8 p-0"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => handleDelete(p.id, p.name)}
                                className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-slate-400 px-2">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? "Edit Product" : "Add MobileShop Master Product"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingId ? "Update the master catalog entry" : "Add a new product to the shared catalog"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Product Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="DS-2CD2143G2-I 4MP Bullet Camera" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Brand *</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Hikvision" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Model *</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="DS-2CD2143G2-I" className="bg-slate-800 border-slate-700 text-white font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Manufacturer</Label>
              <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                placeholder="Hikvision" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">SKU</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="HKV-2143" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Category</Label>
              <Input value={form.defaultCategoryName} onChange={(e) => setForm({ ...form, defaultCategoryName: e.target.value })}
                placeholder="Cameras, DVR/NVR, Cables" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">HSN Code</Label>
              <Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
                placeholder="8525.89.00" className="bg-slate-800 border-slate-700 text-white font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Default Unit</Label>
              <Input value={form.defaultUnit} onChange={(e) => setForm({ ...form, defaultUnit: e.target.value })}
                placeholder="piece, roll, meter" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Warranty (months)</Label>
              <Input type="number" value={form.defaultWarrantyMonths}
                onChange={(e) => setForm({ ...form, defaultWarrantyMonths: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">VAT Rate (%)</Label>
              <Input type="number" value={form.defaultVatRate}
                onChange={(e) => setForm({ ...form, defaultVatRate: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Default MRP (৳)</Label>
              <Input type="number" value={form.defaultMrp}
                onChange={(e) => setForm({ ...form, defaultMrp: e.target.value })}
                placeholder="6500" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Serial Tracked?</Label>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="serialTracked" checked={form.defaultSerialTracked}
                  onChange={(e) => setForm({ ...form, defaultSerialTracked: e.target.checked })}
                  className="h-4 w-4 rounded" />
                <label htmlFor="serialTracked" className="text-sm text-slate-300">
                  Track individual serial numbers
                </label>
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Description</Label>
              <Textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="4MP AcuSense Bullet Smartphone, 2.8mm lens, IR up to 40m..."
                className="bg-slate-800 border-slate-700 text-white" rows={2} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300">Image URL (optional)</Label>
              <Input value={form.defaultImageUrl}
                onChange={(e) => setForm({ ...form, defaultImageUrl: e.target.value })}
                placeholder="https://..." className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Import MobileShop Products via CSV</DialogTitle>
            <DialogDescription className="text-slate-400">
              Paste CSV data with columns: name, brand, model, sku, description, hsnCode, category, warranty, serial, unit, vatRate, mrp, manufacturer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`name,brand,model,sku,category,hsnCode,warranty,serial,unit,vatRate,mrp,manufacturer
DS-2CD2183G2-I 4MP Dome,Hikvision,DS-2CD2183G2-I,HKV-2183,Cameras,8525.89.00,12,true,piece,15,5800,Hikvision
DH-XVR5108H-4KL-I 8-Ch DVR,Dahua,DH-XVR5108H,DH-5108,DVR/NVR,8517.62.00,24,true,piece,15,9500,Dahua`}
              className="bg-slate-800 border-slate-700 text-white font-mono text-xs"
              rows={8}
            />

            {importResult && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
                <div className="flex gap-4 text-slate-300">
                  <span className="text-emerald-400">Created: {importResult.created}</span>
                  <span className="text-amber-400">Already existed: {importResult.updated}</span>
                  <span className="text-red-400">Errors: {importResult.errors.length}</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-400 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                    {importResult.errors.length > 5 && <div>...and {importResult.errors.length - 5} more</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImport(false); setCsvText(""); setImportResult(null); }}>
              Close
            </Button>
            <Button onClick={handleImport} disabled={importing} className="bg-purple-600 hover:bg-purple-700 gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
