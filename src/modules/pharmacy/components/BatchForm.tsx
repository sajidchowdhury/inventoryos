"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Boxes, Calendar, AlertCircle, Check,
  Hash, DollarSign, FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface ProductSummary {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  unit: string;
  mrp: number | null;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface BatchFormProps {
  mode: "add" | "edit";
}

export function BatchForm({ mode }: BatchFormProps) {
  const session = useAuthStore((s) => s.session);
  const { activeProductId, editingBatchId, setActiveView } = useNavStore();
  const businessId = session?.business?.id;

  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    batchNo: "",
    mfgDate: "",
    expiryDate: "",
    quantity: "",
    purchasePrice: "",
    mrp: "",
    notes: "",
  });

  const fetchProduct = useCallback(async () => {
    if (!businessId || !activeProductId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${activeProductId}`);
      const data = await res.json();
      if (data.success) {
        const p = data.product;
        setProduct({
          id: p.id,
          name: p.name,
          genericName: p.genericName,
          strength: p.strength,
          unit: p.unit,
          mrp: p.mrp,
        });
        // Pre-fill MRP from product
        if (mode === "add" && p.mrp) {
          setForm((prev) => ({ ...prev, mrp: p.mrp.toString() }));
        }
      }
    } catch (err) {
      console.error("Fetch product error:", err);
    }
  }, [businessId, activeProductId, mode]);

  const fetchBatch = useCallback(async () => {
    if (!businessId || !editingBatchId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/batches/${editingBatchId}`);
      const data = await res.json();
      if (data.success) {
        const b = data.batch;
        setForm({
          batchNo: b.batchNo,
          mfgDate: b.mfgDate ? b.mfgDate.split("T")[0] : "",
          expiryDate: b.expiryDate ? b.expiryDate.split("T")[0] : "",
          quantity: b.quantity.toString(),
          purchasePrice: b.purchasePrice?.toString() || "",
          mrp: b.mrp?.toString() || "",
          notes: b.notes || "",
        });
      }
    } catch (err) {
      console.error("Fetch batch error:", err);
    }
  }, [businessId, editingBatchId]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);
  useEffect(() => { if (mode === "edit") fetchBatch(); }, [mode, fetchBatch]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Calculate days until expiry for live feedback
  const expiryDays = form.expiryDate
    ? Math.floor((new Date(form.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const expirySeverity = expiryDays === null ? null
    : expiryDays < 0 ? "expired"
    : expiryDays <= 30 ? "critical"
    : expiryDays <= 90 ? "warning"
    : "ok";

  const severityConfig = {
    expired: { color: "bg-red-100 text-red-700", label: `Expired ${Math.abs(expiryDays!)}d ago` },
    critical: { color: "bg-red-100 text-red-700", label: `${expiryDays}d left` },
    warning: { color: "bg-orange-100 text-orange-700", label: `${expiryDays}d left` },
    ok: { color: "bg-green-100 text-green-700", label: `${expiryDays}d left` },
  };

  const handleSubmit = async () => {
    if (!businessId || !product) return;
    if (!form.batchNo.trim()) {
      setError("Batch number is required");
      return;
    }
    if (!form.expiryDate) {
      setError("Expiry date is required");
      return;
    }
    if (mode === "add" && (!form.quantity || parseFloat(form.quantity) <= 0)) {
      setError("Quantity must be greater than 0 for new batches");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      productId: activeProductId,
      batchNo: form.batchNo.trim(),
      mfgDate: form.mfgDate || null,
      expiryDate: form.expiryDate,
      quantity: parseFloat(form.quantity) || 0,
      purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
      mrp: form.mrp ? parseFloat(form.mrp) : null,
      notes: form.notes.trim() || null,
    };

    try {
      const url = mode === "edit" && editingBatchId
        ? `/api/businesses/${businessId}/batches/${editingBatchId}`
        : `/api/businesses/${businessId}/batches`;
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save batch");

      setSuccess(true);
      setTimeout(() => setActiveView("product-detail"), 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save batch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("product-detail")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">
          {mode === "edit" ? "Edit Batch" : "Add Batch"}
        </h1>
      </div>

      {/* Product Context Card */}
      {product && (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">For product</p>
            <p className="text-sm font-semibold">{product.name}</p>
            {product.genericName && (
              <p className="text-xs text-muted-foreground">{product.genericName}</p>
            )}
            {product.strength && (
              <Badge variant="secondary" className="text-[10px] mt-1">{product.strength}</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-500/50 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4 shrink-0" /> Batch saved successfully!
          </CardContent>
        </Card>
      )}

      {/* Batch Info */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Hash className="h-4 w-4" /> Batch Information
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Batch Number *</Label>
              <Input
                placeholder="e.g., SQ240101, BX230915"
                value={form.batchNo}
                onChange={(e) => updateField("batchNo", e.target.value)}
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground">
                Usually printed on the strip/box by the manufacturer
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Mfg Date</Label>
                <Input
                  type="date"
                  value={form.mfgDate}
                  onChange={(e) => updateField("mfgDate", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Expiry Date *</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => updateField("expiryDate", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {expirySeverity && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge className={cn("text-[10px]", severityConfig[expirySeverity].color)}>
                  {severityConfig[expirySeverity].label}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quantity & Pricing */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Boxes className="h-4 w-4" /> Quantity & Pricing
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Quantity {mode === "add" ? "*" : "(adjusts stock)"} <span className="text-muted-foreground">in {product?.unit || "units"}</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => updateField("quantity", e.target.value)}
                className="h-10"
              />
              {mode === "edit" && (
                <p className="text-[10px] text-orange-600">
                  ⚠️ Changing quantity will adjust total stock. Use Stock In/Out for sales &amp; purchases.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Purchase Price (৳)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.purchasePrice}
                  onChange={(e) => updateField("purchasePrice", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">MRP (৳)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.mrp}
                  onChange={(e) => updateField("mrp", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <FileText className="h-4 w-4" /> Notes
          </div>
          <Textarea
            placeholder="Optional notes (e.g., supplier name, special instructions)"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            className="min-h-[70px] text-sm"
          />
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={handleSubmit}
        disabled={saving || !form.batchNo.trim() || !form.expiryDate}
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : mode === "edit" ? "Update Batch" : "Add Batch"}
      </Button>
    </motion.div>
  );
}
