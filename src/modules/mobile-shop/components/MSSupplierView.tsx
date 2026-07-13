'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  X,
  Phone,
  Plus,
  Package,
  Coins,
  AlertTriangle,
  TrendingUp,
  Building2,
  Wallet,
  Monitor,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MSCreateSupplierDialog } from './MSCreateSupplierDialog';
import { MSSupplierPaymentDialog } from './MSSupplierPaymentDialog';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface SupplierRecord {
  id: string;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance: number;
  totalPurchased: number;
  totalPaid: number;
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number; batches: number; msPurchases: number };
}

interface SupplierStats {
  totals: {
    supplierCount: number;
    totalPurchased: number;
    totalPaid: number;
    totalOutstanding: number;
    outstandingSuppliers: number;
  };
  topOutstanding: Array<{
    id: string;
    name: string;
    code?: string | null;
    balance: number;
    totalPurchased: number;
  }>;
}

interface OutstandingPurchase {
  id: string;
  purchaseNo: string;
  invoiceNo?: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  createdAt: string;
  ageDays: number;
  bucket: string;
  source: 'purchase' | 'mobile-shop';
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface BalanceQuickData {
  outstandingPurchases: OutstandingPurchase[];
}

// ── Component ──

export function MSSupplierView() {
  const { goBack, navigate } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Quick payment state
  const [quickPaySupplier, setQuickPaySupplier] = useState<SupplierRecord | null>(null);
  const [quickPayBalance, setQuickPayBalance] = useState<BalanceQuickData | null>(null);
  const [quickPayLoading, setQuickPayLoading] = useState(false);

  // ── Debounced search ──
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch suppliers ──
  const fetchSuppliers = useCallback(async () => {
    let cancelled = false;
    const controller = new AbortController();

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await fetch(
        `/api/businesses/${businessId}/suppliers?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!cancelled) setSuppliers(data.suppliers || []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (!cancelled) setSuppliers([]);
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => { cancelled = true; controller.abort(); };
  }, [businessId, search]);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // stats are non-critical
    }
  }, [businessId]);

  useEffect(() => {
    setLoading(true);
    fetchSuppliers();
    fetchStats();
  }, [fetchSuppliers, fetchStats]);

  const handleSaved = useCallback(() => {
    setLoading(true);
    fetchSuppliers();
    fetchStats();
  }, [fetchSuppliers, fetchStats]);

  // ── Quick pay: fetch balance for supplier ──
  const openQuickPay = async (supplier: SupplierRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickPaySupplier(supplier);
    setQuickPayLoading(true);

    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${supplier.id}/balance`);
      if (res.ok) {
        const data = await res.json();
        setQuickPayBalance({
          outstandingPurchases: data.outstandingPurchases || [],
        });
      }
    } catch {
      // error
    } finally {
      setQuickPayLoading(false);
    }
  };

  // ── Derived stats ──
  const localStats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const outstandingSuppliers = suppliers.filter((s) => s.balance > 0).length;
    const totalOutstanding = suppliers.reduce((sum, s) => sum + s.balance, 0);
    return { totalSuppliers, outstandingSuppliers, totalOutstanding };
  }, [suppliers]);

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Suppliers</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 active:opacity-90 transition-all"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Quick stats ── */}
      {!loading && (stats || localStats.totalSuppliers > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.1 } }}
          className="grid grid-cols-3 gap-2.5"
        >
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 mx-auto rounded-lg bg-cyan-50 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-600" />
            </div>
            <p className="text-base font-bold text-gray-900">
              {stats?.totals.supplierCount ?? localStats.totalSuppliers}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Suppliers</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 mx-auto rounded-lg bg-amber-50 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-base font-bold text-amber-700">
              {formatBDT(stats?.totals.totalOutstanding ?? localStats.totalOutstanding)}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Outstanding</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="flex items-center justify-center w-7 h-7 mx-auto rounded-lg bg-emerald-50 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-base font-bold text-gray-900">
              {formatBDT(stats?.totals.totalPurchased ?? 0)}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Total Purchased</p>
          </div>
        </motion.div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
        <input
          type="text"
          placeholder="Search by name, phone, code..."
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

      {/* ── Supplier cards ── */}
      <div className="space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto">
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
        ) : suppliers.length === 0 ? (
          <div className="text-center py-10">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No suppliers found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search
                ? 'Try a different search term'
                : 'Tap + to add your first supplier'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {suppliers.map((supplier, i) => {
              const totalPurchases = (supplier._count?.purchases || 0) + (supplier._count?.msPurchases || 0);
              const hasDue = supplier.balance > 0;

              return (
                <motion.div
                  key={supplier.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.04 } }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <button
                    onClick={() => navigate('supplier-detail', supplier.id)}
                    className="w-full p-4 text-left"
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-white text-sm font-bold">
                          {supplier.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {supplier.name}
                          </p>
                          {hasDue && (
                            <Badge className="text-[10px] px-1.5 py-0 rounded-full border-0 font-semibold leading-4 bg-amber-100 text-amber-700 shrink-0">
                              Due
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {supplier.phone || supplier.code || 'No contact'}
                          </span>
                        </div>
                      </div>
                      {hasDue && (
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-amber-600">{formatBDT(supplier.balance)}</p>
                        </div>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Package className="w-2.5 h-2.5" /> Purchases
                        </p>
                        <p className="text-xs font-semibold text-gray-900 mt-0.5">
                          {totalPurchases}
                          {supplier._count?.msPurchases && supplier._count.msPurchases > 0 && (
                            <span className="ml-1 text-[9px] text-cyan-500">({supplier._count.msPurchases} CCTV)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Coins className="w-2.5 h-2.5" /> Total
                        </p>
                        <p className="text-xs font-semibold text-gray-900 mt-0.5">
                          {formatBDT(supplier.totalPurchased)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Balance
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${hasDue ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatBDT(supplier.balance)}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Quick pay button (only if has due) */}
                  {hasDue && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={(e) => openQuickPay(supplier, e)}
                        disabled={quickPayLoading}
                        className="w-full h-9 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold active:bg-emerald-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        {quickPayLoading && quickPaySupplier?.id === supplier.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-emerald-600 rounded-full"
                          />
                        ) : (
                          <Wallet className="w-3.5 h-3.5" />
                        )}
                        Quick Pay
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── Create/Edit Dialog ── */}
      <MSCreateSupplierDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      {/* ── Quick Payment Dialog ── */}
      {quickPaySupplier && (
        <MSSupplierPaymentDialog
          open={!!quickPaySupplier}
          onClose={() => { setQuickPaySupplier(null); setQuickPayBalance(null); }}
          supplierId={quickPaySupplier.id}
          supplierName={quickPaySupplier.name}
          outstandingBalance={quickPaySupplier.balance}
          outstandingPurchases={quickPayBalance?.outstandingPurchases || []}
          onPaymentSuccess={handleSaved}
          businessId={businessId}
        />
      )}
    </motion.div>
  );
}