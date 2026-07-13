'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Package, Tag, DollarSign, BarChart3, Save,
  Search, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
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

interface CatalogMatch {
  id: string;
  name: string;
  brand: string;
  model: string;
  sku: string | null;
  description: string | null;
  hsnCode: string | null;
  defaultCategoryName: string | null;
  defaultWarrantyMonths: number;
  defaultSerialTracked: boolean;
  defaultUnit: string;
  defaultImageUrl: string | null;
  defaultVatRate: number;
  defaultMrp: number | null;
  subscribed: boolean;
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

export function MSProductForm() {
  const { contextId, goBack } = useMSNavStore();
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

  // ── Catalog search state (Phase 3D) ──
  const [catalogQuery, setCatalogQuery] = useState('');          // the search text
  const [catalogResults, setCatalogResults] = useState<CatalogMatch[]>([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [selectedMasterProductId, setSelectedMasterProductId] = useState<string | null>(null);
  const [addToMasterCatalog, setAddToMasterCatalog] = useState(true);
  const catalogSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch categories
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/mobile-shop/categories`)
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
    fetch(`/api/businesses/${businessId}/mobile-shop/products/${contextId}`)
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
        // If editing, set the masterProductId so the "linked to catalog" badge shows
        if (p.masterProductId) {
          setSelectedMasterProductId(p.masterProductId);
        }
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
    fetch(`/api/businesses/${businessId}/mobile-shop/products?limit=100`)
      .then((res) => res.json())
      .then((data) => {
        const prods = data.products || [];
        const brands = Array.from(new Set(prods.map((p: { brand: string }) => p.brand).filter(Boolean)));
        setExistingBrands(brands.sort());
      })
      .catch(() => {
        // Non-critical
      });
  }, [businessId]);

  // ── Catalog search with debounce (Phase 3D) ──
  const performCatalogSearch = useCallback(async (q: string) => {
    if (!businessId || q.trim().length < 2) {
      setCatalogResults([]);
      setShowCatalogDropdown(false);
      return;
    }
    setCatalogSearching(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/catalog/mobile-shop/search?q=${encodeURIComponent(q.trim())}&limit=8`
      );
      if (!res.ok) return;
      const data = await res.json();
      setCatalogResults(data.products || []);
      setShowCatalogDropdown(true);
    } catch {
      // non-critical
    } finally {
      setCatalogSearching(false);
    }
  }, [businessId]);

  const handleCatalogSearchChange = (value: string) => {
    setCatalogQuery(value);
    if (catalogSearchTimeout.current) clearTimeout(catalogSearchTimeout.current);
    catalogSearchTimeout.current = setTimeout(() => {
      performCatalogSearch(value);
    }, 300);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (catalogDropdownRef.current && !catalogDropdownRef.current.contains(e.target as Node)) {
        setShowCatalogDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Prefill form on catalog match selection (Phase 3D) ──
  const selectCatalogMatch = (m: CatalogMatch) => {
    setForm((prev) => ({
      ...prev,
      name: m.name,
      brand: m.brand,
      model: m.model,
      sku: m.sku || prev.sku,
      description: m.description || prev.description,
      hsnCode: m.hsnCode || prev.hsnCode,
      unit: m.defaultUnit || prev.unit,
      serialTracked: m.defaultSerialTracked,
      warrantyMonths: String(m.defaultWarrantyMonths || ''),
      vatRate: String(m.defaultVatRate || ''),
      mrp: m.defaultMrp ? String(m.defaultMrp) : prev.mrp,
    }));
    setSelectedMasterProductId(m.id);
    setCatalogQuery('');
    setCatalogResults([]);
    setShowCatalogDropdown(false);

    // Try to match a category by name
    if (m.defaultCategoryName) {
      const existingCat = categories.find(
        (c) => c.name.toLowerCase() === m.defaultCategoryName!.toLowerCase()
      );
      if (existingCat) {
        setForm((prev) => ({ ...prev, categoryId: existingCat.id }));
      }
    }

    toast({
      title: 'Catalog match applied',
      description: `Prefilled from "${m.name}". Adjust pricing and stock as needed.`,
    });
  };

  // Clear the catalog link when user edits brand or model manually
  const handleBrandChange = (value: string) => {
    setForm((prev) => ({ ...prev, brand: value }));
    if (selectedMasterProductId) {
      setSelectedMasterProductId(null);
    }
    // Default addToMasterCatalog based on brand
    if (value && value.toLowerCase() !== 'generic') {
      setAddToMasterCatalog(true);
    } else {
      setAddToMasterCatalog(false);
    }
  };

  const handleNameChange = (value: string) => {
    setForm((prev) => ({ ...prev, name: value }));
    if (selectedMasterProductId) {
      setSelectedMasterProductId(null);
    }
  };

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
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/categories`, {
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

    let masterProductId = selectedMasterProductId;

    // ── If "Add to master catalog" is checked and no master selected, suggest first (Phase 3D) ──
    if (!isEdit && !masterProductId && addToMasterCatalog) {
      try {
        const suggestRes = await fetch(
          `/api/businesses/${businessId}/catalog/mobile-shop/suggest`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name.trim(),
              brand: form.brand.trim(),
              model: form.model.trim() || form.name.trim(),
              sku: form.sku.trim() || null,
              description: form.description.trim() || null,
              hsnCode: form.hsnCode.trim() || null,
              defaultCategoryName: categories.find((c) => c.id === form.categoryId)?.name || null,
              defaultWarrantyMonths: parseInt(form.warrantyMonths) || 0,
              defaultSerialTracked: form.serialTracked,
              defaultUnit: form.unit,
              defaultVatRate: parseFloat(form.vatRate) || 0,
              defaultMrp: form.mrp ? parseFloat(form.mrp) : null,
            }),
          }
        );
        if (suggestRes.ok) {
          const suggestData = await suggestRes.json();
          masterProductId = suggestData.masterProductId;
          if (!suggestData.isApproved) {
            toast({
              title: 'Submitted to catalog',
              description: 'Product added to master catalog (pending admin review).',
            });
          }
        }
      } catch {
        // Non-fatal — proceed without master link
        console.error('[MSProductForm] suggest failed, proceeding without master link');
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      model: form.model.trim() || undefined,
      sku: form.sku.trim() || undefined,
      categoryId: form.categoryId || undefined,
      masterProductId: masterProductId || undefined,
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
        ? `/api/businesses/${businessId}/mobile-shop/products/${contextId}`
        : `/api/businesses/${businessId}/mobile-shop/products`;

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
      <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
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

      {/* ── Catalog Search Section (Phase 3D) ── */}
      {!isEdit && (
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-50 rounded-2xl border border-cyan-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">Search Master Catalog</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Search the shared catalog to prefill product details. Skip if you want to create a private product.
          </p>
          <div className="relative" ref={catalogDropdownRef}>
            <Input
              value={catalogQuery}
              onChange={(e) => handleCatalogSearchChange(e.target.value)}
              placeholder="Type product name, brand, or model (e.g. Hikvision DS-2CD)..."
              className="h-10 rounded-xl bg-white"
            />
            {catalogSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-cyan-400" />
            )}

            {/* Catalog dropdown */}
            {showCatalogDropdown && catalogResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
                {catalogResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => selectCatalogMatch(m)}
                    className="w-full text-left p-3 hover:bg-cyan-50 border-b border-gray-50 last:border-0 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {m.brand} · {m.model}
                          {m.defaultMrp ? ` · ৳${m.defaultMrp.toLocaleString()}` : ''}
                        </p>
                      </div>
                      {m.subscribed ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
                          Already added
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium shrink-0">
                          Use
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showCatalogDropdown && catalogResults.length === 0 && !catalogSearching && catalogQuery.trim().length >= 2 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-center text-xs text-gray-500">
                No catalog matches. Fill the form below — you can add it to the catalog on submit.
              </div>
            )}
          </div>

          {/* Selected catalog product badge */}
          {selectedMasterProductId && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-700 font-medium flex-1">
                Linked to master catalog — fields prefilled
              </span>
              <button
                onClick={() => {
                  setSelectedMasterProductId(null);
                  setForm(initialForm);
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Basic Info Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        {sectionHeader(<Package className="w-4 h-4 text-cyan-500" />, 'Basic Info')}

        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {/* Product Name */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-gray-600">
              Product Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
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
              onChange={(e) => handleBrandChange(e.target.value)}
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
                  className="px-3 h-10 rounded-xl bg-cyan-500 text-white text-xs font-medium shrink-0 active:scale-[0.98] transition-transform"
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
                  <SelectItem value="__create_new__" className="text-cyan-600 font-medium">
                    + Create New Category
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5 md:col-span-2">
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
        {sectionHeader(<DollarSign className="w-4 h-4 text-cyan-500" />, 'Pricing')}

        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
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
        {sectionHeader(<BarChart3 className="w-4 h-4 text-cyan-500" />, 'Stock & Tracking')}

        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
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

      {/* ── Add to Master Catalog checkbox (Phase 3D) ── */}
      {!isEdit && !selectedMasterProductId && (
        <div className="bg-cyan-50 rounded-2xl border border-cyan-100 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={addToMasterCatalog}
              onChange={(e) => setAddToMasterCatalog(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-sm font-semibold text-gray-800">Add to master catalog</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Submit this product to the shared catalog so other shops can discover it.
                {form.brand && form.brand.toLowerCase() === 'generic'
                  ? ' (Generic items usually skip this — leave unchecked.)'
                  : ' An admin will review before it appears publicly.'}
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
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
