"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Pill, Tag, Box, Thermometer,
  MapPin, Hash, DollarSign, AlertCircle, Check,
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

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("products")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">
          {mode === "edit" ? "Edit Product" : "Add New Product"}
        </h1>
      </div>

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
            <Check className="h-4 w-4 shrink-0" /> Product saved successfully!
          </CardContent>
        </Card>
      )}

      {/* Basic Info Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Pill className="h-4 w-4" /> Basic Information
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Product Name *</Label>
              <Input
                placeholder="e.g., Napa Extra"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Generic Name</Label>
              <Input
                placeholder="e.g., Paracetamol + Caffeine"
                value={form.genericName}
                onChange={(e) => updateField("genericName", e.target.value)}
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => updateField("categoryId", v)}>
                  <SelectTrigger className="h-10">
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
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Product Type</Label>
                <Select value={form.productType} onValueChange={(v) => updateField("productType", v)}>
                  <SelectTrigger className="h-10">
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
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Barcode</Label>
                <Input
                  placeholder="Scan barcode"
                  value={form.barcode}
                  onChange={(e) => updateField("barcode", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pharmacy Details */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Tag className="h-4 w-4" /> Pharmacy Details
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Strength</Label>
                <Input
                  placeholder="e.g., 500mg"
                  value={form.strength}
                  onChange={(e) => updateField("strength", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Dosage Form</Label>
                <Select value={form.dosageForm} onValueChange={(v) => updateField("dosageForm", v)}>
                  <SelectTrigger className="h-10">
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
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Schedule Type</Label>
                <Select value={form.scheduleType} onValueChange={(v) => updateField("scheduleType", v)}>
                  <SelectTrigger className="h-10">
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
                  <SelectTrigger className="h-10">
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
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Box className="h-4 w-4" /> Unit & Packaging
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Base Unit</Label>
                <Select value={form.unit} onValueChange={(v) => updateField("unit", v)}>
                  <SelectTrigger className="h-10">
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
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Box Size</Label>
                <Input
                  type="number"
                  placeholder="e.g., 10"
                  value={form.boxSize}
                  onChange={(e) => updateField("boxSize", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Tax */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <DollarSign className="h-4 w-4" /> Pricing & Tax
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
                  className="h-10"
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
                  className="h-10"
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
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rack No</Label>
                <Input
                  placeholder="e.g., A3, Rack-5"
                  value={form.rackNo}
                  onChange={(e) => updateField("rackNo", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Thresholds */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <AlertCircle className="h-4 w-4" /> Stock Alerts
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
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Max Stock</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.maxStock}
                  onChange={(e) => updateField("maxStock", e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reorder At</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.reorderLevel}
                  onChange={(e) => updateField("reorderLevel", e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        size="lg"
        className="w-full h-12 gap-2"
        onClick={handleSubmit}
        disabled={saving || !form.name.trim()}
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : mode === "edit" ? "Update Product" : "Add Product"}
      </Button>
    </motion.div>
  );
}
