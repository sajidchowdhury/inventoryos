'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Shield, ShieldCheck, ShieldAlert, ShieldX,
  Wrench, Search, Plus, ChevronRight, Clock, Phone, User, Package,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface WarrantySerial {
  id: string;
  serialNumber: string;
  status: string;
  sellPrice: number | null;
  saleDate: string | null;
  warrantyEnd: string | null;
  warrantyMonths: number | null;
  customerName: string | null;
  product: {
    id: string;
    name: string;
    brand: string;
    model: string | null;
  };
}

interface Repair {
  id: string;
  tokenNo: string | null;
  serialNumber: string;
  productName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  issue: string;
  status: string;
  underWarranty: boolean;
  warrantyExpiryDate: string | null;
  receivedDate: string;
  readyDate: string | null;
}

interface WarrantyData {
  success: boolean;
  stats: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    repairsInProgress: number;
    warrantyRepairsInProgress: number;
  };
  serials: WarrantySerial[];
  repairs: Repair[];
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const REPAIR_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  received: { label: 'Received', color: 'text-amber-700', bg: 'bg-amber-50' },
  in_repair: { label: 'In Repair', color: 'text-blue-700', bg: 'bg-blue-50' },
  ready: { label: 'Ready', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  sent_to_supplier: { label: 'Sent to Supplier', color: 'text-orange-700', bg: 'bg-orange-50' },
  replaced: { label: 'Replaced', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  returned: { label: 'Returned', color: 'text-violet-700', bg: 'bg-violet-50' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function CCTVWarrantyDashboard() {
  const { goBack, navigate } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');

  const [data, setData] = useState<WarrantyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    Promise.resolve().then(() => setLoading(true));
    fetch(`/api/businesses/${businessId}/cctv/warranties?filter=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [businessId, filter]);

  const filteredSerials = (data?.serials || []).filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.serialNumber.toLowerCase().includes(q) ||
           s.product.name.toLowerCase().includes(q) ||
           s.product.brand.toLowerCase().includes(q) ||
           (s.customerName || '').toLowerCase().includes(q);
  });

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Warranty Dashboard</h1>
        <button
          onClick={() => navigate('repairs')}
          className="ml-auto h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> New Repair
        </button>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium">Active</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-emerald-600">{data.stats.active}</p>
            <p className="text-[10px] text-gray-400 mt-1">Under warranty now</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium">Expiring Soon</span>
              <ShieldAlert className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-amber-600">{data.stats.expiring}</p>
            <p className="text-[10px] text-gray-400 mt-1">Within 30 days</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium">Expired</span>
              <ShieldX className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600">{data.stats.expired}</p>
            <p className="text-[10px] text-gray-400 mt-1">Out of warranty</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-500 font-medium">Repairs In Progress</span>
              <Wrench className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-xl font-bold text-violet-600">{data.stats.repairsInProgress}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {data.stats.warrantyRepairsInProgress} under warranty
            </p>
          </div>
        </div>
      )}

      {/* Active Repairs (under warranty highlighted) */}
      {data && data.repairs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-violet-500" />
              Active Repairs ({data.repairs.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.repairs.map((r) => {
              const status = REPAIR_STATUS_STYLES[r.status] || REPAIR_STATUS_STYLES.received;
              return (
                <button
                  key={r.id}
                  onClick={() => navigate('repairs', r.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-violet-50/30 transition-colors text-left"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    r.underWarranty ? 'bg-emerald-50' : 'bg-gray-100'
                  )}>
                    <Shield className={cn('w-5 h-5', r.underWarranty ? 'text-emerald-500' : 'text-gray-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-semibold text-gray-900">{r.tokenNo}</p>
                      {r.underWarranty && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">
                          WARRANTY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{r.productName} · {r.serialNumber}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{r.issue}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', status.bg, status.color)}>
                      {status.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(r.receivedDate)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Warranty items — search + filter */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-500" />
          Warranty Tracked Items
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search serial, product, customer..." className="h-10 rounded-xl pl-10 text-sm" />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all' as const, label: 'All', count: data?.stats.total || 0 },
            { key: 'active' as const, label: 'Active', count: data?.stats.active || 0 },
            { key: 'expiring' as const, label: 'Expiring', count: data?.stats.expiring || 0 },
            { key: 'expired' as const, label: 'Expired', count: data?.stats.expired || 0 },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
                filter === f.key ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[9px]',
                filter === f.key ? 'bg-white/20' : 'bg-white'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Serial list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : filteredSerials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No warranty items found</p>
          <p className="text-xs text-gray-400 mt-1">
            Sell serial-tracked products with warranty to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSerials.map((s) => {
            const days = daysUntil(s.warrantyEnd);
            const isExpired = days !== null && days < 0;
            const isExpiring = days !== null && days >= 0 && days <= 30;
            const isActive = days !== null && days > 30;
            const isUnderRepair = s.status === 'IN_REPAIR' || s.status === 'SENT_TO_SUPPLIER';

            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-gray-900 break-all">{s.serialNumber}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{s.product.name}</p>
                    <p className="text-[10px] text-gray-400">{s.product.brand}{s.product.model ? ` · ${s.product.model}` : ''}</p>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.customerName && (
                        <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {s.customerName}
                        </span>
                      )}
                      {s.saleDate && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px]">
                          Sold: {formatDate(s.saleDate)}
                        </span>
                      )}
                      {s.warrantyMonths && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                          {s.warrantyMonths}m warranty
                        </span>
                      )}
                      {isUnderRepair && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-semibold">
                          IN REPAIR
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warranty status badge */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {isExpired ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-red-700 flex items-center gap-1">
                        <ShieldX className="w-3 h-3" /> Expired
                      </span>
                    ) : isExpiring ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-700 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> {days}d left
                      </span>
                    ) : isActive ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> {days}d left
                      </span>
                    ) : null}
                    <span className="text-[10px] text-gray-400">until {formatDate(s.warrantyEnd)}</span>
                  </div>
                </div>

                {/* Action button: Receive for Repair */}
                <button
                  onClick={() => navigate('repairs')}
                  className={cn(
                    'mt-3 w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-transform active:scale-95',
                    isExpired
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                  )}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {isExpired ? 'Receive for Repair (Paid)' : 'Receive for Warranty Repair (Free)'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
