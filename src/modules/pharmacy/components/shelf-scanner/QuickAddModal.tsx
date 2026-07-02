"use client";

// ── QuickAddModal ──
// Slim inline form to create a NEW client Product from a shelf-scan detection
// that didn't match any existing inventory item. Prefilled with the detected
// name/strength/form/manufacturer so the user just reviews + saves.
//
// Posts to POST /api/businesses/[id]/products (the standard product-create
// endpoint). On success calls onCreated with the new product so the scanner
// can link the ShelfScanItem to it.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";

export interface QuickAddPrefill {
  name: string;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
}

interface CreatedProduct {
  id: string;
  name: string;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  unit: string;
  rackNo?: string | null;
  reorderLevel?: number | null;
  sellingPrice?: number | null;
  mrp?: number | null;
  inventory?: { quantity: number } | null;
}

interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: QuickAddPrefill;
  onCreated: (product: CreatedProduct) => void;
}

export function QuickAddModal({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: QuickAddModalProps) {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [rackNo, setRackNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill when opened
  useEffect(() => {
    if (open) {
      setName(prefill.name || "");
      setStrength(prefill.strength || "");
      setDosageForm(prefill.dosageForm || "");
      setManufacturer(prefill.manufacturer || "");
      setSellingPrice("");
      setReorderLevel("");
      setRackNo("");
      setError(null);
    }
  }, [open, prefill]);

  const handleSave = async () => {
    if (!businessId) return;
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        strength: strength.trim() || null,
        dosageForm: dosageForm.trim() || null,
        manufacturer: manufacturer.trim() || null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        // Use mrp field since ProductForm maps sellingPrice→mrp in some paths;
        // the bulk-update endpoint reads sellingPrice off Product. We set both
        // to be safe.
        mrp: sellingPrice ? parseFloat(sellingPrice) : null,
        reorderLevel: reorderLevel ? parseFloat(reorderLevel) : 0,
        rackNo: rackNo.trim() || null,
        unit: "piece",
        productType: "medicine",
      };
      const res = await fetch(`/api/businesses/${businessId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product");

      onCreated({
        id: data.product.id,
        name: data.product.name,
        strength: data.product.strength,
        dosageForm: data.product.dosageForm,
        manufacturer: data.product.manufacturer,
        unit: data.product.unit || "piece",
        rackNo: data.product.rackNo,
        reorderLevel: data.product.reorderLevel,
        sellingPrice: data.product.sellingPrice,
        mrp: data.product.mrp,
        inventory: null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            Quick add product
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Not in your inventory. Create it now — prefilled from the AI detection.
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 mt-1"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Strength</Label>
              <Input
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="500mg"
                className="h-10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Form</Label>
              <Input
                value={dosageForm}
                onChange={(e) => setDosageForm(e.target.value)}
                placeholder="Tablet"
                className="h-10 mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Manufacturer</Label>
            <Input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="Square, Beximco…"
              className="h-10 mt-1"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Sell price (৳)</Label>
              <Input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
                className="h-10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Reorder</Label>
              <Input
                type="number"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="10"
                className="h-10 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Rack</Label>
              <Input
                value={rackNo}
                onChange={(e) => setRackNo(e.target.value)}
                placeholder="A3"
                className="h-10 mt-1"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={saving || !name.trim()}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Create & link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
