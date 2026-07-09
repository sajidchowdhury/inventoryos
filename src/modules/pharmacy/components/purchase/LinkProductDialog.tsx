"use client";

// LinkProductDialog — P3 feature
// Modal dialog for linking an unmatched scanned item to an existing product
// in the business's catalog, or creating a new minimal product on the fly.
//
// Used in PurchaseForm cart items that have matchedMethod === "unmatched"
// (no productId). The user searches the directory, picks a product, and the
// cart item is linked. If the product doesn't exist, "Create new product"
// creates a minimal product (name + generic + unit) then links it.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Loader2, Plus, Check, X, Package, AlertCircle, Link2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProductOption {
  id: string;
  name: string;
  genericName: string | null;
  unit: string;
  mrp: number | null;
}

interface LinkProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  /** The detected product name to link (pre-fills the search + shown in header) */
  detectedName: string;
  /** Called when user picks an existing product from the directory */
  onLink: (productId: string, product: ProductOption) => void;
  /** Called when user creates a new product. Returns the new product. */
  onCreateNew: (data: { name: string; genericName?: string; unit?: string }) => Promise<ProductOption>;
}

export function LinkProductDialog({
  open, onOpenChange, businessId, detectedName, onLink, onCreateNew,
}: LinkProductDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", genericName: "", unit: "box" });
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset + pre-fill search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch(detectedName);
      setResults([]);
      setError(null);
      setShowCreateForm(false);
      setNewProduct({
        name: detectedName,
        genericName: "",
        unit: "box",
      });
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open, detectedName]);

  // Debounced search
  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/products?search=${encodeURIComponent(query)}&limit=15`
      );
      const data = await res.json();
      if (data.success) {
        setResults(data.products || []);
      }
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, doSearch]);

  const handleLink = (product: ProductOption) => {
    onLink(product.id, product);
    onOpenChange(false);
  };

  const handleCreateNew = async () => {
    if (!newProduct.name.trim()) {
      setError("Product name is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await onCreateNew({
        name: newProduct.name.trim(),
        genericName: newProduct.genericName.trim() || undefined,
        unit: newProduct.unit.trim() || "box",
      });
      // Auto-link the newly created product
      onLink(created.id, created);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create product");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-600" />
            Link to product
          </DialogTitle>
          <DialogDescription className="truncate">
            Detected: <span className="font-medium text-gray-700">{detectedName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Search your product directory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
            {search && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search results */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : search.trim().length >= 2 ? (
            results.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center py-3">
                  No products match &ldquo;{search}&rdquo;
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create &ldquo;{search.trim()}&rdquo; as a new product
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white hover:bg-amber-50 px-3 py-2 text-left transition-all active:scale-[0.98]"
                    onClick={() => handleLink(p)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      {p.genericName && (
                        <p className="text-[10px] text-gray-400 truncate">{p.genericName} · {p.unit}</p>
                      )}
                    </div>
                    <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">
              Type at least 2 characters to search
            </p>
          )}

          {/* Create new product shortcut */}
          {!showCreateForm ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-gray-500"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Product not in directory? Add a new one
            </Button>
          ) : (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Quick add new product
              </p>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Product name *</Label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Napa Extra"
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Generic name</Label>
                  <Input
                    value={newProduct.genericName}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, genericName: e.target.value }))}
                    placeholder="e.g., Paracetamol"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Unit</Label>
                  <Input
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="box / strip / piece"
                    className="h-9"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400">
                Only 3 fields needed here. Fill in the rest (strength, manufacturer, price) from the Products tab later.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700"
                  onClick={handleCreateNew}
                  disabled={creating || !newProduct.name.trim()}
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {creating ? "Creating..." : "Create & link"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
