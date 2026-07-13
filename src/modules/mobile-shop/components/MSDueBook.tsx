'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Phone, ChevronDown, ChevronUp, Banknote,
  Users, Clock, AlertTriangle, Loader2, ExternalLink,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '../hooks/use-ms-business-id';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const formatBDT = (n: number) => '\u09F3' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface DueSale {
  id: string;
  saleCode: string;
  totalDue: number;
  saleDate: string;
  totalPaid: number;
  balance: number;
}

interface CustomerDue {
  customerName: string;
  customerPhone: string | null;
  sales: DueSale[];
  aging: { bucket0_30: number; bucket31_60: number; bucket61_90: number; bucket90plus: number };
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
}

interface DueBookSummary {
  totalCustomers: number;
  totalOutstanding: number;
  totalSales: number;
  aging: { bucket0_30: number; bucket31_60: number; bucket61_90: number; bucket90plus: number };
}

const AGING_BUCKETS = [
  { key: 'bucket0_30' as const, label: '0–30d', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  { key: 'bucket31_60' as const, label: '31–60d', color: 'text-amber-700', bg: 'bg-amber-50' },
  { key: 'bucket61_90' as const, label: '61–90d', color: 'text-orange-700', bg: 'bg-orange-50' },
  { key: 'bucket90plus' as const, label: '90+d', color: 'text-red-700', bg: 'bg-red-50' },
];

export function MSDueBook() {
  const { goBack, navigate } = useMSNavStore();
  const businessId = useMSBusinessId();

  const [customers, setCustomers] = useState<CustomerDue[]>([]);
  const [summary, setSummary] = useState<DueBookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const fetchDueBook = useCallback(async (query = '') => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/sales/due-book?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setSummary(data.summary || null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchDueBook();
  }, [fetchDueBook]);

  // Debounced search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(setTimeout(() => fetchDueBook(value), 400));
  };

  // Filter customers locally too (for instant feedback)
  const filteredCustomers = searchQuery && !loading
    ? customers.filter((c) =>
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.customerPhone || '').includes(searchQuery)
      )
    : customers;

  const toggleCustomer = (phone: string) => {
    setExpandedCustomer((prev) => (prev === phone ? null : phone));
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Due Book</h1>
          <p className="text-[11px] text-gray-400">Customer outstanding balances</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-10 rounded-xl pl-9 pr-8 bg-white border-gray-200 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(''); fetchDueBook(''); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
          >
            <span className="text-gray-400 text-xs">✕</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3">
              <Skeleton className="h-4 w-12 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <motion.div {...fadeUp} className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-violet-500" />
              <p className="text-[10px] text-gray-400">Customers</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{summary.totalCustomers}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote className="w-3.5 h-3.5 text-red-500" />
              <p className="text-[10px] text-gray-400">Outstanding</p>
            </div>
            <p className="text-lg font-bold text-red-600">{formatBDT(summary.totalOutstanding)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-[10px] text-gray-400">Unpaid Sales</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{summary.totalSales}</p>
          </div>
        </motion.div>
      ) : null}

      {/* Aging Summary Bar (when there's data) */}
      {summary && summary.totalOutstanding > 0 && !loading && (
        <motion.div {...fadeUp} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700 mb-2.5">Aging Overview</p>
          <div className="space-y-2">
            {AGING_BUCKETS.map((bucket) => {
              const amount = summary.aging[bucket.key];
              if (amount <= 0) return null;
              const pct = summary.totalOutstanding > 0 ? (amount / summary.totalOutstanding) * 100 : 0;
              return (
                <div key={bucket.key} className="flex items-center gap-2.5">
                  <span className="text-[10px] font-semibold text-gray-500 w-12 shrink-0">{bucket.label}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, 2)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={cn('h-full rounded-full', bucket.bg)}
                    />
                  </div>
                  <span className={cn('text-[11px] font-bold w-16 text-right shrink-0', bucket.color)}>
                    {formatBDT(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Customer List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
            <Banknote className="w-7 h-7 text-emerald-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">
            {searchQuery ? 'No customers found' : 'All dues cleared!'}
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {searchQuery ? 'Try a different search term' : 'No outstanding balances right now'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomer === (customer.customerPhone || customer.customerName);
            const isHighRisk = customer.aging.bucket90plus > 0 || customer.aging.bucket61_90 > 0;

            return (
              <motion.div
                key={customer.customerName + customer.customerPhone}
                layout
                {...fadeUp}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Customer Header */}
                <button
                  onClick={() => toggleCustomer(customer.customerPhone || customer.customerName)}
                  className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-violet-600">
                      {customer.customerName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {customer.customerName}
                      </p>
                      {isHighRisk && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                    {customer.customerPhone ? (
                      <p className="text-[11px] text-gray-400">{customer.customerPhone}</p>
                    ) : (
                      <p className="text-[11px] text-gray-300 italic">Walk-in</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-red-600">
                      {formatBDT(customer.totalBalance)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {customer.sales.length} sale{customer.sales.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </button>

                {/* Expanded: Aging breakdown + Sales list */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                        {/* Aging breakdown row */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-8 shrink-0">Aging</span>
                          {AGING_BUCKETS.map((bucket) => {
                            const amount = customer.aging[bucket.key];
                            return (
                              <span
                                key={bucket.key}
                                className={cn(
                                  'flex-1 text-center py-1 rounded-lg text-[10px] font-semibold',
                                  amount > 0 ? bucket.bg + ' ' + bucket.color : 'bg-gray-50 text-gray-300'
                                )}
                              >
                                {amount > 0 ? formatBDT(amount) : '—'}
                                <span className="block text-[8px] font-medium opacity-60">{bucket.label}</span>
                              </span>
                            );
                          })}
                        </div>

                        {/* Individual sales */}
                        <div className="space-y-2">
                          {customer.sales.map((sale) => (
                            <div
                              key={sale.id}
                              className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2.5"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">
                                  {sale.saleCode}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {new Date(sale.saleDate).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                  })}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] text-gray-400 line-through">
                                  {formatBDT(sale.totalDue)}
                                </p>
                                <p className="text-xs font-bold text-red-600">
                                  Due: {formatBDT(sale.balance)}
                                </p>
                              </div>
                              <button
                                onClick={() => navigate('sale-detail', sale.id)}
                                className="p-1.5 rounded-lg hover:bg-violet-50 transition-colors shrink-0"
                                title="View sale"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-violet-500" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Collect Payment button */}
                        {customer.sales.length === 1 && (
                          <button
                            onClick={() => navigate('sale-detail', customer.sales[0].id)}
                            className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-transform"
                          >
                            <Banknote className="w-4 h-4" />
                            Collect {formatBDT(customer.totalBalance)}
                          </button>
                        )}
                        {customer.sales.length > 1 && (
                          <p className="text-[10px] text-gray-400 text-center">
                            Tap a sale to add payment
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}