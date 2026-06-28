"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Pill, Tag, Box, Thermometer,
  MapPin, Hash, DollarSign, AlertCircle, Check,
  Sparkles, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  slug: string;
}

interface ProductData {
  id: string;
  name: string;
  genericName: string | null;
  sku: string | null;
  barcode: string | null;
  productType: string;
  unit: string;
  stripSize: number | null;
  boxSize: number | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  scheduleType: string | null;
  hsnCode: string | null;
  vatRate: number;
  mrp: number | null;
  isPrescription: boolean;
  storageCondition: string | null;
  rackNo: string | null;
  minStock: number;
  maxStock: number;
  reorderLevel: number;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const dosageForms = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Inhaler", "Powder", "Suspension", "Lotion", "Gel", "Suppository"];
const scheduleTypes = ["OTC", "Schedule_H", "Schedule_H1", "Schedule_X", "Narcotic"];
const storageConditions = ["Room Temp", "Fridge (2-8°C)", "Cool & Dry", "Freezer", "Protect from Light"];
const productTypes = ["medicine", "surgical", "cosmetic", "supplement", "baby-care", "other"];
const units = ["piece", "tablet", "capsule", "strip", "box", "bottle", "tube", "sachet", "ml", "g", "kg"];

/** Shared input styling — rounded-xl corners with emerald focus ring. */
const inputClass =
  "h-10 rounded-xl focus-visible:border-emerald-500/70 focus-visible:ring-emerald-500/30";

interface ProductFormProps {
  mode: "add" | "edit";
}

export function ProductForm({ mode }: ProductFormProps) {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, editingProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    genericName: "",
    sku: "",
    barcode: "",
    productType: "medicine",
    unit: "piece",
    stripSize: "",
    boxSize: "",
    strength: "",
    dosageForm: "",
    manufacturer: "",
    scheduleType: "",
    hsnCode: "",
    vatRate: "0",
    mrp: "",
    isPrescription: false,
    storageCondition: "",
    rackNo: "",
    minStock: "0",
    maxStock: "0",
    reorderLevel: "0",
    categoryId: "",
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const fetchCategories = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories`);
      const data = await res.json();
      if (data.success) setCategories(data.allCategories || []);
    } catch (err) {
      console.error("Categories fetch error:", err);
    }
  }, [businessId]);

  const fetchProduct = useCallback(async () => {
    if (!businessId || !editingProductId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${editingProductId}`);
      const data = await res.json();
      if (data.success && data.product) {
        const p: ProductData = data.product;
        setForm({
          name: p.name,
          genericName: p.genericName || "",
          sku: p.sku || "",
          barcode: p.barcode || "",
          productType: p.productType,
          unit: p.unit,
          stripSize: p.stripSize?.toString() || "",
          boxSize: p.boxSize?.toString() || "",
          strength: p.strength || "",
          dosageForm: p.dosageForm || "",
          manufacturer: p.manufacturer || "",
          scheduleType: p.scheduleType || "",
          hsnCode: p.hsnCode || "",
          vatRate: p.vatRate?.toString() || "0",
          mrp: p.mrp?.toString() || "",
          isPrescription: p.isPrescription,
          storageCondition: p.storageCondition || "",
          rackNo: p.rackNo || "",
          minStock: p.minStock?.toString() || "0",
          maxStock: p.maxStock?.toString() || "0",
          reorderLevel: p.reorderLevel?.toString() || "0",
          categoryId: p.categoryId || "",
        });
      }
    } catch (err) {
      console.error("Product fetch error:", err);
    }
  }, [businessId, editingProductId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { if (mode === "edit") fetchProduct(); }, [mode, fetchProduct]);

  const handleSubmit = async () => {
    if (!businessId) return;
    if (!form.name.trim()) {
      setError("Product name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      genericName: form.genericName.trim() || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      productType: form.productType,
      unit: form.unit,
      stripSize: form.stripSize ? parseInt(form.stripSize) : null,
      boxSize: form.boxSize ? parseInt(form.boxSize) : null,
      strength: form.strength.trim() || null,
      dosageForm: form.dosageForm || null,
      manufacturer: form.manufacturer.trim() || null,
      scheduleType: form.scheduleType || null,
      hsnCode: form.hsnCode.trim() || null,
      vatRate: parseFloat(form.vatRate) || 0,
      mrp: form.mrp ? parseFloat(form.mrp) : null,
      isPrescription: form.isPrescription,
      storageCondition: form.storageCondition || null,
      rackNo: form.rackNo.trim() || null,
      minStock: parseFloat(form.minStock) || 0,
      maxStock: parseFloat(form.maxStock) || 0,
      reorderLevel: parseFloat(form.reorderLevel) || 0,
      categoryId: form.categoryId || null,
    };

    try {
      const url = mode === "edit"
        ? `/api/businesses/${businessId}/products/${editingProductId}`
        : `/api/businesses/${businessId}/products`;
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product");

      setSuccess(true);
      setTimeout(() => {
        setActiveView("products");
      }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleAISuggestCategory = async () => {
    if (!businessId || !form.name.trim()) return;
    setAiSuggesting(true);
    setAiSuggestion(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/product-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest_category",
          productName: form.name.trim(),
          genericName: form.genericName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.suggestion) {
        const suggestedName = (data.suggestion.suggestedCategory || "").toLowerCase().trim();
        if (!suggestedName) {
          setAiSuggestion(data.fallbackMessage || "Unable to suggest a category");
          return;
        }
        const match = categories.find(
          (c) =>
            c.name.toLowerCase() === suggestedName ||
            c.name.toLowerCase().includes(suggestedName) ||
            suggestedName.includes(c.name.toLowerCase())
        );
        if (match) {
          updateField("categoryId", match.id);
          setAiSuggestion(`Selected: ${match.name}${data.suggestion.reason ? ` — ${data.suggestion.reason}` : ""}`);
        } else {
          setAiSuggestion(`AI suggests "${data.suggestion.suggestedCategory}" — not in your categories yet`);
        }
      } else {
        setAiSuggestion(data.fallbackMessage || data.error || "Unable to suggest a category");
      }
    } catch {
      setAiSuggestion("Failed to get AI suggestion");
    } finally {
      setAiSuggesting(false);
    }
  };

  return (
    <motion.div {...fadeIn} className="pharmacy-bg space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("products")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">
            {mode === "edit" ? "Edit Product" : "Add Product"}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {mode === "edit" ? "Update product information" : "Create a new product in your inventory"}
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5 shadow-pharmacy">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-emerald-500/50 bg-emerald-50 shadow-pharmacy">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700">
            <Check className="h-4 w-4 shrink-0" /> Product saved successfully!
          </CardContent>
        </Card>
      )}

      {/* Form sections wrapper for staggered animations */}
      <div className="space-y-4">

      {/* Basic Info Section */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-500/15" />
            Basic Information
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Product Name *</Label>
              <Input
                placeholder="e.g., Napa Extra"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Generic Name</Label>
              <Input
                placeholder="e.g., Paracetamol + Caffeine"
                value={form.genericName}
                onChange={(e) => updateField("genericName", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium">Category</Label>
                  <button
                    type="button"
                    onClick={handleAISuggestCategory}
                    disabled={aiSuggesting || !form.name.trim()}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-sm hover:shadow-md hover:from-purple-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {aiSuggesting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                    {aiSuggesting ? "Thinking..." : "AI Suggest"}
                  </button>
                </div>
                <Select value={form.categoryId} onValueChange={(v) => updateField("categoryId", v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {aiSuggestion && (
                  <p className="text-[10px] text-purple-600 italic flex items-start gap-1">
                    <Sparkles className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                    <span>{aiSuggestion}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Product Type</Label>
                <Select value={form.productType} onValueChange={(v) => updateField("productType", v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {productTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">SKU</Label>
                <Input
                  placeholder="Internal code"
                  value={form.sku}
                  onChange={(e) => updateField("sku", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Barcode</Label>
                <Input
                  placeholder="Scan barcode"
                  value={form.barcode}
                  onChange={(e) => updateField("barcode", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pharmacy Details */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-500 shrink-0 ring-4 ring-purple-500/15" />
            Pharmacy Details
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Strength</Label>
                <Input
                  placeholder="e.g., 500mg"
                  value={form.strength}
                  onChange={(e) => updateField("strength", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dosage Form</Label>
                <Select value={form.dosageForm} onValueChange={(v) => updateField("dosageForm", v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {dosageForms.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Manufacturer</Label>
              <Input
                placeholder="e.g., Square, Beximco, Renata"
                value={form.manufacturer}
                onChange={(e) => updateField("manufacturer", e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Schedule Type</Label>
                <Select value={form.scheduleType} onValueChange={(v) => updateField("scheduleType", v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleTypes.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Storage</Label>
                <Select value={form.storageCondition} onValueChange={(v) => updateField("storageCondition", v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {storageConditions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs font-medium">Prescription Required</Label>
              <Switch
                checked={form.isPrescription}
                onCheckedChange={(v) => updateField("isPrescription", v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit & Packaging */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 shrink-0 ring-4 ring-cyan-500/15" />
            Unit &amp; Packaging
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Base Unit</Label>
                <Select value={form.unit} onValueChange={(v) => updateField("unit", v)}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Strip Size</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10"
                  value={form.stripSize}
                  onChange={(e) => updateField("stripSize", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Box Size</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10"
                  value={form.boxSize}
                  onChange={(e) => updateField("boxSize", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Tax */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0 ring-4 ring-amber-500/15" />
            Pricing &amp; Tax
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">MRP (৳)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.mrp}
                  onChange={(e) => updateField("mrp", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">VAT Rate (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={form.vatRate}
                  onChange={(e) => updateField("vatRate", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">HSN Code</Label>
                <Input
                  placeholder="e.g., 30049099"
                  value={form.hsnCode}
                  onChange={(e) => updateField("hsnCode", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rack No</Label>
                <Input
                  placeholder="e.g., A3, Rack-5"
                  value={form.rackNo}
                  onChange={(e) => updateField("rackNo", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Thresholds */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-500/15" />
            Stock Alerts
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Min Stock</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.minStock}
                  onChange={(e) => updateField("minStock", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Max Stock</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.maxStock}
                  onChange={(e) => updateField("maxStock", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reorder At</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.reorderLevel}
                  onChange={(e) => updateField("reorderLevel", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      </div>

      {/* Submit Button */}
      <Button
        size="lg"
        className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30 border-0"
        onClick={handleSubmit}
        disabled={saving || !form.name.trim()}
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : mode === "edit" ? "Update Product" : "Add Product"}
      </Button>
    </motion.div>
  );
}
