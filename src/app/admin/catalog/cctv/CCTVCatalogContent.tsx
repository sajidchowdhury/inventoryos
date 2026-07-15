"use client";

// CCTVCatalogContent — CCTV Master Product Catalog management UI.
// Extracted from /admin/catalog/cctv/page.tsx so it can be embedded
// inside the consolidated /admin/cctv dashboard (one menu per business).

import { useEffect, useState, useCallback } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Search, Loader2, Upload, Plus, Pencil, Trash2,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, Package, Download,
} from "lucide-react";
import { useAdmin } from "../../AdminContext";

interface MasterProduct {
  id: string;
  name: string;
  brand: string;
  model: string;
  sku: string | null;
  description: string | null;
  hsnCode: string | null;
  categoryName: string | null;
  defaultWarrantyMonths: number;
  defaultSerialTracked: boolean;
  defaultUnit: string;
  defaultVatRate: number;
  defaultMrp: number | null;
  manufacturerStr: string | null;
  isActive: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "", brand: "", model: "", sku: "", description: "", hsnCode: "",
  categoryName: "", defaultWarrantyMonths: "12", defaultSerialTracked: true,
  defaultUnit: "piece", defaultVatRate: "15", defaultMrp: "",
  manufacturer: "",
};

export function CCTVCatalogContent() {
  const { apiFetch, notify } = useAdmin();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // CSV import state
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (query) params.set("q", query);
      const res = await apiFetch(`/api/super-admin/master-products?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, pageSize, query]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (val: string) => {
    setQuery(val);
    setPage(0);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.brand.trim()) {
      notify("err", "Name and brand are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        model: form.model.trim() || null,
        sku: form.sku.trim() || null,
        description: form.description.trim() || null,
        hsnCode: form.hsnCode.trim() || null,
        categoryName: form.categoryName.trim() || null,
        manufacturerStr: form.manufacturer.trim() || form.brand.trim(),
        defaultWarrantyMonths: parseInt(form.defaultWarrantyMonths) || 0,
        defaultSerialTracked: form.defaultSerialTracked,
        defaultUnit: form.defaultUnit || "piece",
        defaultVatRate: parseFloat(form.defaultVatRate) || 0,
        defaultMrp: parseFloat(form.defaultMrp) || null,
      };

      const url = editingId
        ? `/api/super-admin/master-products/${editingId}`
        : `/api/super-admin/master-products`;
      const method = editingId ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      notify("ok", editingId ? "Product updated" : "Product created");
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: MasterProduct) => {
    setForm({
      name: p.name,
      brand: p.brand,
      model: p.model,
      sku: p.sku || "",
      description: p.description || "",
      hsnCode: p.hsnCode || "",
      categoryName: p.categoryName || "",
      defaultWarrantyMonths: String(p.defaultWarrantyMonths),
      defaultSerialTracked: p.defaultSerialTracked,
      defaultUnit: p.defaultUnit,
      defaultVatRate: String(p.defaultVatRate),
      defaultMrp: p.defaultMrp ? String(p.defaultMrp) : "",
      manufacturer: p.manufacturerStr || p.brand,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      const res = await apiFetch(`/api/super-admin/master-products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      notify("ok", "Product deleted");
      await load();
    } catch {
      notify("err", "Failed to delete");
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        const res = await apiFetch("/api/super-admin/master-products/import", {
          method: "POST",
          body: JSON.stringify({ csv: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        notify("ok", `Import complete: ${data.imported} new, ${data.updated} updated, ${data.skipped} skipped`);
        await load();
      } catch (err) {
        notify("err", err instanceof Error ? err.message : "Import failed");
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      {/* Header card */}
      <Card className="border-violet-200 dark:border-violet-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
                <Camera className="h-5 w-5" />
                CCTV Master Product Catalog
              </CardTitle>
              <CardDescription>
                {total.toLocaleString()} products — upload CSV with category names (no IDs needed)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <a href="/templates/master-catalog-cctv-template.csv" download>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" /> Template
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Import CSV
              </Button>
              <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, brand, or model..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* CSV instructions */}
          <div className="mb-4 p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-900">
            <p className="text-xs text-violet-700 dark:text-violet-400 font-semibold mb-1">CSV Format:</p>
            <p className="text-xs text-muted-foreground">
              <code>name, brand, model, category, description, hsnCode, defaultWarrantyMonths, defaultSerialTracked, defaultUnit, defaultVatRate, defaultMrp</code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Download the template file above for a ready-to-use example. Category names are text (e.g. "Cameras", "DVR/NVR") — no IDs needed.
            </p>
          </div>

          {/* Products table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No products found. Import a CSV or add manually.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Brand</th>
                    <th className="text-left p-2 font-medium">Model</th>
                    <th className="text-left p-2 font-medium">Category</th>
                    <th className="text-center p-2 font-medium">Warranty</th>
                    <th className="text-center p-2 font-medium">Serial</th>
                    <th className="text-right p-2 font-medium">MRP</th>
                    <th className="text-center p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-muted-foreground">{p.brand}</td>
                      <td className="p-2 text-muted-foreground">{p.model}</td>
                      <td className="p-2">
                        {p.categoryName && <Badge variant="secondary">{p.categoryName}</Badge>}
                      </td>
                      <td className="p-2 text-center">{p.defaultWarrantyMonths > 0 ? `${p.defaultWarrantyMonths}m` : "—"}</td>
                      <td className="p-2 text-center">
                        {p.defaultSerialTracked ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" /> : <XCircle className="h-4 w-4 text-gray-300 mx-auto" />}
                      </td>
                      <td className="p-2 text-right">{p.defaultMrp ? `৳${p.defaultMrp.toLocaleString()}` : "—"}</td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Edit Product" : "Add Product"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Brand *</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Category (name)</Label>
                <Input value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} placeholder="e.g. Cameras" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Warranty (months)</Label>
                <Input type="number" value={form.defaultWarrantyMonths} onChange={(e) => setForm({ ...form, defaultWarrantyMonths: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Default MRP (৳)</Label>
                <Input type="number" value={form.defaultMrp} onChange={(e) => setForm({ ...form, defaultMrp: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">HSN Code</Label>
                <Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input value={form.defaultUnit} onChange={(e) => setForm({ ...form, defaultUnit: e.target.value })} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="serialTracked" checked={form.defaultSerialTracked} onChange={(e) => setForm({ ...form, defaultSerialTracked: e.target.checked })} />
                <Label htmlFor="serialTracked" className="text-xs cursor-pointer">Serial tracked (each item has unique serial number)</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
