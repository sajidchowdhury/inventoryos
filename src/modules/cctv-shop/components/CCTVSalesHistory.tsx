'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Search, ChevronRight, Calendar,
  Receipt, Package,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { CCTVSale } from '@/modules/cctv-shop/types';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Partial', value: 'PARTIALLY_PAID' },
  { label: 'Pending', value: 'PENDING' },
];

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-slate-100 text-slate-600',
};

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CCTVSalesHistory() {
  const { navigate, goBack } = useCCTVNavStore();
  const [allSales, setAllSales] = useState<CCTVSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Client-side filtering with useMemo
  const sales = useMemo(() => {
    let filtered = allSales;
    if (activeFilter) {
      filtered = filtered.filter((s) => s.status === activeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.saleCode.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          (s.customerPhone && s.customerPhone.includes(q))
      );
    }
    return filtered;
  }, [allSales, activeFilter, search]);

  // Stats
  const totalRevenue = allSales
    .filter((s) => s.status === 'PAID')
    .reduce((sum, s) => sum + s.totalDue, 0);
  const pendingCount = allSales.filter(
    (s) => s.status === 'PENDING' || s.status === 'PARTIALLY_PAID'
  ).length;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Sales History</h1>
        <span className="text-xs text-gray-400 font-medium">{allSales.length} sales</span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('new-sale')}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Stats banner */}
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-violet-500/20">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-bold">{allSales.length}</p>
            <p className="text-[10px] text-white/70">Total Sales</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {totalRevenue >= 1000
                ? `${(totalRevenue / 1000).toFixed(1)}k`
                : totalRevenue}
            </p>
            <p className="text-[10px] text-white/70">Revenue (৳)</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-[10px] text-white/70">Pending</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search sale code, customer..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-violet-500/30"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === tab.value
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sales list */}
      <div className="space-y-2.5 max-h-[calc(100vh-340px)] overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))
        ) : sales.length === 0 ? (
          <div className="text-center py-10">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No sales found</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeFilter || search ? 'Try a different filter' : 'Start selling to see history'}
            </p>
            {!activeFilter && !search && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('new-sale')}
                className="mt-3 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-lg shadow-violet-500/20"
              >
                Make a Sale
              </motion.button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {sales.map((sale, i) => (
              <motion.button
                key={sale.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.25, delay: i * 0.03 } }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => navigate('sale-detail', sale.id)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-violet-600">{sale.saleCode}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', STATUS_COLORS[sale.status])}>
                        {sale.status === 'PARTIALLY_PAID' ? 'Partial' : sale.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">
                      {sale.customerName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {sale.customerPhone && (
                        <span className="text-[11px] text-gray-500">{sale.customerPhone}</span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {sale._count?.items || 0} item{(sale._count?.items || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      ৳{sale.totalDue.toLocaleString()}
                    </p>
                    {sale.discountAmount > 0 && (
                      <p className="text-[10px] text-gray-400 line-through">
                        ৳{(sale.totalDue + sale.discountAmount).toLocaleString()}
                      </p>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-0.5" />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-500">{relativeDate(sale.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-500">
                      {sale._count?.payments || 0} payment{(sale._count?.payments || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}