'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  X,
  Phone,
  User,
  ShoppingCart,
  Coins,
  Shield,
  Plus,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { MSCreateCustomerDialog } from './MSCreateCustomerDialog';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  totalSpent: number;
  visitCount: number;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  preferredPaymentMethod: string;
  createdAt: string;
  msSalesCount: number;
  msTotalSpent: number;
}

const TIER_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Bronze', value: 'BRONZE' },
  { label: 'Silver', value: 'SILVER' },
  { label: 'Gold', value: 'GOLD' },
  { label: 'Platinum', value: 'PLATINUM' },
];

const TIER_BADGE_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700',
  SILVER: 'bg-gray-100 text-gray-600',
  GOLD: 'bg-yellow-100 text-yellow-700',
  PLATINUM: 'bg-cyan-100 text-cyan-700',
};

const TIER_AVATAR_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-500',
  SILVER: 'bg-gray-500',
  GOLD: 'bg-yellow-500',
  PLATINUM: 'bg-cyan-500',
};

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString()}`;
}

// ── Component ──

export function MSCustomersList() {
  const { navigate, goBack } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customersWithBalance, setCustomersWithBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTier, setActiveTier] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  // ── Debounced search (300ms via useEffect + AbortController) ──
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchInput]);

  // ── Fetch customers from API ──
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchCustomers = async () => {
      setLoading(true);

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (activeTier) params.set('tier', activeTier);
      params.set('sortBy', 'msTotalSpent');
      params.set('sortDir', 'desc');

      try {
        const res = await fetch(
          `/api/businesses/${businessId}/mobile-shop/customers?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setCustomers(json.customers || []);
          setCustomersWithBalance(json.customersWithBalance || 0);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCustomers();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [search, activeTier, fetchKey, businessId]);

  // ── Derived stats via useMemo ──
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const loyaltyMembers = customers.filter((c) => c.loyaltyTier !== 'BRONZE').length;
    return { totalCustomers, loyaltyMembers };
  }, [customers]);

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Customers</h1>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center active:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Quick stats row ── */}
      {!loading && customers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.1 } }}
          className="flex items-center gap-2.5 text-xs text-gray-500 px-1 flex-wrap"
        >
          <span className="font-semibold text-gray-700">
            {stats.totalCustomers} Customers
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-cyan-600 font-medium">
            {customersWithBalance} with balance
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-amber-600 font-medium">
            {stats.loyaltyMembers} loyalty
          </span>
        </motion.div>
      )}

      {/* ── Search input ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400 transition-all"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              setSearch('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Tier filter tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TIER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTier(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeTier === tab.value
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Customer cards ── */}
      <div className="space-y-2.5 max-h-[calc(100vh-420px)] overflow-y-auto">
        {loading ? (
          /* Skeleton loading state */
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-50">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))
        ) : customers.length === 0 ? (
          /* Empty state */
          <div className="text-center py-10">
            <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No customers found</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeTier || search
                ? 'Try a different filter or search term'
                : 'Customers will appear here after their first purchase'}
            </p>
          </div>
        ) : (
          /* Customer list */
          <AnimatePresence mode="popLayout">
            {customers.map((customer, i) => {
              const avatarColor =
                TIER_AVATAR_COLORS[customer.loyaltyTier] || 'bg-gray-400';
              const badgeColor =
                TIER_BADGE_COLORS[customer.loyaltyTier] || 'bg-gray-100 text-gray-600';

              return (
                <motion.button
                  key={customer.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.25, delay: i * 0.04 },
                  }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => navigate('customer-detail', customer.id)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  {/* Top row: avatar + name/phone + badge */}
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        avatarColor,
                      )}
                    >
                      <span className="text-white text-sm font-bold">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {customer.name}
                        </p>
                        <Badge
                          className={cn(
                            'text-[10px] px-1.5 py-0 rounded-full border-0 font-semibold leading-4',
                            badgeColor,
                          )}
                        >
                          {customer.loyaltyTier}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {customer.phone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <ShoppingCart className="w-2.5 h-2.5" /> Purchases
                      </p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">
                        {customer.msSalesCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" /> Total Spent
                      </p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">
                        {formatBDT(customer.msTotalSpent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Points
                      </p>
                      <p className="text-xs font-semibold text-cyan-600 mt-0.5">
                        {customer.loyaltyPoints.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── FAB (visible when scrolled to bottom) ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
        onClick={() => setShowCreateDialog(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* ── Create Customer Dialog ── */}
      <MSCreateCustomerDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSaved={() => setFetchKey((k) => k + 1)}
      />
    </motion.div>
  );
}