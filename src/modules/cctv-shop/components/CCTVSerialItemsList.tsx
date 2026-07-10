'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowLeft,
  X,
  Shield,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SerialStatusChangeDialog } from './SerialStatusChangeDialog';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'IN_STOCK', label: 'In Stock' },
  { key: 'SOLD', label: 'Sold' },
  { key: 'INSTALLED', label: 'Installed' },
  { key: 'IN_REPAIR', label: 'In Repair' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'RETURNED', label: 'Returned' },
  { key: 'DEFECTIVE', label: 'Defective' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  IN_STOCK: 'bg-emerald-100 text-emerald-700',
  SOLD: 'bg-blue-100 text-blue-700',
  INSTALLED: 'bg-violet-100 text-violet-700',
  IN_REPAIR: 'bg-amber-100 text-amber-700',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-700',
  RETURNED: 'bg-orange-100 text-orange-700',
  DEFECTIVE: 'bg-gray-100 text-gray-600',
  WARRANTY_ACTIVE: 'bg-green-100 text-green-700',
  WARRANTY_EXPIRED: 'bg-red-100 text-red-600',
  DISPOSED: 'bg-gray-100 text-gray-500',
  CONSUMED: 'bg-slate-100 text-slate-500',
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Types ──

interface SerialItem {
  id: string;
  serialNumber: string;
  imei?: string | null;
  status: string;
  grade?: string | null;
  costPrice?: number | null;
  sellPrice?: number | null;
  warrantyMonths: number;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  customerName?: string | null;
  branchId?: string | null;
  currentLocation?: string | null;
  notes?: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    brand?: string | null;
    imageUrl?: string | null;
    sellPrice: number;
  };
}

interface SerialListResponse {
  items: SerialItem[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Component ──

export function CCTVSerialItemsList() {
  const { goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [items, setItems] = useState<SerialItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;
  const [statusItem, setStatusItem] = useState<SerialItem | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  // ── Fetch ──
  const doFetch = useCallback(async (p: number, status: string, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
      });
      if (status) params.set('status', status);
      if (q.trim()) params.set('search', q.trim());

      const res = await fetch(
        `/api/businesses/${businessId}/cctv/serial-items?${params.toString()}`
      );
      if (res.ok) {
        const data: SerialListResponse = await res.json();
        setItems(data.items);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch {
      // error
    }
    setLoading(false);
  }, [businessId]);

  // Track mounted state to avoid stale closures
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Initial load + filter changes
  useEffect(() => {
    const params = new URLSearchParams({
      page: '1',
      limit: String(limit),
    });
    if (activeFilter) params.set('status', activeFilter);
    const q = search.trim();
    if (q) params.set('search', q);

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/businesses/${businessId}/cctv/serial-items?${params.toString()}`
        );
        if (res.ok && !cancelled) {
          const data: SerialListResponse = await res.json();
          if (mountedRef.current) {
            setItems(data.items);
            setTotal(data.total);
            setPage(data.page);
            setTotalPages(data.totalPages);
          }
        }
      } catch {
        // error
      }
      if (mountedRef.current) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [activeFilter, businessId, limit, search]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch(1, activeFilter, value);
    }, 350);
  };

  const clearSearch = () => {
    setSearch('');
    doFetch(1, activeFilter, '');
  };

  const handleFilterChange = (status: string) => {
    setActiveFilter(status);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    doFetch(newPage, activeFilter, search);
  };

  // ── Helpers ──
  const warrantyExpiry = (item: SerialItem) => {
    if (item.warrantyEnd) {
      const d = new Date(item.warrantyEnd);
      const now = new Date();
      const expired = d < now;
      return {
        label: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        expired,
      };
    }
    if (item.warrantyMonths > 0 && item.warrantyStart) {
      const start = new Date(item.warrantyStart);
      const end = new Date(start);
      end.setMonth(end.getMonth() + item.warrantyMonths);
      const now = new Date();
      return {
        label: end.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        expired: end < now,
      };
    }
    return null;
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Serial Items</h1>
        {!loading && (
          <span className="text-xs text-gray-400 font-medium">
            {total.toLocaleString()} items
          </span>
        )}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <input
          type="text"
          placeholder="Search by product, serial, IMEI, customer..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
        />
        {search && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === f.key
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Loading skeletons ── */}
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* ── Empty state ── */
        <div className="text-center py-12">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">No serial items found</p>
          <p className="text-xs text-gray-400 mt-1">
            {search || activeFilter
              ? 'Try a different search or filter'
              : 'Add products and stock them in to get started'}
          </p>
        </div>
      ) : (
        /* ── List ── */
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => {
              const sty = STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-600';
              const label = formatStatusLabel(item.status);
              const warranty = warrantyExpiry(item);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03 } }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {item.product.brand
                          ? `${item.product.brand} ${item.product.name}`
                          : item.product.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Shield className="w-3 h-3 text-gray-400 shrink-0" />
                        <p className="text-xs font-mono text-gray-500 truncate">
                          {item.serialNumber}
                        </p>
                      </div>
                      {item.imei && (
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5 ml-4.5">
                          IMEI: {item.imei}
                        </p>
                      )}
                      {(item.customerName || item.currentLocation) && (
                        <div className="flex items-center gap-1 mt-1">
                          {item.customerName && (
                            <>
                              <span className="text-[10px] text-gray-400">Customer:</span>
                              <span className="text-[10px] font-medium text-gray-600">
                                {item.customerName}
                              </span>
                            </>
                          )}
                          {item.currentLocation && (
                            <>
                              {item.customerName && (
                                <span className="text-[10px] text-gray-300">·</span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {item.currentLocation}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap', sty)}
                      >
                        {label}
                      </Badge>
                      <button
                        onClick={() => { setStatusItem(item); setShowStatusDialog(true); }}
                        className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center active:bg-violet-50 active:border-violet-200 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Footer: warranty + price */}
                  <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {warranty ? (
                        <>
                          <span className="text-[11px] text-gray-400">Warranty</span>
                          <span
                            className={cn(
                              'text-xs font-medium',
                              warranty.expired ? 'text-red-500' : 'text-gray-600'
                            )}
                          >
                            {warranty.expired ? 'Expired' : 'until'} {warranty.label}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-400">No warranty</span>
                      )}
                    </div>
                    {item.sellPrice != null && item.sellPrice > 0 && (
                      <span className="text-xs font-bold text-gray-700">
                        ৳{item.sellPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30 active:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <p className="text-xs text-gray-500 font-medium">
            {page} of {totalPages}
          </p>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center disabled:opacity-30 active:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* ── Total count footer ── */}
      {!loading && items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-center">
            <div>
              <p className="text-[10px] text-gray-400">Showing</p>
              <p className="text-xs font-bold text-gray-700">
                {((page - 1) * limit) + 1}–{Math.min(page * limit, total)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Total</p>
              <p className="text-xs font-bold text-gray-700">{total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Pages</p>
              <p className="text-xs font-bold text-gray-700">{totalPages}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Change Dialog ── */}
      <SerialStatusChangeDialog
        open={showStatusDialog}
        onClose={() => setShowStatusDialog(false)}
        onSaved={() => doFetch(page, activeFilter, search)}
        item={statusItem ? {
          id: statusItem.id,
          serialNumber: statusItem.serialNumber,
          status: statusItem.status,
          productName: statusItem.product.name,
          brand: statusItem.product.brand,
        } : null}
      />
    </motion.div>
  );
}