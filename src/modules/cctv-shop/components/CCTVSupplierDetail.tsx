'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Coins,
  AlertTriangle,
  Clock,
  CreditCard,
  Trash2,
  Edit3,
  Loader2,
  Check,
  CalendarDays,
  Hash,
  StickyNote,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CCTVCreateSupplierDialog } from './CCTVCreateSupplierDialog';

// ── Constants ──

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Types ──

interface SupplierData {
  id: string;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance: number;
  totalPurchased: number;
  totalPaid: number;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  purchases?: PurchaseRecord[];
  _count?: { purchases: number; batches: number };
}

interface PurchaseRecord {
  id: string;
  purchaseNo: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  _count?: { items: number };
}

interface BalanceData {
  supplier: { id: string; name: string; code?: string | null; phone?: string | null; contactPerson?: string | null };
  summary: {
    totalDue: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingCount: number;
    oldestDueDays: number;
  };
  aging: {
    current: { count: number; amount: number };
    '31-60': { count: number; amount: number };
    '61-90': { count: number; amount: number };
    '90+': { count: number; amount: number };
  };
  outstandingPurchases: Array<{
    id: string;
    purchaseNo: string;
    invoiceNo?: string | null;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    createdAt: string;
    ageDays: number;
    bucket: string;
  }>;
  purchaseHistory: PurchaseRecord[];
}

type DetailTab = 'purchases' | 'payments' | 'info';

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-red-100 text-red-700',
};

const AGING_COLORS: Record<string, string> = {
  current: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  '31-60': 'bg-amber-50 border-amber-200 text-amber-700',
  '61-90': 'bg-orange-50 border-orange-200 text-orange-700',
  '90+': 'bg-red-50 border-red-200 text-red-700',
};

const AGING_LABELS: Record<string, string> = {
  current: '0-30 days',
  '31-60': '31-60 days',
  '61-90': '61-90 days',
  '90+': '90+ days',
};

// ── Component ──

