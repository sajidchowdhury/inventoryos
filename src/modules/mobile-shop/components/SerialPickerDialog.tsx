'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Check,
  Hash,
  Cpu,
  Loader2,
  Shield,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

// ── Types ──

interface SerialItem {
  id: string;
  serialNumber: string;
  imei?: string | null;
  grade?: string | null;
  costPrice?: number | null;
  sellPrice?: number | null;
  purchaseDate?: string | null;
  warrantyMonths: number;
  purchaseId?: string | null;
  supplierId?: string | null;
  currentLocation?: string | null;
  notes?: string | null;
}

export interface SerialPickerDialogProps {
  open: boolean;
  productId: string;
  productName: string;
  productBrand: string;
  onClose: () => void;
  onSelect: (serialItem: SerialItem) => void;
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  B: 'bg-blue-50 text-blue-600 border-blue-200',
  C: 'bg-amber-50 text-amber-600 border-amber-200',
  D: 'bg-red-50 text-red-600 border-red-200',
};

// ── Component ──

export function SerialPickerDialog({
  open,
  productId,
  productName,
  productBrand,
  onClose,
  onSelect,
}: SerialPickerDialogProps) {
  const businessId = useMSBusinessId();

  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const prevOpenRef = useRef(false);

  // ── Debounce search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch serials when dialog opens or search changes ──
  useEffect(() => {
    if (!open || !productId) return;

    // Reset search on open (via ref comparison to avoid setState in effect)
    if (!prevOpenRef.current && open) {
      // Defer to avoid synchronous setState in effect
      queueMicrotask(() => { setSearch(''); setDebouncedSearch(''); });
    }
    prevOpenRef.current = open;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set('status', 'IN_STOCK');
    params.set('limit', '50');
    if (debouncedSearch) params.set('search', debouncedSearch);

    fetch(`/api/businesses/${businessId}/mobile-shop/products/${productId}/serials?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items || data.serialItems || []);
        setSerials(items);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSerials([]);
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [open, productId, businessId, debouncedSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
        exit={{ y: '100%', opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
        className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">Select Serial Unit</h2>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {productBrand} {productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors ml-3 shrink-0"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-5 pt-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
            <input
              type="text"
              placeholder="Search serial number or IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-10 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              autoFocus
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
        </div>

        {/* ── Serial items list ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3.5 space-y-2.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          ) : serials.length === 0 ? (
            <div className="text-center py-10">
              <Cpu className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">
                {debouncedSearch ? 'No matching serials' : 'No IN_STOCK units available'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {debouncedSearch
                  ? 'Try a different search term'
                  : 'Stock in serial items first'}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {serials.map((serial, i) => (
                <motion.button
                  key={serial.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.03 } }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => onSelect(serial)}
                  className="w-full bg-white rounded-xl border border-gray-100 p-3.5 text-left active:scale-[0.98] transition-transform hover:border-violet-200 shadow-sm"
                >
                  {/* Top row: serial + grade + select icon */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <Hash className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate font-mono">
                        {serial.serialNumber}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {serial.grade && (
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0 rounded border', GRADE_STYLES[serial.grade] || 'bg-gray-50 text-gray-500 border-gray-200')}>
                            Grade {serial.grade}
                          </span>
                        )}
                        {serial.imei && (
                          <span className="text-[10px] text-gray-400">
                            IMEI: {serial.imei}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>

                  {/* Bottom row: metadata */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400">
                    {serial.costPrice != null && (
                      <span>Cost: {formatBDT(serial.costPrice)}</span>
                    )}
                    {serial.purchaseDate && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {daysSince(serial.purchaseDate)}d ago
                      </span>
                    )}
                    {serial.warrantyMonths > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        {serial.warrantyMonths}mo warranty
                      </span>
                    )}
                    {serial.currentLocation && (
                      <span className="truncate">{serial.currentLocation}</span>
                    )}
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}

          {/* Count footer */}
          {!loading && serials.length > 0 && (
            <p className="text-[10px] text-gray-400 text-center pt-2">
              {serials.length} unit{serials.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}