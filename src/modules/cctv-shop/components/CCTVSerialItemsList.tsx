'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, X, Shield } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const filters = ['All', 'In Stock', 'Sold', 'Installed', 'In Repair'] as const;

const statusColors: Record<string, string> = {
  'in-stock': 'bg-emerald-100 text-emerald-700',
  sold: 'bg-blue-100 text-blue-700',
  installed: 'bg-violet-100 text-violet-700',
  'in-repair': 'bg-amber-100 text-amber-700',
  'warranty-claim': 'bg-red-100 text-red-700',
  defective: 'bg-gray-100 text-gray-600',
};

const statusLabel: Record<string, string> = {
  'in-stock': 'In Stock',
  sold: 'Sold',
  installed: 'Installed',
  'in-repair': 'In Repair',
  'warranty-claim': 'Warranty Claim',
  defective: 'Defective',
};

const mockSerialItems = [
  { id: '1', product: 'Hikvision DS-2CD2143G2', serial: 'HK-2024-A7X92K01', status: 'in-stock', warrantyExpiry: '2026-03-15' },
  { id: '2', product: 'Hikvision DS-2CD2143G2', serial: 'HK-2024-A7X92K02', status: 'sold', warrantyExpiry: '2026-03-15' },
  { id: '3', product: 'Dahua IPC-HDW2431T-AS', serial: 'DH-BH24031-0045', status: 'installed', warrantyExpiry: '2025-11-20' },
  { id: '4', product: 'Hikvision DS-7608NI-Q2/8P', serial: 'HK-NVR-7608-0089', status: 'installed', warrantyExpiry: '2026-07-01' },
  { id: '5', product: 'Dahua XVR5108HS-I3', serial: 'DH-XVR5108-0123', status: 'in-repair', warrantyExpiry: '2025-08-10' },
  { id: '6', product: 'Hikvision DS-2CE5AD0T-IRP', serial: 'HK-BULLET-CE5A-0567', status: 'sold', warrantyExpiry: '2026-01-05' },
  { id: '7', product: 'Hikvision DS-2DE4A425IW', serial: 'HK-PTZ-4A425-0003', status: 'in-stock', warrantyExpiry: '2027-02-28' },
  { id: '8', product: 'Dahua DH-IPC-HFW2831E', serial: 'DH-BULLET-2831-0091', status: 'warranty-claim', warrantyExpiry: '2025-09-12' },
  { id: '9', product: 'Hikvision DS-2CD2346G2', serial: 'HK-2024-2346G-0012', status: 'installed', warrantyExpiry: '2026-05-18' },
  { id: '10', product: 'TP-Link TL-SG1008P', serial: 'TP-SG1008P-0442', status: 'in-stock', warrantyExpiry: '2026-12-01' },
];

export function CCTVSerialItemsList() {
  const { goBack } = useCCTVNavStore();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const filtered = mockSerialItems.filter((item) => {
    const matchesSearch =
      !search ||
      item.product.toLowerCase().includes(search.toLowerCase()) ||
      item.serial.toLowerCase().includes(search.toLowerCase());
    const statusKey = item.status as string;
    const matchesFilter =
      activeFilter === 'All' ||
      statusLabel[statusKey] === activeFilter;
    return matchesSearch && matchesFilter;
  });

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Serial Items</h1>
        <span className="text-xs text-gray-400">{mockSerialItems.length} items</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <input
          type="text"
          placeholder="Search by product or serial..."
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

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeFilter === f
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {filtered.map((item, i) => {
          const statusKey = item.status as string;
          const expiry = item.warrantyExpiry
            ? new Date(item.warrantyExpiry).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })
            : 'N/A';

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.product}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Shield className="w-3 h-3 text-gray-400 shrink-0" />
                    <p className="text-xs font-mono text-gray-500">{item.serial}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap',
                    statusColors[statusKey]
                  )}
                >
                  {statusLabel[statusKey]}
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Warranty until</span>
                <span className="text-xs font-medium text-gray-600">{expiry}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No serial items found</p>
        </div>
      )}
    </motion.div>
  );
}