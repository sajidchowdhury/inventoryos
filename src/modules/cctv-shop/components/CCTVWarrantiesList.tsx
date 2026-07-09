'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, X, Shield, ShieldCheck, ShieldAlert,
  Clock, AlertTriangle,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const mockWarranties = [
  { id: '1', product: 'Hikvision DS-2CD2143G2', serial: 'HK-2024-A7X92K01', customer: 'Rahim Electronics', purchaseDate: '2024-03-15', period: '24 months', expiry: '2026-03-15', daysLeft: 410 },
  { id: '2', product: 'Dahua IPC-HDW2431T-AS', serial: 'DH-BH24031-0045', customer: 'City Shopping Mall', purchaseDate: '2024-06-01', period: '18 months', expiry: '2025-12-01', daysLeft: 275 },
  { id: '3', product: 'Hikvision DS-7608NI-Q2/8P', serial: 'HK-NVR-7608-0089', customer: 'BD Bank Motijheel', purchaseDate: '2023-07-10', period: '24 months', expiry: '2025-07-10', daysLeft: 142 },
  { id: '4', product: 'Dahua XVR5108HS-I3', serial: 'DH-XVR5108-0123', customer: 'Green Tower Residency', purchaseDate: '2024-01-20', period: '12 months', expiry: '2025-01-20', daysLeft: 5 },
  { id: '5', product: 'Hikvision DS-2CE5AD0T-IRP', serial: 'HK-BULLET-CE5A-0567', customer: 'Metro Hospital', purchaseDate: '2024-05-05', period: '24 months', expiry: '2026-05-05', daysLeft: 461 },
  { id: '6', product: 'Hikvision DS-2DE4A425IW', serial: 'HK-PTZ-4A425-0003', customer: 'Pacific Telecom', purchaseDate: '2024-02-14', period: '36 months', expiry: '2027-02-14', daysLeft: 756 },
  { id: '7', product: 'Dahua DH-IPC-HFW2831E', serial: 'DH-BULLET-2831-0091', customer: 'Sunrise School', purchaseDate: '2024-04-01', period: '12 months', expiry: '2025-04-01', daysLeft: 76 },
  { id: '8', product: 'TP-Link TL-SG1008P', serial: 'TP-SG1008P-0442', customer: 'Bashundhara City', purchaseDate: '2023-08-15', period: '24 months', expiry: '2025-08-15', daysLeft: 178 },
];

function urgencyColor(days: number) {
  if (days > 90) return 'text-emerald-600 bg-emerald-50';
  if (days > 30) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function urgencyLabel(days: number) {
  if (days > 90) return 'Active';
  if (days > 30) return 'Expiring Soon';
  return 'Expiring';
}

export function CCTVWarrantiesList() {
  const { goBack } = useCCTVNavStore();
  const [search, setSearch] = useState('');

  const filtered = mockWarranties.filter(
    (w) =>
      !search ||
      w.product.toLowerCase().includes(search.toLowerCase()) ||
      w.serial.toLowerCase().includes(search.toLowerCase()) ||
      w.customer.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = mockWarranties.filter((w) => w.daysLeft > 90).length;
  const expiringSoon = mockWarranties.filter((w) => w.daysLeft > 0 && w.daysLeft <= 90).length;
  const expiredCount = mockWarranties.filter((w) => w.daysLeft <= 0).length;

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Warranties</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
          <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{activeCount}</p>
          <p className="text-[10px] text-gray-400 font-medium">Active</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{expiringSoon}</p>
          <p className="text-[10px] text-gray-400 font-medium">Expiring Soon</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
          <ShieldAlert className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{expiredCount}</p>
          <p className="text-[10px] text-gray-400 font-medium">Expired</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <input
          type="text"
          placeholder="Search by product, serial, customer..."
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

      {/* Warranty list */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto">
        {filtered.map((w, i) => {
          const uColor = urgencyColor(w.daysLeft);
          const uLabel = urgencyLabel(w.daysLeft);

          return (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{w.product}</p>
                  <p className="text-xs font-mono text-gray-500 mt-0.5">{w.serial}</p>
                </div>
                <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap', uColor)}>
                  {uLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2.5 pt-2.5 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-400">Customer</p>
                  <p className="text-xs font-medium text-gray-700 truncate">{w.customer}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Warranty Period</p>
                  <p className="text-xs font-medium text-gray-700">{w.period}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Purchase Date</p>
                  <p className="text-xs font-medium text-gray-700">
                    {new Date(w.purchaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Expiry Date</p>
                  <p className="text-xs font-medium text-gray-700">
                    {new Date(w.expiry).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-[11px] text-gray-500">Days remaining</span>
                </div>
                <span className={cn('text-sm font-bold', w.daysLeft > 90 ? 'text-emerald-600' : w.daysLeft > 30 ? 'text-amber-600' : 'text-red-600')}>
                  {w.daysLeft} days
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No warranties found</p>
        </div>
      )}
    </motion.div>
  );
}