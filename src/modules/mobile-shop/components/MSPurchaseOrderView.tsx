'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  Package,
  Coins,
  AlertTriangle,
  ShoppingBag,
  FileText,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partial', value: 'PARTIAL' },
];

interface PurchaseItem {
  id: string;
  businessId: string;
  supplierId: string;
  purchaseNo: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; code: string | null } | null;
  _count: { items: number };
}

interface PurchaseSummary {
  totalCount: number;
  totalValue: number;
  totalPaid: number;
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getPaymentBadge(paymentStatus: string) {
  switch (paymentStatus) {
    case 'PAID':
      return { label: 'Paid', className: 'bg-emerald-100 text-emerald-700 border-0' };
    case 'PARTIAL':
      return { label: 'Partial', className: 'bg-amber-100 text-amber-700 border-0' };
    case 'UNPAID':
      return { label: 'Unpaid', className: 'bg-red-100 text-red-700 border-0' };
    default:
      return { label: paymentStatus, className: 'bg-gray-100 text-gray-600 border-0' };
  }
}

// ── Component ──

export function MSPurchaseOrderView() {
  const { goBack, navigate } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('');

  // ── Debounced search ──
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Derived status filter for API ──
  const statusFilter = useMemo(() => {
    switch (activeStatus) {
      case 'RECEIVED':
        return 'RECEIVED';
      case 'UNPAID':
        return 'UNPAID';
      case 'PARTIAL':
        return 'PARTIAL';
      default:
        return '';
    }
  }, [activeStatus]);

  // ── Fetch purchases ──
  const fetchPurchases = useCallback(async () => {
    let cancelled = false;
    const controller = new AbortController();

    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/purchases?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancelled) {
        setPurchases(data.purchases || []);
        setSummary(data.summary || null);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!cancelled) {
        setPurchases([]);
        setSummary(null);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [businessId, search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchPurchases();
  }, [fetchPurchases]);

  // ── Local fallback summary ──
  const localSummary = useMemo(() => {
    const totalCount = purchases.length;
    const totalValue = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
    return { totalCount, totalValue, totalPaid };
  }, [purchases]);

  const displaySummary = summary ?? localSummary;
  const outstanding = displaySummary.totalValue - displaySummary.totalPaid;

  // ── Render ──

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Purchase Orders</h1>
        <button
          onClick={() => navigate('create-purchase')}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 active:opacity-90 transition-all"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Summary stats ── */}
      {!loading && (displaySummary.totalCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.1 } }}
          className="grid grid-cols-3 gap-2.5"
        >
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 mx-auto rounded-lg bg-cyan-50 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-600" />
            </div>
            <p className="text-base font-bold text-gray-900">
              {displaySummary.totalCount}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Total Orders</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 mx-auto rounded-lg bg-emerald-50 mb-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-base font-bold text-gray-900">
              {formatBDT(displaySummary.totalValue)}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Total Value</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 mx-auto rounded-lg bg-amber-50 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-base font-bold text-amber-700">
              {formatBDT(outstanding)}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Outstanding</p>
          </div>
        </motion.div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
        <input
          type="text"
          placeholder="Search by purchase no, supplier, invoice..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(''); setSearch(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveStatus(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeStatus === tab.value
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Purchase cards ── */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-50">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-18" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))
        ) : purchases.length === 0 ? (
          <div className="text-center py-10">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No purchase orders found</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeStatus || search
                ? 'Try a different filter or search term'
                : 'Tap + to create your first purchase order'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {purchases.map((purchase, i) => {
              const badge = getPaymentBadge(purchase.paymentStatus);
              return (
                <motion.button
                  key={purchase.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.04 } }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => navigate('purchase-detail', purchase.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                      <ShoppingBag className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {purchase.purchaseNo}
                        </p>
                        <Badge
                          className={cn(
                            'text-[10px] px-1.5 py-0 rounded-full font-semibold leading-4 shrink-0',
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">
                          {purchase.supplier?.name || 'Unknown Supplier'}
                        </span>
                        {purchase.supplier?.code && (
                          <span className="text-[10px] text-gray-400">
                            ({purchase.supplier.code})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {formatDate(purchase.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Package className="w-2.5 h-2.5" /> Items
                      </p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">
                        {purchase._count.items}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" /> Total
                      </p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">
                        {formatBDT(purchase.totalAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Paid
                      </p>
                      <p className={cn(
                        'text-xs font-semibold mt-0.5',
                        purchase.paidAmount >= purchase.totalAmount ? 'text-emerald-600' : 'text-amber-600',
                      )}>
                        {formatBDT(purchase.paidAmount)}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}