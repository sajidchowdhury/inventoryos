'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, Loader2, Package, ShoppingCart, Wrench,
  Send, RefreshCw, ArrowRightLeft, FileText, Phone, User,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SerialHistoryEntry {
  id: string;
  eventType: string;
  description: string | null;
  eventDate: string;
  notes: string | null;
  referenceId: string | null;
  referenceType: string | null;
}

interface SerialResult {
  id: string;
  serialNumber: string;
  status: string;
  costPrice: number;
  sellPrice: number | null;
  purchaseDate: string | null;
  saleDate: string | null;
  warrantyEnd: string | null;
  customerName: string | null;
  replacesSerialId: string | null;
  product: {
    id: string;
    name: string;
    brand: string;
    model: string | null;
    warrantyMonths: number;
  };
  history: SerialHistoryEntry[];
  replacement: {
    id: string;
    newSerialNumber: string | null;
    status: string;
    sentDate: string;
    receivedDate: string | null;
  } | null;
  isReplacementFor: {
    id: string;
    serialNumber: string;
    status: string;
  } | null;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  IN_STOCK: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'In Stock' },
  SOLD: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Sold' },
  RETURNED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Returned' },
  IN_REPAIR: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Repair' },
  SENT_TO_SUPPLIER: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Sent to Supplier' },
  REPLACED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Replaced' },
  RETURNED_TO_CUSTOMER: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Returned to Customer' },
};

const EVENT_ICONS: Record<string, typeof Package> = {
  PURCHASED: ShoppingCart,
  SOLD: Package,
  REPAIR_RECEIVED: Wrench,
  REPAIR_DONE: Wrench,
  RETURNED_TO_CUSTOMER: RefreshCw,
  SENT_TO_SUPPLIER: Send,
  REPLACEMENT_RECEIVED: ArrowRightLeft,
  REPLACED: ArrowRightLeft,
  NOTE: FileText,
};

const EVENT_COLORS: Record<string, string> = {
  PURCHASED: 'bg-blue-500',
  SOLD: 'bg-emerald-500',
  REPAIR_RECEIVED: 'bg-amber-500',
  REPAIR_DONE: 'bg-amber-500',
  RETURNED_TO_CUSTOMER: 'bg-violet-500',
  SENT_TO_SUPPLIER: 'bg-orange-500',
  REPLACEMENT_RECEIVED: 'bg-cyan-500',
  REPLACED: 'bg-red-500',
  NOTE: 'bg-gray-400',
};

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function CCTVSerialSearch() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SerialResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!businessId) return;
    const query = searchQuery.trim();
    if (!query) {
      // Reset state when search is cleared — using a microtask to avoid sync setState in effect
      Promise.resolve().then(() => {
        setResults([]);
        setHasSearched(false);
        setExpandedId(null);
      });
      return;
    }
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/businesses/${businessId}/cctv/serial-history?search=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data.results || []);
          setHasSearched(true);
          setLoading(false);
          // Auto-expand first result
          if ((data.results || []).length > 0) {
            setExpandedId(data.results[0].id);
          }
        })
        .catch(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery, businessId]);

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Serial Search & History</h1>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs text-gray-500 mb-2">
          Type or scan a serial number to see the full timeline: purchase, sale, repairs, replacements.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type serial number (e.g. HKV-2024-00123)..."
            className="h-12 rounded-xl pl-10 text-sm font-mono"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-violet-400" />
          )}
        </div>
        {hasSearched && !loading && (
          <p className="text-xs text-gray-500 mt-2">
            {results.length === 0
              ? `No serials found matching "${searchQuery}"`
              : `${results.length} serial${results.length === 1 ? '' : 's'} found`}
          </p>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((item) => {
            const isExpanded = expandedId === item.id;
            const status = STATUS_STYLES[item.status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: item.status };
            const warrantyActive = item.warrantyEnd && new Date(item.warrantyEnd) > new Date();
            const warrantyExpired = item.warrantyEnd && new Date(item.warrantyEnd) <= new Date();
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Summary row — click to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold text-gray-900 break-all">{item.serialNumber}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{item.product.name}</p>
                      <p className="text-[10px] text-gray-400">{item.product.brand}{item.product.model ? ` · ${item.product.model}` : ''}</p>
                    </div>
                    <span className={cn('shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold', status.bg, status.text)}>
                      {status.label}
                    </span>
                  </div>

                  {/* Quick info row */}
                  <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                    {item.purchaseDate && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                        Bought: {formatDate(item.purchaseDate)}
                      </span>
                    )}
                    {item.saleDate && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                        Sold: {formatDate(item.saleDate)}
                      </span>
                    )}
                    {item.customerName && (
                      <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-600">
                        {item.customerName}
                      </span>
                    )}
                    {warrantyActive && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                        Warranty until {formatDate(item.warrantyEnd)}
                      </span>
                    )}
                    {warrantyExpired && (
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-600">
                        Warranty expired {formatDate(item.warrantyEnd)}
                      </span>
                    )}
                    {item.isReplacementFor && (
                      <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-600">
                        Replaces: {item.isReplacementFor.serialNumber}
                      </span>
                    )}
                    {item.replacement && item.replacement.newSerialNumber && (
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-600">
                        Replaced by: {item.replacement.newSerialNumber}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded timeline */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-gray-100 bg-gray-50/50 p-4"
                  >
                    <h4 className="text-xs font-bold text-gray-700 mb-3">Timeline ({item.history.length} events)</h4>
                    {item.history.length === 0 ? (
                      <p className="text-xs text-gray-400">No history entries</p>
                    ) : (
                      <div className="space-y-3">
                        {item.history.map((entry, idx) => {
                          const Icon = EVENT_ICONS[entry.eventType] || FileText;
                          const color = EVENT_COLORS[entry.eventType] || 'bg-gray-400';
                          return (
                            <div key={entry.id} className="flex gap-3">
                              {/* Timeline line */}
                              <div className="flex flex-col items-center">
                                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', color)}>
                                  <Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                {idx < item.history.length - 1 && (
                                  <div className="w-px flex-1 bg-gray-200 my-1" />
                                )}
                              </div>
                              {/* Event content */}
                              <div className="flex-1 pb-2">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="text-xs font-semibold text-gray-800">
                                    {entry.eventType.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-[10px] text-gray-400 shrink-0">
                                    {formatDateTime(entry.eventDate)}
                                  </p>
                                </div>
                                {entry.description && (
                                  <p className="text-xs text-gray-600 mt-0.5">{entry.description}</p>
                                )}
                                {entry.notes && (
                                  <p className="text-[10px] text-gray-500 mt-1 italic">Note: {entry.notes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Price details */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-200">
                      <div>
                        <p className="text-[9px] text-gray-400">Cost</p>
                        <p className="text-xs font-semibold text-gray-700">{formatBDT(item.costPrice)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400">Sell</p>
                        <p className="text-xs font-semibold text-gray-700">{item.sellPrice ? formatBDT(item.sellPrice) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400">Warranty</p>
                        <p className="text-xs font-semibold text-gray-700">{item.product.warrantyMonths} months</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {hasSearched && results.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No serials found</p>
          <p className="text-xs text-gray-400 mt-1">
            Try a different serial number. Make sure purchases have been recorded with serials.
          </p>
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Search className="w-10 h-10 text-violet-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">Search for any serial number</p>
          <p className="text-xs text-gray-400 mt-1">
            See purchase, sale, repair, and replacement history
          </p>
        </div>
      )}
    </motion.div>
  );
}
