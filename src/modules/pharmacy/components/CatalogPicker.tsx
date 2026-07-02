"use client";

// ── CatalogPicker ──
// Phase 2: Replaces manual product entry with catalog search + subscribe.
//
// Two modes:
// 1. "Search Catalog" (default) — search 14K+ products, check the ones you carry,
//    enter stock + price, click "Add Selected"
// 2. "Browse by Company" — select a manufacturer, see all their products, check
//    the ones you carry
//
// Also has a "Custom Product" button to switch to the old manual entry form.

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, Loader2, Check, Plus, Building2, Package,
  ChevronRight, ChevronLeft, X, ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface CatalogProduct {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturerStr: string | null;
  categoryName: string | null;
  defaultMrp: number | null;
  unit: string;
  subscribed: boolean;
}

interface Manufacturer {
  id: string;
  name: string;
  productCount: number;
}

interface SelectedItem {
  masterProductId: string;
  stockQty: string;
  sellingPrice: string;
  reorderLevel: string;
  rackNo: string;
  name: string;
}

export function CatalogPicker() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [mode, setMode] = useState<"search" | "browse">("search");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map());
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Search products
  const searchProducts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
      if (query) params.set("q", query);
      const res = await fetch(`/api/businesses/${businessId}/catalog/search?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, query, page]);

  // Browse manufacturers
  const loadManufacturers = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/catalog/browse`);
      const data = await res.json();
      setManufacturers(data.manufacturers || []);
    } catch {
      setManufacturers([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Browse products by manufacturer
  const browseManufacturer = useCallback(async (mfrId: string) => {
    if (!businessId) return;
    setLoading(true);
    setSelectedManufacturer(mfrId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/catalog/browse?manufacturerId=${mfrId}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.products?.length || 0);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (mode === "search") {
      const debounce = setTimeout(() => { setPage(0); searchProducts(); }, 300);
      return () => clearTimeout(debounce);
    }
  }, [query, mode, searchProducts]);

  useEffect(() => {
    if (mode === "browse" && manufacturers.length === 0) {
      loadManufacturers();
    }
  }, [mode, manufacturers.length, loadManufacturers]);

  const toggleSelect = (product: CatalogProduct) => {
    if (product.subscribed) return; // Already subscribed
    const newSelected = new Map(selected);
    if (newSelected.has(product.id)) {
      newSelected.delete(product.id);
    } else {
      newSelected.set(product.id, {
        masterProductId: product.id,
        stockQty: "0",
        sellingPrice: product.defaultMrp ? String(product.defaultMrp) : "",
        reorderLevel: "10",
        rackNo: "",
        name: product.name,
      });
    }
    setSelected(newSelected);
  };

  const updateSelectedItem = (productId: string, field: string, value: string) => {
    const newSelected = new Map(selected);
    const item = newSelected.get(productId);
    if (item) {
      newSelected.set(productId, { ...item, [field]: value });
    }
    setSelected(newSelected);
  };

  const handleAddSelected = async () => {
    if (!businessId || selected.size === 0) return;
    setAdding(true);
    try {
      const items = Array.from(selected.values()).map(item => ({
        masterProductId: item.masterProductId,
        stockQty: parseInt(item.stockQty) || 0,
        sellingPrice: parseFloat(item.sellingPrice) || 0,
        reorderLevel: parseInt(item.reorderLevel) || 0,
        rackNo: item.rackNo || undefined,
      }));

      const res = await fetch(`/api/businesses/${businessId}/catalog/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setToast(`✅ ${data.created} products added to your inventory!`);
      setSelected(new Map());
      // Refresh the product list
      setTimeout(() => {
        setToast(null);
        setActiveView("products");
      }, 2000);
    } catch (err) {
      setToast(`❌ ${err instanceof Error ? err.message : "Failed to add products"}`);
    } finally {
      setAdding(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pb-4 pharmacy-bg"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setActiveView("inventory-hub")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Package className="h-5 w-5 text-primary" /> Add from Catalog
        </h1>
        <Button variant="outline" size="sm" onClick={() => setActiveView("add-product")}>
          <Plus className="h-4 w-4 mr-1" /> Custom Product
        </Button>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "search" ? "default" : "outline"}
          onClick={() => { setMode("search"); setSelectedManufacturer(null); }}
        >
          <Search className="h-4 w-4 mr-1" /> Search
        </Button>
        <Button
          size="sm"
          variant={mode === "browse" ? "default" : "outline"}
          onClick={() => { setMode("browse"); setProducts([]); }}
        >
          <Building2 className="h-4 w-4 mr-1" /> Browse by Company
        </Button>
      </div>

      {/* Search mode */}
      {mode === "search" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 14,000+ products by name, generic, or barcode..."
            className="pl-10 h-11"
            autoFocus
          />
        </div>
      )}

      {/* Browse mode */}
      {mode === "browse" && !selectedManufacturer && (
        <Card>
          <CardContent className="p-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                {manufacturers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => browseManufacturer(m.id)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3 hover:border-emerald-400 hover:shadow-sm transition-all text-left"
                  >
                    <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">{m.name}</span>
                    <Badge variant="secondary" className="text-xs">{m.productCount}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Browse mode — back to manufacturer list */}
      {mode === "browse" && selectedManufacturer && (
        <Button variant="ghost" size="sm" onClick={() => { setSelectedManufacturer(null); setProducts([]); }}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to companies
        </Button>
      )}

      {/* Product results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="text-xs text-muted-foreground px-1">
            {total.toLocaleString()} products found · {selected.size} selected
          </div>
          <div className="space-y-1">
            {products.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-lg border p-3 transition-all cursor-pointer",
                    p.subscribed
                      ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10 opacity-60"
                      : isSelected
                      ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                  onClick={() => !p.subscribed && toggleSelect(p)}
                >
                  <div className="flex items-start gap-2">
                    {/* Checkbox */}
                    <div className={cn(
                      "w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center",
                      p.subscribed
                        ? "border-emerald-500 bg-emerald-500"
                        : isSelected
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-slate-300"
                    )}>
                      {(p.subscribed || isSelected) && <Check className="h-3 w-3 text-white" />}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {p.genericName && <span className="text-xs text-muted-foreground">{p.genericName}</span>}
                        {p.strength && <Badge variant="outline" className="text-xs py-0">{p.strength}</Badge>}
                        {p.dosageForm && <Badge variant="outline" className="text-xs py-0">{p.dosageForm}</Badge>}
                        {p.manufacturerStr && <span className="text-xs text-blue-600">{p.manufacturerStr}</span>}
                        {p.defaultMrp && <span className="text-xs font-mono">৳{p.defaultMrp}</span>}
                      </div>
                      {p.subscribed && (
                        <Badge className="mt-1 bg-emerald-100 text-emerald-700 text-xs">Already in inventory</Badge>
                      )}
                    </div>
                  </div>

                  {/* Stock entry for selected items */}
                  {isSelected && !p.subscribed && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pl-7">
                      <div>
                        <label className="text-xs text-muted-foreground">Stock Qty</label>
                        <Input
                          type="number"
                          value={selected.get(p.id)?.stockQty || "0"}
                          onChange={(e) => updateSelectedItem(p.id, "stockQty", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Sell Price (৳)</label>
                        <Input
                          type="number"
                          value={selected.get(p.id)?.sellingPrice || ""}
                          onChange={(e) => updateSelectedItem(p.id, "sellingPrice", e.target.value)}
                          className="h-8 text-sm"
                          placeholder={p.defaultMrp ? String(p.defaultMrp) : "0"}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Reorder Level</label>
                        <Input
                          type="number"
                          value={selected.get(p.id)?.reorderLevel || "10"}
                          onChange={(e) => updateSelectedItem(p.id, "reorderLevel", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="10"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Rack</label>
                        <Input
                          value={selected.get(p.id)?.rackNo || ""}
                          onChange={(e) => updateSelectedItem(p.id, "rackNo", e.target.value)}
                          className="h-8 text-sm"
                          placeholder="A1"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination (search mode only) */}
          {mode === "search" && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        !loading && mode === "search" && query && (
          <div className="text-center py-12">
            <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No products found for "{query}"</p>
          </div>
        )
      )}

      {/* Add selected button (floating) */}
      {selected.size > 0 && (
        <div className="sticky bottom-16 lg:bottom-4 z-10">
          <Button
            className="w-full h-12 text-base shadow-lg"
            onClick={handleAddSelected}
            disabled={adding}
          >
            {adding ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <ShoppingCart className="h-5 w-5 mr-2" />
            )}
            Add {selected.size} Product{selected.size > 1 ? "s" : ""} to Inventory
          </Button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm shadow-xl"
        >
          {toast}
        </motion.div>
      )}
    </motion.div>
  );
}
