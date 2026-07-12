'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search, ArrowLeft, Plus, Camera, HardDrive, Cable, Upload,
  Wrench, Package, X, Loader2, ChevronDown, ChevronRight, Tag, Sparkles,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { CCTVProduct } from '@/modules/cctv-shop/types';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const PAGE_LIMIT = 20;

interface CategoryItem {
  id: string;
  name: string;
}

const categoryColor: Record<string, string> = {
  Cameras: 'bg-violet-100 text-violet-700',
  'DVR/NVR': 'bg-amber-100 text-amber-700',
  Accessories: 'bg-emerald-100 text-emerald-700',
  Cables: 'bg-sky-100 text-sky-700',
};

function getCategoryColor(name: string): string {
  return categoryColor[name] || 'bg-purple-100 text-purple-700';
}

const categoryIcon = (cat: string) => {
  switch (cat) {
    case 'Cameras': return Camera;
    case 'DVR/NVR': return HardDrive;
    case 'Accessories': return Wrench;
    case 'Cables': return Cable;
    default: return Package;
  }
};

export function CCTVProductsList() {
  const { navigate, goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);

  const [products, setProducts] = useState<CCTVProduct[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeBrand, setActiveBrand] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Split-view state (Phase 4C) ──
  // On desktop (lg:), clicking a product sets selectedProductId and shows
  // an inline detail panel on the right. On mobile, clicking navigates
  // to the full detail page (existing behavior).
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CCTVProduct | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch detail when selectedProductId changes
  useEffect(() => {
    if (!selectedProductId || !businessId) {
      setSelectedProduct(null);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/businesses/${businessId}/cctv/products/${selectedProductId}`)
      .then((res) => res.json())
      .then((data) => {
        setSelectedProduct(data.product || null);
      })
      .catch(() => setSelectedProduct(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedProductId, businessId]);

  // Handle product click — split view on desktop, navigate on mobile
  const handleProductClick = (productId: string) => {
    // On desktop, use split view; on mobile, navigate to full detail
    // We use a CSS-based approach: both behaviors are wired, but the
    // split-view panel is only visible on lg: (hidden on mobile).
    // The navigate() call is for mobile; setSelectedProductId is for desktop.
    setSelectedProductId(productId);
    // Don't navigate on desktop — the split panel handles it.
    // But we still need mobile to work. We'll handle this with two
    // separate click handlers in the render (one for mobile cards, one
    // for desktop table rows).
  };

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  // Fetch categories
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/categories`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
        else if (data.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, [businessId]);

  // Fetch products when search/filter changes
  const fetchProducts = useCallback(
    async (pageNum: number, append = false) => {
      if (!businessId) return;
      const isLoadMore = append;
      if (!isLoadMore) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (activeCategory !== 'All') params.set('category', activeCategory);
        params.set('page', String(pageNum));
        params.set('limit', String(PAGE_LIMIT));

        const res = await fetch(
          `/api/businesses/${businessId}/cctv/products?${params.toString()}`
        );
        const data = await res.json();

        const fetched: CCTVProduct[] = data.products || [];
        const totalItems = data.total || 0;
        const tp = data.totalPages || 1;

        if (append) {
          setProducts((prev) => [...prev, ...fetched]);
        } else {
          setProducts(fetched);
        }
        setTotal(totalItems);
        setTotalPages(tp);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [businessId, debouncedSearch, activeCategory]
  );

  // Reset page and fetch when search/filter changes
  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [fetchProducts]);

  // Compute unique brands from loaded products
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort();

  // Stats
  const lowStockCount = products.filter((p) => p.stock <= (p as Record<string, unknown>).minStock).length;

  const handleLoadMore = () => {
    const nextPage = page + 1;
    if (nextPage > totalPages) return;
    setPage(nextPage);
    fetchProducts(nextPage, true);
  };

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Products</h1>
      </div>

      {/* ── Split-view container (Phase 4C) ── */}
      {/* On lg: screens, list is on the left and detail panel on the right */}
      <div className="lg:flex lg:gap-4 lg:items-start">
        {/* Left panel: list (takes full width on mobile, flex-1 on desktop) */}
        <div className="lg:flex-1 space-y-4 min-w-0">

      {/* Stats bar + Import button */}
      {!loading && (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 text-xs text-gray-500 px-1">
            <span className="font-semibold text-gray-700">{total} Products</span>
            <span>·</span>
            <span>{products.reduce((a, p) => a + p.stock, 0).toLocaleString()} Stock Items</span>
            <span>·</span>
            <span className="text-amber-600 font-medium">{lowStockCount} Low Stock</span>
          </div>
          <button
            onClick={() => navigate('import-products')}
            className="px-3 py-1.5 rounded-xl bg-white border border-gray-100 text-[11px] font-semibold text-gray-600 flex items-center gap-1.5 active:bg-gray-50 transition-colors shadow-sm"
          >
            <Upload className="w-3 h-3" />
            Import
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <input
          type="text"
          placeholder="Search by name, brand, model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory('All')}
          className={cn(
            'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
            activeCategory === 'All'
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.name)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeCategory === cat.name
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Brand filter chips */}
      {brands.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveBrand('All')}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeBrand === 'All'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            )}
          >
            All Brands
          </button>
          {brands.map((brand) => (
            <button
              key={brand}
              onClick={() => setActiveBrand(brand)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
                activeBrand === brand
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
              )}
            >
              {brand}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/4 mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No products yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Add your first CCTV product to get started</p>
          <button
            onClick={() => navigate('add-product')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      )}

      {/* Product list */}
      {!loading && products.length > 0 && (
        <>
          <p className="text-xs text-gray-400 px-1">
            {total} product{total !== 1 ? 's' : ''} found
          </p>

          {/* ── Mobile card view (hidden on desktop) ── */}
          <div className="md:hidden space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-0.5 scrollbar-thin">
            {(activeBrand === 'All' ? products : products.filter((p) => p.brand === activeBrand)).map(
              (product, i) => {
                const prodData = product as Record<string, unknown>;
                const Icon = categoryIcon(product.category);
                const colorClass = getCategoryColor(product.category);
                const isLow = product.stock <= (prodData.minStock as number || 0);
                const isSerialTracked = product.serialTracked;
                const warrantyMonths = prodData.warrantyMonths as number || 0;
                const hasModel = !!(product.model);

                return (
                  <motion.button
                    key={product.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
                    onClick={() => navigate('product-detail', product.id)}
                    className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate flex-1">{product.name}</p>
                          {product.masterProductId && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium shrink-0 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Catalog
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {product.brand}
                          {hasModel ? ` · ${product.model}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium',
                          colorClass
                        )}
                      >
                        {product.category}
                      </span>
                      {isSerialTracked && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                          Serial
                        </span>
                      )}
                      {warrantyMonths > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-600">
                          {warrantyMonths}m warranty
                        </span>
                      )}
                      {isLow && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">
                          Low Stock
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-sm font-bold text-gray-900">
                        ৳{product.sellPrice.toLocaleString()}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          isLow ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {product.stock} in stock
                      </span>
                    </div>
                  </motion.button>
                );
              }
            )}
          </div>

          {/* ── Desktop table view (hidden on mobile) ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-semibold text-gray-700">Name</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Brand</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Model</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Category</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Sell Price</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Stock</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeBrand === 'All' ? products : products.filter((p) => p.brand === activeBrand)).map((product) => {
                    const prodData = product as Record<string, unknown>;
                    const isLow = product.stock <= (prodData.minStock as number || 0);
                    return (
                      <tr
                        key={product.id}
                        onClick={() => handleProductClick(product.id)}
                        className={cn(
                          'border-b border-gray-50 hover:bg-violet-50/50 cursor-pointer transition-colors',
                          selectedProductId === product.id && 'bg-violet-50/70'
                        )}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate max-w-[200px]">{product.name}</span>
                            {product.masterProductId && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium shrink-0 flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{product.brand}</td>
                        <td className="p-3 text-gray-500 font-mono text-xs">{product.model || '—'}</td>
                        <td className="p-3 text-gray-600">{product.category || '—'}</td>
                        <td className="p-3 text-right font-semibold text-gray-900">৳{product.sellPrice.toLocaleString()}</td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            isLow ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                          )}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {product.serialTracked && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Serial</span>
                          )}
                          {isLow && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 ml-1">Low</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Load More */}
          {page < totalPages && (
            <div className="pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

        </div>{/* End left panel */}

        {/* ── Right panel: detail (hidden on mobile, visible on lg:) ── */}
        <div className="hidden lg:block lg:w-[400px] xl:w-[440px] shrink-0 lg:sticky lg:top-4">
          {selectedProductId ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                </div>
              ) : selectedProduct ? (
                <div className="p-5 space-y-4">
                  {/* Detail header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900">{selectedProduct.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedProduct.brand}
                        {selectedProduct.model ? ` · ${selectedProduct.model}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedProductId(null)}
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center shrink-0"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedProduct.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">
                        {selectedProduct.category.name || selectedProduct.category}
                      </span>
                    )}
                    {selectedProduct.serialTracked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                        Serial Tracked
                      </span>
                    )}
                    {selectedProduct.warrantyMonths > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-600">
                        {selectedProduct.warrantyMonths}mo warranty
                      </span>
                    )}
                    {selectedProduct.masterProductId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> Catalog
                      </span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 font-medium">Cost Price</p>
                      <p className="text-lg font-bold text-gray-900 mt-0.5">
                        ৳{selectedProduct.costPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-3">
                      <p className="text-[10px] text-violet-500 font-medium">Sell Price</p>
                      <p className="text-lg font-bold text-violet-900 mt-0.5">
                        ৳{selectedProduct.sellPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                    <span className="text-xs text-gray-500 font-medium">Stock</span>
                    <span className="text-sm font-bold text-gray-900">{selectedProduct.stock}</span>
                  </div>

                  {/* Description */}
                  {selectedProduct.description && (
                    <div>
                      <p className="text-[10px] text-gray-500 font-medium mb-1">Description</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{selectedProduct.description}</p>
                    </div>
                  )}

                  {/* HSN + SKU */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {selectedProduct.hsnCode && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">HSN Code</p>
                        <p className="text-gray-700 font-mono mt-0.5">{selectedProduct.hsnCode}</p>
                      </div>
                    )}
                    {selectedProduct.sku && (
                      <div>
                        <p className="text-[10px] text-gray-500 font-medium">SKU</p>
                        <p className="text-gray-700 font-mono mt-0.5">{selectedProduct.sku}</p>
                      </div>
                    )}
                  </div>

                  {/* Open full detail button */}
                  <button
                    onClick={() => navigate('product-detail', selectedProduct.id)}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-md transition-shadow"
                  >
                    Open Full Detail
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Package className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">Product not found</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Package className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm font-medium">Select a product</p>
                <p className="text-xs mt-0.5">Click a product to view details here</p>
              </div>
            </div>
          )}
        </div>
      </div>{/* End split-view container */}

      {/* Floating add button (mobile only) */}
      {!loading && products.length > 0 && (
        <button
          onClick={() => navigate('add-product')}
          className="fixed bottom-24 right-4 lg:hidden w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center active:scale-95 transition-transform z-50"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </motion.div>
  );
}