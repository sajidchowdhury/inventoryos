"use client";

// ZoneAddProductDialog — P3 feature
// Modal dialog for manually adding a product to a zone count session.
// Counter can search the business's product directory and tap to add.
// If the product doesn't exist, a lightweight "add new product" shortcut
// creates a minimal product (name + generic + unit) and adds it to the zone.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Loader2, Plus, Check, X, Package, AlertCircle,
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
  manufacturer: string | null;
}

interface ZoneAddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  zoneName: string;
  /** Product IDs already in the zone count (to show "Added" state + prevent duplicates) */
  existingProductIds: Set<string>;
  /** Called when user selects a product from the directory */
  onAddProduct: (productId: string) => Promise<void>;
  /** Called when user creates a new product via the shortcut. Returns the new product's ID. */
  onCreateNewProduct: (data: { name: string; genericName?: string; unit?: string }) => Promise<string>;
}

export function ZoneAddProductDialog({
  open, onOpenChange, businessId, zoneName, existingProductIds, onAddProduct, onCreateNewProduct,
}: ZoneAddProductDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);  // productId being added
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", genericName: "", unit: "piece" });
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setResults([]);
      setError(null);
      setShowCreateForm(false);
      setNewProduct({ name: "", genericName: "", unit: "piece" });
      // Focus search input after a short delay
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

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
        `/api/businesses/${businessId}/products?search=${encodeURIComponent(query)}&limit=20`
      );
      const data = await res.json();
      if (data.success) {
        setResults(data.products || []);
      }
    } catch (e) {
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Trigger debounced search on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, doSearch]);

  const handleAdd = async (productId: string) => {
    setAdding(productId);
    setError(null);
    try {
      await onAddProduct(productId);
      // Don't close — let the user add multiple. Clear search after a brief success state.
      setTimeout(() => setAdding(null), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add product");
      setAdding(null);
    }
  };

  const handleCreateNew = async () => {
    if (!newProduct.name.trim()) {
      setError("Product name is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const newId = await onCreateNewProduct({
        name: newProduct.name.trim(),
        genericName: newProduct.genericName.trim() || undefined,
        unit: newProduct.unit.trim() || "piece",
      });
      // Add the newly created product to the zone
      await onAddProduct(newId);
      // Reset form
      setNewProduct({ name: "", genericName: "", unit: "piece" });
      setShowCreateForm(false);
      setSearch("");
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
            <Package className="h-4 w-4 text-teal-600" />
            Add product to {zoneName}
          </DialogTitle>
          <DialogDescription>
            Search your product directory and tap to add. The product will be auto-assigned to this zone for future counts.
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
              placeholder="Search by product or generic name..."
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
                  onClick={() => {
                    setNewProduct((prev) => ({ ...prev, name: search.trim() }));
                    setShowCreateForm(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create &ldquo;{search.trim()}&rdquo; as a new product
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {results.map((p) => {
                  const alreadyAdded = existingProductIds.has(p.id);
                  const isAdding = adding === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={alreadyAdded || isAdding}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
                        alreadyAdded
                          ? "border-emerald-200 bg-emerald-50 opacity-70"
                          : "border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.98]"
                      )}
                      onClick={() => !alreadyAdded && handleAdd(p.id)}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        alreadyAdded ? "bg-emerald-100" : "bg-teal-50"
                      )}>
                        {alreadyAdded ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : isAdding ? (
                          <Loader2 className="h-4 w-4 text-teal-600 animate-spin" />
                        ) : (
                          <Package className="h-4 w-4 text-teal-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{p.name}</p>
                        {p.genericName && (
                          <p className="text-[10px] text-gray-400 truncate">{p.genericName}</p>
                        )}
                      </div>
                      {alreadyAdded && (
                        <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 border-0 shrink-0">
                          Added
                        </Badge>
                      )}
                    </button>
                  );
                })}
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
                    placeholder="piece / strip / box"
                    className="h-9"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-400">
                Only 3 fields are required here. You can fill in the rest (strength, manufacturer, price, etc.) from the Products tab later.
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
                  className="flex-1 gap-1.5 bg-teal-600 hover:bg-teal-700"
                  onClick={handleCreateNew}
                  disabled={creating || !newProduct.name.trim()}
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {creating ? "Creating..." : "Create & add"}
                </Button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center pt-1">
            Added products are auto-assigned to {zoneName} for future counts.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
