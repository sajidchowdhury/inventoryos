'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Hash,
  ChevronRight,
  Download,
  Package,
  PackageSearch,
  X,
  ShoppingCart,
  Layers,
  Factory,
  Fingerprint,
  Tags,
  Box,
  ArrowLeftRight,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Types ──

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

// ── Menu Items (ordered per user request) ──

const MENU_ITEMS = [
  { label: 'Suppliers', desc: 'Manage vendor contacts & orders', view: 'suppliers' as const, icon: Factory, gradient: 'from-emerald-400 to-teal-500', ring: 'ring-emerald-500/20' },
  { label: 'Products List', desc: 'Manage all CCTV products', view: 'products' as const, icon: Package, gradient: 'from-blue-400 to-indigo-500', ring: 'ring-blue-500/20' },
  { label: 'Serial Products', desc: 'Track individual items by serial', view: 'serial-items' as const, icon: Fingerprint, gradient: 'from-cyan-400 to-blue-600', ring: 'ring-cyan-500/20' },
  { label: 'Category', desc: 'Organize products by type & brand', view: 'categories' as const, icon: Tags, gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-500/20' },
  { label: 'Kits & Bundle', desc: 'Pre-configured product packages', view: 'kits' as const, icon: Box, gradient: 'from-cyan-400 to-blue-500', ring: 'ring-cyan-500/20' },
  { label: 'Transfers', desc: 'Move stock between branches', view: 'transfers' as const, icon: ArrowLeftRight, gradient: 'from-pink-400 to-rose-500', ring: 'ring-pink-500/20' },
  { label: 'Branches', desc: 'Multi-branch location management', view: 'branches' as const, icon: Building2, gradient: 'from-fuchsia-400 to-blue-600', ring: 'ring-fuchsia-500/20' },
];

// ── Component ──

export function MSInventoryHub() {
  const { navigate } = useMSNavStore();
  const businessId = useMSBusinessId();

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
        `/api/businesses/${businessId}/mobile-shop/inventory-stats?${params.toString()}`
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
          `/api/businesses/${businessId}/mobile-shop/inventory-stats`
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

      {/* ── 1. Banner: Serial Items Highlight ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={() => navigate('serial-items')}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 p-4 mb-5 cursor-pointer active:scale-[0.98] transition-transform shadow-lg shadow-cyan-500/20"
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

      {/* ── 2. Quick Actions: Stock In + Purchase Order ── */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
          transition={{ delay: 0.15 }}
          onClick={() => navigate('purchase-orders')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-left active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/20"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10 flex items-center gap-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm">Purchase Order</span>
          </div>
          <p className="text-white/70 text-[11px]">Supplier orders</p>
        </motion.button>
      </div>

      {/* ── 3. Search ── */}
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
                className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-cyan-500/30 pr-8"
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
                  <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.brand && (
                        <span className="text-[10px] text-gray-400">{item.brand}</span>
                      )}
                      {item.serialNumber && (
                        <span className="text-[10px] font-mono text-cyan-500 bg-cyan-50 px-1.5 py-0.5 rounded">
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

      {/* ── Menu Items (only when not searching) ── */}
      {(!showSearch || !searchQuery) && (
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-4 rounded-full bg-gradient-to-b from-cyan-500 to-blue-600" />
            <h3 className="text-[13px] font-bold text-gray-900 tracking-tight">Stock Management</h3>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="space-y-2.5">
            {MENU_ITEMS.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.view}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(item.view)}
                  className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-left"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm ring-1',
                    item.gradient,
                    item.ring,
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}