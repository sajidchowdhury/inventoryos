"use client";

// ── ManualMatchModal ──
// Lets the user pick an existing product from the business's OWN inventory to
// link to a shelf-scan detection. Used when the AI match was wrong or the
// detection was "unmatched" and the user knows which product it is.
//
// Searches GET /api/businesses/[id]/products?search=… and calls onSelect with
// the chosen product. Mirrors the search + card-list pattern from ProductList.

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Pill, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface InventoryProduct {
  id: string;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  rackNo?: string | null;
  sellingPrice?: number | null;
  mrp?: number | null;
  unit: string;
  inventory?: { quantity: number } | null;
}

interface ManualMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedName: string;
  onSelect: (product: InventoryProduct) => void;
}

export function ManualMatchModal({
  open,
  onOpenChange,
  detectedName,
  onSelect,
}: ManualMatchModalProps) {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill the search with the detected name so the user sees candidates immediately
  useEffect(() => {
    if (open && detectedName && !query) {
      setQuery(detectedName);
    }
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedId(null);
    }
  }, [open, detectedName]);

  const runSearch = useCallback(async (q: string) => {
    if (!businessId || !q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ search: q.trim(), page: "1", limit: "20" });
      const res = await fetch(`/api/businesses/${businessId}/products?${params}`);
      const data = await res.json();
      setResults(data.success ? (data.products as InventoryProduct[]) : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Debounced search — fire 350ms after the user stops typing
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, runSearch]);

  const handleConfirm = () => {
    if (!selectedId) return;
    const chosen = results.find((p) => p.id === selectedId);
    if (chosen) onSelect(chosen);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-600" />
            Match to a product
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Detected as <span className="font-medium text-foreground">“{detectedName}”</span>.
            Search your inventory and pick the right product.
          </p>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or generic…"
            className="pl-9 h-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-[200px] max-h-[45vh]">
          {!loading && results.length === 0 && query.trim() && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No products found. Try a different search.
            </div>
          )}
          {!loading && results.length === 0 && !query.trim() && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Start typing to search your inventory.
            </div>
          )}
          <div className="space-y-1.5">
            {results.map((p) => {
              const qty = p.inventory?.quantity ?? 0;
              const isSelected = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-2.5 transition-all flex items-start gap-2",
                    isSelected
                      ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center",
                    isSelected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {qty} {p.unit}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {p.strength && (
                        <Badge variant="outline" className="text-[10px] py-0">{p.strength}</Badge>
                      )}
                      {p.dosageForm && (
                        <Badge variant="outline" className="text-[10px] py-0">{p.dosageForm}</Badge>
                      )}
                      {p.manufacturer && (
                        <span className="text-[10px] text-blue-600">{p.manufacturer}</span>
                      )}
                      {p.rackNo && (
                        <span className="text-[10px] text-muted-foreground"> Rack {p.rackNo}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={!selectedId}
            onClick={handleConfirm}
          >
            <Pill className="h-4 w-4 mr-1.5" />
            Match product
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { InventoryProduct };
