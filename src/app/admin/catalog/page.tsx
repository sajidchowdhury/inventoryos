"use client";

// /admin/catalog — Master Product Catalog management page.
// Search 14K+ products, view by manufacturer, import CSV.

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package, Search, Loader2, RefreshCw, Upload, Building2,
  ChevronLeft, ChevronRight, CheckCircle2,
} from "lucide-react";
import { useAdmin } from "../AdminContext";

interface MasterProduct {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturerStr: string | null;
  categoryName: string | null;
  defaultMrp: number | null;
  unit: string;
  isActive: boolean;
}

interface Manufacturer {
  id: string;
  name: string;
  productCount: number;
}

export default function CatalogPage() {
  const { apiFetch, notify } = useAdmin();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"products" | "manufacturers">("products");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
      if (query) params.set("q", query);
      if (manufacturerFilter) params.set("manufacturer", manufacturerFilter);

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
  }, [apiFetch, page, pageSize, query, manufacturerFilter]);

  const loadManufacturers = useCallback(async () => {
    try {
      const res = await apiFetch("/api/super-admin/master-manufacturers");
      if (!res.ok) return;
      const data = await res.json();
      setManufacturers(data.manufacturers || []);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadManufacturers(); }, [loadManufacturers]);

  const handleSearch = (value: string) => {
    setQuery(value);
    setPage(0);
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
        await loadManufacturers();
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
      {/* Header card with stats + import */}
      <Card className="border-purple-200 dark:border-purple-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Package className="h-5 w-5" />
                Master Product Catalog
              </CardTitle>
              <CardDescription>
                {total.toLocaleString()} products from {manufacturers.length} pharmaceutical companies
              </CardDescription>
            </div>
            <Button onClick={handleImport} disabled={importing} size="sm">
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Import CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tab switcher */}
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant={activeTab === "products" ? "default" : "outline"}
              onClick={() => setActiveTab("products")}
            >
              <Package className="h-4 w-4 mr-1" /> Products ({total.toLocaleString()})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "manufacturers" ? "default" : "outline"}
              onClick={() => setActiveTab("manufacturers")}
            >
              <Building2 className="h-4 w-4 mr-1" /> Manufacturers ({manufacturers.length})
            </Button>
          </div>

          {/* Search bar (products tab only) */}
          {activeTab === "products" && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by name, generic, manufacturer, barcode..."
                  className="pl-10"
                />
              </div>
              {manufacturerFilter && (
                <Button size="sm" variant="ghost" onClick={() => { setManufacturerFilter(""); setPage(0); }}>
                  Clear filter: {manufacturerFilter}
                </Button>
              )}
            </div>
          )}

          {/* Products tab */}
          {activeTab === "products" && (
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No products found. Try a different search or import a CSV.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Generic</th>
                        <th className="text-left p-2 font-medium">Strength</th>
                        <th className="text-left p-2 font-medium">Form</th>
                        <th className="text-left p-2 font-medium">Manufacturer</th>
                        <th className="text-left p-2 font-medium">Category</th>
                        <th className="text-right p-2 font-medium">MRP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p, i) => (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.01, 0.3) }}
                          className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                          onClick={() => manufacturerFilter !== p.manufacturerStr && setManufacturerFilter(p.manufacturerStr || "")}
                        >
                          <td className="p-2 font-medium">{p.name}</td>
                          <td className="p-2 text-muted-foreground text-xs">{p.genericName || "—"}</td>
                          <td className="p-2 text-xs">{p.strength || "—"}</td>
                          <td className="p-2 text-xs">{p.dosageForm || "—"}</td>
                          <td className="p-2 text-xs text-blue-600">{p.manufacturerStr || "—"}</td>
                          <td className="p-2 text-xs">{p.categoryName ? <Badge variant="outline" className="text-xs">{p.categoryName}</Badge> : "—"}</td>
                          <td className="p-2 text-right text-xs font-mono">{p.defaultMrp ? `৳${p.defaultMrp}` : "—"}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-muted-foreground">
                    Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm py-1 px-2">{page + 1} / {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )
          )}

          {/* Manufacturers tab */}
          {activeTab === "manufacturers" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {manufacturers.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:border-blue-300 cursor-pointer transition-colors"
                  onClick={() => { setManufacturerFilter(m.name); setActiveTab("products"); setPage(0); }}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">{m.name}</span>
                    <Badge variant="secondary" className="text-xs">{m.productCount}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info panel */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> About the Master Catalog
          </h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>{total.toLocaleString()} products</strong> from <strong>{manufacturers.length} pharmaceutical companies</strong> in Bangladesh</li>
            <li>• Data sourced from MedEx.com.bd via Kaggle public dataset (21K entries → 14K unique after deduplication)</li>
            <li>• Click a manufacturer name to filter products by that company</li>
            <li>• Click "Import CSV" to bulk upload more products (CSV format: name, genericName, strength, dosageForm, manufacturer, ...)</li>
            <li>• In Phase 2, pharmacies will search this catalog and "subscribe" to products instead of entering them manually</li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
