'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Hash,
  AlertTriangle,
  ChevronRight,
  Download,
  Package,
  Camera,
  HardDrive,
  Cable,
  Plug,
  PackageSearch,
  X,
  Loader2,
  Layers,
  DollarSign,
  BoxSelect,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const fadeItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// Fallback icon map for category icons stored as string names
const ICON_MAP: Record<string, typeof Camera> = {
  Camera, HardDrive, Cable, Plug, Package, Layers, BoxSelect,
  PackageSearch, DollarSign, Hash,
};

// Default color palette for categories when no color is set
const CATEGORY_COLORS = [
  { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100' },
  { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
  { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100' },
];

// ── Types ──

interface CategoryStat {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  productCount: number;
  serialCount: number;
  stockValue: number;
}

interface LowStockItem {
  id: string;
  name: string;
  brand: string | null;
  effectiveStock: number;
  minStock: number;
  serialTracked: boolean;
  sellPrice: number;
  costPrice: number;
  stock: number;
}

interface SearchResult {
  id: string;
  name: string;
  brand: string | null;
  serialNumber?: string;
  stock: number;
  sellPrice: number;
  serialTracked: boolean;
}

interface InventoryStats {
  success: boolean;
  totalSerialItems: number;
  totalProducts: number;
  totalStockValue: number;
  categoryBreakdown: CategoryStat[];
  lowStock: LowStockItem[];
  searchResults: SearchResult[] | null;
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCompact(n: number): string {
  if (n >= 100000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getCategoryColorClasses(index: number) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function getCategoryIcon(iconName: string) {
  return ICON_MAP[iconName] || Package;
}

// ── Menu Items (static navigation) ──

const MENU_ITEMS = [
  { label: 'Products', desc: 'Manage product catalog', view: 'products' as const, icon: '📦', color: 'bg-blue-50 border-blue-200' },
  { label: 'Serial Items', desc: 'Track individual items', view: 'serial-items' as const, icon: '🔢', color: 'bg-violet-50 border-violet-200' },
  { label: 'Categories', desc: 'Organize by type & brand', view: 'categories' as const, icon: '🏷️', color: 'bg-purple-50 border-purple-200' },
  { label: 'Purchase Orders', desc: 'Supplier orders', view: 'purchase-orders' as const, icon: '🛒', color: 'bg-amber-50 border-amber-200' },
  { label: 'Suppliers', desc: 'Manage suppliers', view: 'suppliers' as const, icon: '🏭', color: 'bg-emerald-50 border-emerald-200' },
  { label: 'Branches', desc: 'Multi-branch locations', view: 'branches' as const, icon: '🏪', color: 'bg-orange-50 border-orange-200' },
  { label: 'Transfers', desc: 'Move stock between branches', view: 'transfers' as const, icon: '🚚', color: 'bg-cyan-50 border-cyan-200' },
  { label: 'Kits & Bundles', desc: 'Pre-configured packages', view: 'kits' as const, icon: '📦', color: 'bg-violet-50 border-violet-200' },
];

// ── Component ──

export function CCTVInventoryHub() {
  const { navigate } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [data, setData] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch stats ──
  const fetchStats = useCallback(async (q: string = '') => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(
        `/api/businesses/${businessId}/cctv/inventory-stats?${params.toString()}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // error
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/businesses/${businessId}/cctv/inventory-stats`
        );
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // error
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [businessId]);

  // ── Debounced search ──
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      // Clear search results but keep other stats
      if (data) setData({ ...data, searchResults: null });
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchStats(value);
    }, 350);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearch(false);
    if (data) setData({ ...data, searchResults: null });
  };

  // ── Derived ──
  const categories = data?.categoryBreakdown || [];
  const lowStock = data?.lowStock || [];
  const searchResults = data?.searchResults;

  return (
    <div className="px-4 py-6 pb-24">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-gray-900 mb-4"
      >
        Inventory Hub
      </motion.h2>

      {/* ── Serial Items Highlight Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={() => navigate('serial-items')}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 p-4 mb-5 cursor-pointer active:scale-[0.98] transition-transform shadow-lg shadow-violet-500/20"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-8 w-16 h-16 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">Serial Items Tracked</p>
            <p className="text-3xl font-bold text-white mt-1">
              {loading ? '...' : formatCompact(data?.totalSerialItems || 0)}
            </p>
            <p className="text-white/60 text-[11px] mt-0.5">
              {loading ? 'loading' : `${data?.totalProducts || 0} products in catalog`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Hash className="w-6 h-6 text-white" />
          </div>
        </div>
      </motion.div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => navigate('stock-in')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-left active:scale-[0.98] transition-transform shadow-lg shadow-emerald-500/20"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <Download className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">Stock In</span>
          </div>
          <p className="text-white/70 text-[11px]">Scan serials & IMEI</p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate('add-product')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-left active:scale-[0.98] transition-transform shadow-lg shadow-violet-500/20"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">Add Product</span>
          </div>
          <p className="text-white/70 text-[11px]">New item to catalog</p>
        </motion.button>
      </div>

      {/* ── Stock Value Card ── */}
      {!loading && data && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm mb-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium">Total Stock Value</p>
                <p className="text-sm font-bold text-gray-900">{formatBDT(data.totalStockValue)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-medium">Products</p>
              <p className="text-sm font-bold text-gray-900">{data.totalProducts}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Search ── */}
      <div className="relative mb-5">
        {showSearch ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search products, serial numbers..."
                className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </div>
            <button
              onClick={clearSearch}
              className="text-xs text-gray-500 font-medium shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <div className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-400 text-left border-0">
              Search products, serial numbers...
            </div>
          </button>
        )}
      </div>

      {/* ── Search Results ── */}
      <AnimatePresence>
        {searchResults && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <p className="text-xs font-semibold text-gray-500 mb-2">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {searchResults.map((item, i) => (
                <motion.button
                  key={`${item.id}-${item.serialNumber || i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate('product-detail', item.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.brand && (
                        <span className="text-[10px] text-gray-400">{item.brand}</span>
                      )}
                      {item.serialNumber && (
                        <span className="text-[10px] font-mono text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">
                          {item.serialNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-900">{formatBDT(item.sellPrice)}</p>
                    <p className="text-[10px] text-gray-400">
                      {item.serialTracked ? 'Serial' : `Stock: ${item.stock}`}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {searchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-5 text-center py-6"
          >
            <PackageSearch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No results for &quot;{searchQuery}&quot;</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Breakdown ── */}
      {(!showSearch || !searchQuery) && (
        <>
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            className="mb-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Categories</h3>
              <button
                onClick={() => navigate('categories')}
                className="text-xs text-violet-600 font-medium"
              >
                View All
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
                <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No categories yet</p>
                <button
                  onClick={() => navigate('categories')}
                  className="text-xs text-violet-600 font-semibold mt-2"
                >
                  Create Category
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {categories.map((cat, i) => {
                  const colors = getCategoryColorClasses(i);
                  const CatIcon = getCategoryIcon(cat.icon);
                  const itemCount = cat.serialCount + (cat.serialCount > 0 ? 0 : cat.productCount);

                  return (
                    <motion.button
                      key={cat.id}
                      variants={fadeItem}
                      onClick={() => navigate('categories')}
                      className={cn(
                        'flex items-center gap-3 p-3.5 rounded-xl border text-left active:scale-[0.97] transition-transform bg-white',
                        colors.border,
                      )}
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colors.bg)}>
                        <CatIcon className={cn('w-5 h-5', colors.text)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{cat.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {itemCount} item{itemCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* ── Menu Items ── */}
          <div className="space-y-3 mb-6">
            {MENU_ITEMS.map((item, i) => (
              <motion.button
                key={item.view}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                onClick={() => navigate(item.view)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform',
                  item.color,
                )}
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </motion.button>
            ))}
          </div>

          {/* ── Low Stock Alert ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-gray-900">Low Stock Alert</h3>
              </div>
              {lowStock.length > 0 && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {lowStock.length} item{lowStock.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : lowStock.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400">All stock levels are healthy</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {lowStock.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {item.brand || 'No brand'} · Threshold: {item.minStock} units
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          item.effectiveStock === 0 ? 'bg-red-600' : 'bg-amber-500',
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-bold',
                          item.effectiveStock === 0 ? 'text-red-600' : 'text-amber-600',
                        )}
                      >
                        {item.effectiveStock === 0 ? 'Out' : `${item.effectiveStock} left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}