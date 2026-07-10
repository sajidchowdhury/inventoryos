'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Package, Tag, DollarSign, BarChart3, Save,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const UNITS = ['piece', 'box', 'pair', 'set', 'roll', 'meter'];

interface CategoryItem {
  id: string;
  name: string;
}

interface ProductFormData {
  name: string;
  brand: string;
  model: string;
  sku: string;
  categoryId: string;
  description: string;
  hsnCode: string;
  costPrice: string;
  sellPrice: string;
  mrp: string;
  vatRate: string;
  stock: string;
  unit: string;
  minStockAlert: string;
  serialTracked: boolean;
  warrantyMonths: string;
}

const initialForm: ProductFormData = {
  name: '',
  brand: '',
  model: '',
  sku: '',
  categoryId: '',
  description: '',
  hsnCode: '',
  costPrice: '',
  sellPrice: '',
  mrp: '',
  vatRate: '',
  stock: '',
  unit: 'piece',
  minStockAlert: '',
  serialTracked: false,
  warrantyMonths: '',
};

export function CCTVProductForm() {
  const { contextId, goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);

  const isEdit = !!contextId;

  const [form, setForm] = useState<ProductFormData>(initialForm);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [existingBrands, setExistingBrands] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});
  const { toast } = useToast();

  // Fetch categories
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/categories`)
      .then((res) => res.json())
      .then((data) => {
        const cats: CategoryItem[] = Array.isArray(data) ? data : data.categories || [];
        setCategories(cats);
      })
      .catch(() => {
        toast({ title: 'Failed to load categories', variant: 'destructive' });
      });
  }, [businessId]);

  // If edit mode, fetch product data
  useEffect(() => {
    if (!isEdit || !businessId || !contextId) return;
    setLoadingData(true);
    fetch(`/api/businesses/${businessId}/cctv/products/${contextId}`)
      .then((res) => res.json())
      .then((data) => {
        const p = data.product || data;
        setForm({
          name: p.name || '',
          brand: p.brand || '',
          model: p.model || '',
          sku: p.sku || '',
          categoryId: p.categoryId || p.category?.id || '',
          description: p.description || '',
          hsnCode: p.hsnCode || '',
          costPrice: String(p.costPrice ?? ''),
          sellPrice: String(p.sellPrice ?? ''),
          mrp: String(p.mrp ?? ''),
          vatRate: String(p.vatRate ?? ''),
          stock: String(p.stock ?? ''),
          unit: p.unit || 'piece',
          minStockAlert: String(p.minStockAlert ?? ''),
          serialTracked: !!p.serialTracked,
          warrantyMonths: String(p.warrantyMonths ?? ''),
        });
      })
      .catch(() => {
        toast({ title: 'Failed to load product', variant: 'destructive' });
        goBack();
      })
      .finally(() => setLoadingData(false));
  }, [isEdit, businessId, contextId]);

  // Also load brands from products list for datalist
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/products?limit=100`)
      .then((res) => res.json())
      .then((data) => {
        const prods = data.products || [];
        const brands = Array.from(new Set(prods.map((p: { brand: string }) => p.brand).filter(Boolean)));
        setExistingBrands(brands.sort());
      })
      .catch(() => {
        // Non-critical — brand suggestions are optional
      });
  }, [businessId]);

  const updateField = (field: keyof ProductFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProductFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Product name is required';
    if (!form.brand.trim()) newErrors.brand = 'Brand is required';
    const cp = parseFloat(form.costPrice);
    if (form.costPrice && (isNaN(cp) || cp < 0)) newErrors.costPrice = 'Must be >= 0';
    const sp = parseFloat(form.sellPrice);
    if (form.sellPrice && (isNaN(sp) || sp < 0)) newErrors.sellPrice = 'Must be >= 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      const cat = data.category || data;
      setCategories((prev) => [...prev, cat]);
      setForm((prev) => ({ ...prev, categoryId: cat.id }));
      setNewCategoryName('');
      setShowNewCategory(false);
    } catch {
      toast({ title: 'Failed to create category', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!validate() || !businessId) return;
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      model: form.model.trim() || undefined,
      sku: form.sku.trim() || undefined,
      categoryId: form.categoryId || undefined,
      description: form.description.trim() || undefined,
      hsnCode: form.hsnCode.trim() || undefined,
      costPrice: parseFloat(form.costPrice) || 0,
      sellPrice: parseFloat(form.sellPrice) || 0,
      unit: form.unit,
      serialTracked: form.serialTracked,
      warrantyMonths: parseInt(form.warrantyMonths) || 0,
    };

    if (form.mrp) payload.mrp = parseFloat(form.mrp);
    if (form.vatRate) payload.vatRate = parseFloat(form.vatRate);
    if (!form.serialTracked) {
      payload.stock = parseInt(form.stock) || 0;
    }
    if (form.minStockAlert) payload.minStock = parseInt(form.minStockAlert);

    try {
      const url = isEdit
        ? `/api/businesses/${businessId}/cctv/products/${contextId}`
        : `/api/businesses/${businessId}/cctv/products`;

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: isEdit ? 'Product updated' : 'Product created',
          variant: 'default',
        });
        goBack();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: data.error || `Failed to ${isEdit ? 'update' : 'create'} product`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const sectionHeader = (icon: React.ReactNode, title: string) => (
    <div className="flex items-center gap-2 mb-4 mt-2">
      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
        {icon}
      </div>
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
    </div>
  );

  if (loadingData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100" />
          <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-9 bg-gray-50 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {isEdit ? 'Edit Product' : 'Add Product'}
        </h1>
      </div>

      {/* Basic Info Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        {sectionHeader(<Package className="w-4 h-4 text-violet-500" />, 'Basic Info')}

        <div className="space-y-4">
          {/* Product Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">
              Product Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Hikvision DS-2CD2143G2"
              className={cn(
                'h-10 rounded-xl',
                errors.name && 'border-red-300 focus-visible:ring-red-200'
              )}
            />
            {errors.name && (
              <p className="text-[11px] text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">
              Brand <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.brand}
              onChange={(e) => updateField('brand', e.target.value)}
              placeholder="e.g. Hikvision"
              list="brand-list"
              className={cn(
                'h-10 rounded-xl',
                errors.brand && 'border-red-300 focus-visible:ring-red-200'
              )}
            />
            <datalist id="brand-list">
              {existingBrands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            {errors.brand && (
              <p className="text-[11px] text-red-500">{errors.brand}</p>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Model</Label>
            <Input
              value={form.model}
              onChange={(e) => updateField('model', e.target.value)}
              placeholder="Full model description"
              className="h-10 rounded-xl"
            />
          </div>

          {/* SKU */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              placeholder="Stock keeping unit"
              className="h-10 rounded-xl"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Category</Label>
            {showNewCategory ? (
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="h-10 rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory();
                  }}
                />
                <button
                  onClick={handleCreateCategory}
                  className="px-3 h-10 rounded-xl bg-violet-500 text-white text-xs font-medium shrink-0 active:scale-[0.98] transition-transform"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName('');
                  }}
                  className="px-3 h-10 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium shrink-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <Select
                value={form.categoryId || '__create_new__'}
                onValueChange={(val) => {
                  if (val === '__create_new__') {
                    setShowNewCategory(true);
                  } else {
                    updateField('categoryId', val);
                  }
                }}
              >
                <SelectTrigger className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__create_new__" className="text-violet-600 font-medium">
                    + Create New Category
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Brief product description"
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          {/* HSN Code */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">HSN Code</Label>
            <Input
              value={form.hsnCode}
              onChange={(e) => updateField('hsnCode', e.target.value)}
              placeholder="HSN/SAC code"
              className="h-10 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        {sectionHeader(<DollarSign className="w-4 h-4 text-violet-500" />, 'Pricing')}

        <div className="space-y-4">
          {/* Cost Price */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">
              Cost Price <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
              <Input
                type="number"
                value={form.costPrice}
                onChange={(e) => updateField('costPrice', e.target.value)}
                placeholder="0"
                className={cn(
                  'h-10 rounded-xl pl-8',
                  errors.costPrice && 'border-red-300 focus-visible:ring-red-200'
                )}
                min="0"
                step="0.01"
              />
            </div>
            {errors.costPrice && (
              <p className="text-[11px] text-red-500">{errors.costPrice}</p>
            )}
          </div>

          {/* Sell Price */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">
              Sell Price <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
              <Input
                type="number"
                value={form.sellPrice}
                onChange={(e) => updateField('sellPrice', e.target.value)}
                placeholder="0"
                className={cn(
                  'h-10 rounded-xl pl-8',
                  errors.sellPrice && 'border-red-300 focus-visible:ring-red-200'
                )}
                min="0"
                step="0.01"
              />
            </div>
            {errors.sellPrice && (
              <p className="text-[11px] text-red-500">{errors.sellPrice}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* MRP */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">MRP</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
                <Input
                  type="number"
                  value={form.mrp}
                  onChange={(e) => updateField('mrp', e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-xl pl-8"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* VAT Rate */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">VAT Rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={form.vatRate}
                  onChange={(e) => updateField('vatRate', e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-xl pr-8"
                  min="0"
                  step="0.1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock & Tracking Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        {sectionHeader(<BarChart3 className="w-4 h-4 text-violet-500" />, 'Stock & Tracking')}

        <div className="space-y-4">
          {/* Serial Tracked */}
          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-xs text-gray-700 font-semibold">Serial Tracked</Label>
              <p className="text-[11px] text-gray-400 mt-0.5">Each unit has a unique serial number</p>
            </div>
            <Switch
              checked={form.serialTracked}
              onCheckedChange={(checked) => updateField('serialTracked', checked)}
            />
          </div>

          {/* Stock (hidden if serial tracked) */}
          {!form.serialTracked && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">
                Stock <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                value={form.stock}
                onChange={(e) => updateField('stock', e.target.value)}
                placeholder="0"
                className="h-10 rounded-xl"
                min="0"
              />
            </div>
          )}

          {/* Unit */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Unit</Label>
            <Select value={form.unit} onValueChange={(val) => updateField('unit', val)}>
              <SelectTrigger className="w-full h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="capitalize">
                    {u.charAt(0).toUpperCase() + u.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Min Stock Alert */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Min Stock Alert</Label>
              <Input
                type="number"
                value={form.minStockAlert}
                onChange={(e) => updateField('minStockAlert', e.target.value)}
                placeholder="0"
                className="h-10 rounded-xl"
                min="0"
              />
            </div>

            {/* Warranty Months */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Warranty Months</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={form.warrantyMonths}
                  onChange={(e) => updateField('warrantyMonths', e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-xl pr-10"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">mo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
      </button>
    </motion.div>
  );
}