export function CCTVSupplierDetail() {
  const { goBack, contextId } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('purchases');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ── Fetch supplier detail ──
  const fetchSupplier = useCallback(async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${contextId}`);
      if (res.ok) {
        const data = await res.json();
        setSupplier(data.supplier);
      }
    } catch {
      // handle error
    }
  }, [businessId, contextId]);

  // ── Fetch balance ──
  const fetchBalance = useCallback(async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${contextId}/balance`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data);
      }
    } catch {
      // handle error
    }
  }, [businessId, contextId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSupplier(), fetchBalance()]).finally(() => setLoading(false));
  }, [fetchSupplier, fetchBalance]);

  const refreshAll = useCallback(() => {
    fetchSupplier();
    fetchBalance();
  }, [fetchSupplier, fetchBalance]);

  // ── Handle payment ──
  const handlePayment = async () => {
    if (!contextId || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid amount');
      return;
    }

    setPaying(true);
    setPayError('');
    setPaySuccess('');

    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${contextId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: 'cash' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPayError(data.error || 'Payment failed');
        return;
      }

      setPaySuccess(data.message || `Payment of ${formatBDT(amount)} recorded`);
      setPayAmount('');
      refreshAll();
    } catch {
      setPayError('Network error. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  // ── Handle delete ──
  const handleDelete = async () => {
    if (!contextId || !confirm('Delete this supplier? Purchase history will be preserved.')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${contextId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        goBack();
        return;
      }
    } catch {
      // handle error
    }
    setDeleting(false);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <motion.div {...fadeUp} className="space-y-4 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!supplier) {
    return (
      <motion.div {...fadeUp} className="text-center py-20">
        <p className="text-sm text-gray-500">Supplier not found</p>
        <button onClick={goBack} className="mt-3 text-violet-600 text-sm font-medium">
          Go Back
        </button>
      </motion.div>
    );
  }

  const summary = balance?.summary;

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
        <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">Supplier</h1>
        <button
          onClick={() => setEditDialogOpen(true)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
          title="Edit"
        >
          <Edit3 className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-9 h-9 rounded-xl bg-white border border-red-100 flex items-center justify-center active:bg-red-50 transition-colors shadow-sm"
          title="Delete"
        >
          {deleting ? <Loader2 className="w-4 h-4 text-red-400 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-400" />}
        </button>
      </div>

      {/* ── Supplier info card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white text-lg font-bold">
              {supplier.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{supplier.name}</p>
            {supplier.code && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Hash className="w-3 h-3" /> {supplier.code}
              </p>
            )}
          </div>
        </div>

        {/* Contact details */}
        <div className="mt-3 pt-3 border-t border-gray-50 space-y-2">
          {supplier.contactPerson && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span>{supplier.contactPerson}</span>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate">{supplier.email}</span>
            </div>
          )}
          {supplier.address && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span className="line-clamp-2">{supplier.address}</span>
            </div>
          )}
          {supplier.notes && (
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <StickyNote className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{supplier.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Balance summary card ── */}
      {summary && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Financial Summary
          </h3>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Total Invoiced</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatBDT(summary.totalInvoiced)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Total Paid</p>
              <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatBDT(summary.totalPaid)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400">Outstanding</p>
              <p className={`text-sm font-bold mt-0.5 ${summary.totalDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatBDT(summary.totalDue)}
              </p>
            </div>
          </div>

          {/* Aging buckets */}
          {summary.totalDue > 0 && (
            <>
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Aging Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(AGING_LABELS) as Array<keyof typeof AGING_LABELS>).map((key) => {
                  const bucket = balance.aging[key];
                  if (!bucket || bucket.count === 0) return null;
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border p-2.5 ${AGING_COLORS[key]}`}
                    >
                      <p className="text-[10px] font-semibold">{AGING_LABELS[key]}</p>
                      <p className="text-sm font-bold mt-0.5">{formatBDT(bucket.amount)}</p>
                      <p className="text-[10px] opacity-70">{bucket.count} invoice{bucket.count > 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Quick payment */}
          {summary.totalDue > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Record Payment (FIFO)
              </h4>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => { setPayAmount(e.target.value); setPayError(''); setPaySuccess(''); }}
                    placeholder="0"
                    className="w-full h-10 pl-7 pr-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                  />
                </div>
                <button
                  onClick={handlePayment}
                  disabled={paying || !payAmount}
                  className="h-10 px-4 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-semibold shadow-sm active:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Pay
                </button>
              </div>
              {payError && (
                <p className="text-[11px] text-red-500 mt-1.5">{payError}</p>
              )}
              {paySuccess && (
                <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {paySuccess}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-2 bg-gray-50 rounded-xl p-1">
        {([
          { key: 'purchases' as DetailTab, label: 'Purchases' },
          { key: 'payments' as DetailTab, label: 'Outstanding' },
          { key: 'info' as DetailTab, label: 'Info' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'purchases' && (
        <div className="space-y-2">
          {balance?.purchaseHistory.length === 0 && !supplier.purchases?.length ? (
            <div className="text-center py-8">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No purchases yet</p>
            </div>
          ) : (
            (balance?.purchaseHistory || supplier.purchases || []).map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{p.purchaseNo}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-2.5 h-2.5" />
                      {formatDate(p.createdAt)}
                      {p._count?.items && ` · ${p._count.items} items`}
                    </p>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 rounded-full border-0 font-semibold leading-4 ${PAYMENT_STATUS_COLORS[p.paymentStatus] || 'bg-gray-100 text-gray-600'}`}>
                    {p.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-500">
                    Total: <span className="font-semibold text-gray-900">{formatBDT(p.totalAmount)}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    Paid: <span className="font-semibold text-emerald-600">{formatBDT(p.paidAmount)}</span>
                  </span>
                  {p.totalAmount - p.paidAmount > 0 && (
                    <span className="text-xs">
                      Due: <span className="font-semibold text-amber-600">{formatBDT(p.totalAmount - p.paidAmount)}</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-2">
          {(!balance?.outstandingPurchases || balance.outstandingPurchases.length === 0) ? (
            <div className="text-center py-8">
              <Coins className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {summary && summary.totalDue === 0
                  ? 'All paid up! 🎉'
                  : 'No outstanding purchases'}
              </p>
            </div>
          ) : (
            balance.outstandingPurchases.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{p.purchaseNo}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {p.ageDays} days old · {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 rounded-full border-0 font-semibold leading-4 ${AGING_COLORS[p.bucket] || 'bg-gray-100 text-gray-600'}`}>
                    {AGING_LABELS[p.bucket]}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-500">
                    Invoiced: <span className="font-semibold text-gray-900">{formatBDT(p.totalAmount)}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    Paid: <span className="font-semibold text-emerald-600">{formatBDT(p.paidAmount)}</span>
                  </span>
                  <span className="text-xs">
                    Due: <span className="font-semibold text-amber-600">{formatBDT(p.dueAmount)}</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'info' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Supplier ID</span>
            <span className="text-gray-600 font-mono text-[10px]">{supplier.id}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Code</span>
            <span className="text-gray-700 font-semibold">{supplier.code || '—'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Purchased</span>
            <span className="text-gray-700 font-semibold">{formatBDT(supplier.totalPurchased)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Paid</span>
            <span className="text-emerald-600 font-semibold">{formatBDT(supplier.totalPaid)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Current Balance</span>
            <span className={`font-semibold ${supplier.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatBDT(supplier.balance)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Purchases</span>
            <span className="text-gray-700 font-semibold">{supplier._count?.purchases || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Batches</span>
            <span className="text-gray-700 font-semibold">{supplier._count?.batches || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Created</span>
            <span className="text-gray-600">{formatDate(supplier.createdAt)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Status</span>
            <Badge className="text-[10px] px-1.5 py-0 rounded-full border-0 font-semibold leading-4 bg-emerald-100 text-emerald-700">
              Active
            </Badge>
          </div>
        </div>
      )}

      {/* ── Edit Dialog ── */}
      <CCTVCreateSupplierDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSaved={refreshAll}
        editData={supplier}
      />
    </motion.div>
  );
}