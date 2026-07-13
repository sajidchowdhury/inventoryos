'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, X, Loader2, GripVertical, Trash2,
  Plus, Package, Check, Save,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
  MSProduct,
  MSKitDefinition,
  MSKitComponent,
} from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface FormComponent {
  _tempId: string;
  id?: string; // existing component ID (for edit mode)
  productId: string;
  productName: string;
  productBrand: string;
  productSellPrice: number;
  quantity: number;
  componentLabel: string;
  isRequired: boolean;
  sortOrder: number;
}

export function MSKitForm() {
  const { navigate, goBack, contextId } = useMSNavStore();
  const businessId = useMSBusinessId();
  const isEdit = !!contextId;

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [kitPrice, setKitPrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [components, setComponents] = useState<FormComponent[]>([]);
  const originalComponentIds = useRef<string[]>([]);  // Track original IDs for deletion detection

  // UI state
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MSProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Refs
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Generate slug from name
  useEffect(() => {
    // Only auto-update slug if it hasn't been manually edited
    if (!isEdit) {
      setSlug(slugify(name));
    }
  }, [name, isEdit]);

  // Fetch existing kit for edit mode
  const fetchKit = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/kits/${contextId}`
      );
      if (res.ok) {
        const data: MSKitDefinition = await res.json();
        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description ?? '');
        setImageUrl(data.imageUrl ?? '');
        setKitPrice(data.kitPrice != null ? String(data.kitPrice) : '');
        setDiscountPercent(String(data.discountPercent));
        setIsActive(data.isActive);

        // Map existing components
        if (data.components && data.components.length > 0) {
          const mapped: FormComponent[] = data.components.map((c, i) => ({
            _tempId: `existing-${c.id}`,
            id: c.id,
            productId: c.productId,
            productName: c.product?.name ?? 'Unknown',
            productBrand: c.product?.brand ?? '',
            productSellPrice: c.product?.sellPrice ?? 0,
            quantity: c.quantity,
            componentLabel: c.componentLabel ?? '',
            isRequired: c.isRequired,
            sortOrder: c.sortOrder ?? i,
          }));
          setComponents(mapped);
          originalComponentIds.current = kit.components?.map((c) => c.id) || [];
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [contextId]);

  useEffect(() => {
    if (isEdit) fetchKit();
  }, [isEdit, fetchKit]);

  // Search products with debounce and abort
  const searchProducts = useCallback((query: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (!query.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    const params = new URLSearchParams();
    params.set('search', query.trim());
    params.set('limit', '10');

    fetch(`/api/businesses/${businessId}/mobile-shop/products?${params.toString()}`, {
      signal: abortRef.current.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        const products: MSProduct[] = Array.isArray(data)
          ? data
          : data.products || [];
        setSearchResults(products);
        setSearchOpen(products.length > 0);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // silent
        }
      })
      .finally(() => setSearching(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, searchProducts]);

  // Add product as component
  const addComponent = (product: MSProduct) => {
    // Prevent duplicate
    if (components.some((c) => c.productId === product.id)) return;

    const newComp: FormComponent = {
      _tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      productName: product.name,
      productBrand: product.brand,
      productSellPrice: product.sellPrice,
      quantity: 1,
      componentLabel: '',
      isRequired: true,
      sortOrder: components.length,
    };
    setComponents((prev) => [...prev, newComp]);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  // Update component
  const updateComponent = (tempId: string, updates: Partial<FormComponent>) => {
    setComponents((prev) =>
      prev.map((c) => (c._tempId === tempId ? { ...c, ...updates } : c))
    );
  };

  // Remove component
  const removeComponent = (tempId: string) => {
    setComponents((prev) => prev.filter((c) => c._tempId !== tempId));
  };

  // Computed pricing
  const individualTotal = components.reduce(
    (sum, c) => sum + c.productSellPrice * c.quantity,
    0
  );
  const kitPriceNum = kitPrice !== '' ? parseFloat(kitPrice) || 0 : 0;
  const discountNum = discountPercent !== '' ? parseFloat(discountPercent) || 0 : 0;
  const effectiveKitPrice =
    kitPriceNum > 0
      ? kitPriceNum
      : individualTotal > 0
        ? individualTotal - (individualTotal * discountNum) / 100
        : 0;
  const savings = individualTotal - effectiveKitPrice;

  // Save handler
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    try {
      const kitBody: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        kitPrice: kitPriceNum > 0 ? kitPriceNum : null,
        discountPercent: discountNum,
        isActive,
        sortOrder: 0,
      };

      let kitId = contextId;

      if (isEdit && contextId) {
        // Update kit
        const res = await fetch(
          `/api/businesses/${businessId}/mobile-shop/kits/${contextId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(kitBody),
          }
        );
        if (!res.ok) throw new Error('Failed to update kit');
      } else {
        // Create kit
        const res = await fetch(`/api/businesses/${businessId}/mobile-shop/kits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kitBody),
        });
        if (!res.ok) throw new Error('Failed to create kit');
        const data = await res.json();
        kitId = data.id;
      }

      if (!kitId) throw new Error('No kit ID');

      // Sync components
      if (isEdit) {
        // Delete removed components
        const currentIds = components.filter((c) => c.id).map((c) => c.id!);
        const removedIds = originalComponentIds.current.filter(
          (id) => !currentIds.includes(id)
        );
        for (const removeId of removedIds) {
          await fetch(
            `/api/businesses/${businessId}/mobile-shop/kits/${kitId}/components/${removeId}`,
            { method: 'DELETE' }
          );
        }

        // Update existing and create new
        for (const comp of components) {
          const compBody = {
            productId: comp.productId,
            quantity: comp.quantity,
            componentLabel: comp.componentLabel.trim() || null,
            isRequired: comp.isRequired,
            sortOrder: comp.sortOrder,
          };

          if (comp.id) {
            // Update existing
            await fetch(
              `/api/businesses/${businessId}/mobile-shop/kits/${kitId}/components/${comp.id}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(compBody),
              }
            );
          } else {
            // Create new
            await fetch(
              `/api/businesses/${businessId}/mobile-shop/kits/${kitId}/components`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(compBody),
              }
            );
          }
        }
      } else {
        // Create mode: POST each component
        for (const comp of components) {
          await fetch(
            `/api/businesses/${businessId}/mobile-shop/kits/${kitId}/components`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: comp.productId,
                quantity: comp.quantity,
                componentLabel: comp.componentLabel.trim() || null,
                isRequired: comp.isRequired,
                sortOrder: comp.sortOrder,
              }),
            }
          );
        }
      }

      navigate('kit-detail', kitId);
    } catch {
      // silent — could show toast
    } finally {
      setSaving(false);
    }
  };

  // Close search when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchOpen && searchInputRef.current) {
        const target = e.target as Node;
        if (!searchInputRef.current.contains(target) && !(target as HTMLElement).closest('[data-search-dropdown]')) {
          setSearchOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  // Loading state for edit mode
  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {isEdit ? 'Edit Kit' : 'New Kit'}
        </h1>
      </div>

      {/* Basic Info Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Basic Info</h2>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 font-medium">
            Kit Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 4-Camera Home Security Kit"
            className="rounded-xl h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 font-medium">Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated-from-name"
            className="rounded-xl h-10 text-sm font-mono text-gray-600"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 font-medium">
            Description
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's included in this kit..."
            className="rounded-xl text-sm min-h-[72px] resize-none"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 font-medium">
            Image URL <span className="text-gray-300">(optional)</span>
          </Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-xl h-10 text-sm"
          />
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Pricing</h2>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 font-medium">
            Kit Price{' '}
            <span className="text-gray-300 font-normal">
              (leave blank for auto-calculate)
            </span>
          </Label>
          <Input
            type="number"
            value={kitPrice}
            onChange={(e) => setKitPrice(e.target.value)}
            placeholder="0"
            min="0"
            className="rounded-xl h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 font-medium">
            Discount Percent
          </Label>
          <Input
            type="number"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            placeholder="0"
            min="0"
            max="100"
            className="rounded-xl h-10 text-sm"
          />
        </div>

        {/* Live pricing preview */}
        {components.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Individual total</span>
              <span
                className={cn(
                  'font-semibold',
                  kitPriceNum > 0 || discountNum > 0
                    ? 'text-gray-400 line-through'
                    : 'text-gray-900'
                )}
              >
                {formatBDT(individualTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Kit price</span>
              <span className="font-bold text-gray-900">
                {formatBDT(effectiveKitPrice)}
              </span>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-600 font-medium">Savings</span>
                <span className="font-bold text-emerald-600">
                  {formatBDT(savings)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Components Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Components{' '}
            <span className="text-gray-400 font-normal">
              ({components.length})
            </span>
          </h2>
        </div>

        {/* Product search */}
        <div className="relative" ref={searchInputRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name, brand, SKU..."
            className="rounded-xl h-10 pl-9 pr-9 text-sm"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
          )}
          {!searching && searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setSearchOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Search results dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div
              data-search-dropdown
              className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-gray-200 shadow-lg z-50 max-h-60 overflow-y-auto scrollbar-thin"
            >
              {searchResults.map((product) => {
                const alreadyAdded = components.some(
                  (c) => c.productId === product.id
                );
                return (
                  <button
                    key={product.id}
                    onClick={() => !alreadyAdded && addComponent(product)}
                    disabled={alreadyAdded}
                    className={cn(
                      'w-full text-left px-3.5 py-2.5 border-b border-gray-50 last:border-0 transition-colors',
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-violet-50 active:bg-violet-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {product.brand}
                          {product.sku ? ` · ${product.sku}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-gray-900">
                          {formatBDT(product.sellPrice)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {product.stock} in stock
                        </p>
                      </div>
                    </div>
                    {alreadyAdded && (
                      <p className="text-[10px] text-violet-500 font-medium mt-0.5">
                        Already added
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Component rows */}
        {components.length === 0 ? (
          <div className="text-center py-6">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No components added yet</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-0.5 scrollbar-thin">
            {components.map((comp, idx) => (
              <motion.div
                key={comp._tempId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className="bg-gray-50 rounded-xl p-3 space-y-2"
              >
                {/* Drag handle + name + remove */}
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {comp.productName}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {comp.productBrand} · {formatBDT(comp.productSellPrice)} ea
                    </p>
                  </div>
                  <button
                    onClick={() => removeComponent(comp._tempId)}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 active:scale-95 transition-all"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div>
                    <Label className="text-[10px] text-gray-400 font-medium mb-0.5 block">
                      Quantity
                    </Label>
                    <Input
                      type="number"
                      value={comp.quantity}
                      onChange={(e) =>
                        updateComponent(comp._tempId, {
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      min={1}
                      className="rounded-lg h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400 font-medium mb-0.5 block">
                      Sort Order
                    </Label>
                    <Input
                      type="number"
                      value={comp.sortOrder}
                      onChange={(e) =>
                        updateComponent(comp._tempId, {
                          sortOrder: parseInt(e.target.value) || 0,
                        })
                      }
                      min={0}
                      className="rounded-lg h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="pl-6">
                  <Label className="text-[10px] text-gray-400 font-medium mb-0.5 block">
                    Label <span className="text-gray-300">(e.g., Main Camera)</span>
                  </Label>
                  <Input
                    value={comp.componentLabel}
                    onChange={(e) =>
                      updateComponent(comp._tempId, {
                        componentLabel: e.target.value,
                      })
                    }
                    placeholder="Optional label"
                    className="rounded-lg h-8 text-xs"
                  />
                </div>

                {/* Required toggle */}
                <div className="flex items-center justify-between pl-6">
                  <Label className="text-[11px] text-gray-500 font-medium">
                    Required component
                  </Label>
                  <Switch
                    checked={comp.isRequired}
                    onCheckedChange={(checked) =>
                      updateComponent(comp._tempId, { isRequired: checked })
                    }
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Add component CTA */}
        <button
          onClick={() => searchInputRef.current?.focus()}
          className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Product
        </button>
      </div>

      {/* Active toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Active</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Inactive kits won't appear in the catalog
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Save button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? 'Saving...' : isEdit ? 'Update Kit' : 'Create Kit'}
      </motion.button>

      {/* Bottom spacing for safe area */}
      <div className="h-4" />
    </motion.div>
  );
}