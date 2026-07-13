'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShoppingCart,
  Wallet,
  RotateCcw,
  Loader2,
  Download,
  BookOpen,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ── Types ──

interface LedgerEntry {
  id: string;
  date: string;
  type: 'SALE' | 'PAYMENT' | 'RETURN';
  typeLabel: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
  linkedId?: string;
}

interface LedgerData {
  success: boolean;
  customerName: string;
  customerPhone: string | null;
  totalDebit: number;
  totalCredit: number;
  currentBalance: number;
  entryCount: number;
  entries: LedgerEntry[];
}

interface CCTVCustomerLedgerSheetProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  businessId: string;
}

// ── Config ──

const TYPE_CONFIG: Record<string, {
  icon: typeof Wallet;
  color: string;
  bgColor: string;
  badge: string;
}> = {
  SALE: {
    icon: ShoppingCart,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
  },
  PAYMENT: {
    icon: Wallet,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  RETURN: {
    icon: RotateCcw,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
};

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Component ──

export function CCTVCustomerLedgerSheet({
  open,
  onClose,
  customerId,
  customerName,
  businessId,
}: CCTVCustomerLedgerSheetProps) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch when opened
  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/businesses/${businessId}/mobile-shop/customers/${customerId}/ledger`
        );
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } catch {
        // error
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [open, customerId, businessId]);

  // CSV export
  const handleExport = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const header = 'Date,Type,Description,Debit,Credit,Balance,Reference\n';
      const rows = data.entries.map((e) => {
        const date = new Date(e.date).toLocaleDateString('en-GB');
        const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
        return `${date},${e.typeLabel},${desc},${e.debit > 0 ? e.debit.toFixed(2) : ''},${e.credit > 0 ? e.credit.toFixed(2) : ''},${e.balance.toFixed(2)},${e.reference || ''}`;
      }).join('\n');

      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer_ledger_${customerName.replace(/\s+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // error
    }
    setDownloading(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white rounded-t-3xl shadow-2xl z-[70] flex flex-col"
            style={{ maxHeight: '90vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Customer Ledger</h2>
                <p className="text-xs text-gray-500">{customerName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={downloading || loading || !data || data.entryCount === 0}
                  className="h-8 px-2.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-semibold active:bg-gray-200 transition-all flex items-center gap-1 disabled:opacity-40"
                >
                  {downloading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  CSV
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {/* Loading */}
              {loading ? (
                <div className="space-y-3">
                  <div className="h-20 rounded-2xl bg-gray-50" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : !data || data.entryCount === 0 ? (
                /* Empty */
                <div className="text-center py-16">
                  <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-500">No transactions yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sales, payments, and returns will appear here
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200/60 p-3.5 mb-4"
                  >
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Purchases</p>
                        <p className="text-sm font-bold text-orange-600 mt-0.5">
                          {formatBDT(data.totalDebit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">Paid / Returned</p>
                        <p className="text-sm font-bold text-emerald-600 mt-0.5">
                          {formatBDT(data.totalCredit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-500 uppercase tracking-wider">
                          {data.currentBalance > 0 ? 'Due' : 'Advance'}
                        </p>
                        <p
                          className={`text-sm font-bold mt-0.5 ${
                            data.currentBalance > 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatBDT(Math.abs(data.currentBalance))}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Ledger entries */}
                  <div className="space-y-1.5">
                    {data.entries.map((entry, i) => {
                      const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.SALE;
                      const Icon = cfg.icon;
                      const isDebit = entry.debit > 0;

                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          {/* Icon */}
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bgColor}`}
                          >
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className={`text-[9px] px-1.5 py-0 font-semibold ${cfg.badge}`}
                              >
                                {isDebit ? (
                                  <ArrowDownCircle className="w-2.5 h-2.5 mr-0.5" />
                                ) : (
                                  <ArrowUpCircle className="w-2.5 h-2.5 mr-0.5" />
                                )}
                                {entry.typeLabel}
                              </Badge>
                              <span className="text-[10px] text-gray-400">{fmtDate(entry.date)}</span>
                            </div>
                            <p className="text-[11px] text-gray-600 mt-0.5 truncate">
                              {entry.description}
                            </p>
                            {entry.reference && (
                              <p className="text-[9px] text-gray-400 mt-0.5 truncate">
                                {entry.reference}
                              </p>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="text-right shrink-0">
                            {isDebit ? (
                              <p className="text-xs font-bold text-orange-600">
                                +{formatBDT(entry.debit)}
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-emerald-600">
                                -{formatBDT(entry.credit)}
                              </p>
                            )}
                            <p
                              className={`text-[10px] font-medium mt-0.5 ${
                                entry.balance > 0 ? 'text-red-500' : 'text-emerald-500'
                              }`}
                            >
                              {entry.balance > 0 ? 'Due: ' : 'Adv: '}
                              {formatBDT(Math.abs(entry.balance))}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Footer summary */}
                  <div className="mt-4 bg-gray-50 rounded-2xl p-3.5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[9px] text-gray-400">Entries</p>
                        <p className="text-xs font-bold text-gray-700">{data.entryCount}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400">Total Debit</p>
                        <p className="text-xs font-bold text-orange-600">{formatBDT(data.totalDebit)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400">Total Credit</p>
                        <p className="text-xs font-bold text-emerald-600">{formatBDT(data.totalCredit)}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}