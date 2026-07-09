'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, X, Phone, User, ShoppingCart,
  IndianRupee, Clock,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const mockCustomers = [
  { id: '1', name: 'Rahim Electronics', phone: '01712-345678', totalPurchases: 245000, lastPurchase: '2025-01-10', balance: 15000 },
  { id: '2', name: 'City Shopping Mall Ltd', phone: '01815-987654', totalPurchases: 890000, lastPurchase: '2025-01-14', balance: 45000 },
  { id: '3', name: 'BD Bank, Motijheel', phone: '01923-456789', totalPurchases: 1250000, lastPurchase: '2025-01-12', balance: 0 },
  { id: '4', name: 'Green Tower Residency', phone: '01634-567890', totalPurchases: 156000, lastPurchase: '2025-01-08', balance: 8000 },
  { id: '5', name: 'Metro General Hospital', phone: '01567-890123', totalPurchases: 320000, lastPurchase: '2024-12-20', balance: 0 },
  { id: '6', name: 'Pacific Telecom', phone: '01845-678901', totalPurchases: 540000, lastPurchase: '2025-01-13', balance: 72000 },
  { id: '7', name: 'Sunrise School & College', phone: '01789-012345', totalPurchases: 198000, lastPurchase: '2025-01-05', balance: 12000 },
  { id: '8', name: 'Bashundhara City', phone: '01934-123456', totalPurchases: 670000, lastPurchase: '2025-01-11', balance: 0 },
];

export function CCTVCustomersList() {
  const { navigate, goBack } = useCCTVNavStore();
  const [search, setSearch] = useState('');

  const filtered = mockCustomers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const activeCount = mockCustomers.filter((c) => c.balance > 0).length;

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Customers</h1>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <span className="font-semibold text-gray-700">{mockCustomers.length} Customers</span>
        <span>·</span>
        <span className="text-violet-600 font-medium">{activeCount} with balance</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Customer list */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {filtered.map((customer, i) => {
          const lastPurchase = new Date(customer.lastPurchase).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          });

          return (
            <motion.button
              key={customer.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
              onClick={() => navigate('customer-detail', customer.id)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{customer.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{customer.phone}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <ShoppingCart className="w-2.5 h-2.5" /> Purchases
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">৳{(customer.totalPurchases / 1000).toFixed(0)}K</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> Last Order
                  </p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{lastPurchase}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <IndianRupee className="w-2.5 h-2.5" /> Balance
                  </p>
                  <p className={cn(
                    'text-xs font-semibold mt-0.5',
                    customer.balance > 0 ? 'text-red-600' : 'text-emerald-600'
                  )}>
                    {customer.balance > 0 ? `৳${customer.balance.toLocaleString()}` : 'Clear'}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No customers found</p>
        </div>
      )}
    </motion.div>
  );
}