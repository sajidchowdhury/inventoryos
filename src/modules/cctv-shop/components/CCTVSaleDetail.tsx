'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, User, Package, CreditCard, Receipt,
  Trash2, Loader2, CheckCircle2, Clock, Banknote, Plus,
  X, Hash, FileText, RotateCcw,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { CCTVSale, PaymentMethod, SaleStatus } from '@/modules/cctv-shop/types';
import { CCTVReturnDialog } from './CCTVReturnDialog';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const SALE_STATUS_CONFIG: Record<SaleStatus, { label: string; badge: string; bg: string; icon: React.ReactNode }> = {
  PAID: {
    label: 'Paid',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-100" />,
  },
  PARTIALLY_PAID: {
    label: 'Partially Paid',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    icon: <Clock className="w-5 h-5 text-amber-100" />,
  },
  PENDING: {
    label: 'Pending',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    bg: 'bg-gradient-to-r from-slate-500 to-slate-600',
    icon: <Clock className="w-5 h-5 text-slate-200" />,
  },
};

const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { label: string; badge: string; icon: React.ReactNode }> = {
  CASH: {
    label: 'Cash',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <Banknote className="w-3.5 h-3.5" />,
  },
  CARD: {
    label: 'Card',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
  BKASH: {
    label: 'bKash',
    badge: 'bg-pink-50 text-pink-700 border-pink-200',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
  NAGAD: {
    label: 'Nagad',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
  ROCKET: {
    label: 'Rocket',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
};

const METHOD_SELECTOR_STYLES: Record<PaymentMethod, { active: string; inactive: string; icon: React.ReactNode }> = {
  CASH: {
    active: 'bg-emerald-100 border-emerald-400 text-emerald-700',
    inactive: 'border-gray-200 text-gray-500',
    icon: <Banknote className="w-5 h-5" />,
  },
  CARD: {
    active: 'bg-blue-100 border-blue-400 text-blue-700',
    inactive: 'border-gray-200 text-gray-500',
    icon: <CreditCard className="w-5 h-5" />,
  },
  BKASH: {
    active: 'bg-pink-100 border-pink-400 text-pink-700',
    inactive: 'border-gray-200 text-gray-500',
    icon: <span className="text-sm font-bold">b</span>,
  },
  NAGAD: {
    active: 'bg-orange-100 border-orange-400 text-orange-700',
    inactive: 'border-gray-200 text-gray-500',
    icon: <span className="text-sm font-bold">N</span>,
  },
  ROCKET: {
    active: 'bg-purple-100 border-purple-400 text-purple-700',
    inactive: 'border-gray-200 text-gray-500',
    icon: <span className="text-sm font-bold">R</span>,
  },
};

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return null;
  return '\u09F3' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export function CCTVSaleDetail() {
  const { contextId, goBack, navigate } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const { toast } = useToast();

  const [sale, setSale] = useState<CCTVSale | null>(null);
  const [loading, setLoading] = useState(true);

  // Add payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Cancel sale dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Return items dialog
  const [showReturnDialog, setShowReturnDialog] = useState(false);

  // Generate Mushak dialog
  const [showMushakDialog, setShowMushakDialog] = useState(false);
  const [mushakBuyerName, setMushakBuyerName] = useState('');
  const [mushakBuyerBin, setMushakBuyerBin] = useState('');
  const [mushakBuyerAddress, setMushakBuyerAddress] = useState('');
  const [mushakLoading, setMushakLoading] = useState(false);

  const fetchSale = async () => {
    if (!contextId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/sales/${contextId}`);
      if (res.ok) {
        const data = await res.json();
        setSale(data.sale || data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!contextId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/businesses/${businessId}/cctv/sales/${contextId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSale(data.sale || data);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contextId]);

  // ── Payment submission ──
  const handleAddPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }
    if (payMethod !== 'CASH' && !payReference.trim()) {
      toast({ title: 'Reference required', description: `Please enter a reference number for ${PAYMENT_METHOD_CONFIG[payMethod].label}.`, variant: 'destructive' });
      return;
    }

    setPayLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/sales/${contextId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: payMethod,
          amount,
          referenceNumber: payMethod !== 'CASH' ? payReference.trim() : undefined,
        }),
      });
      if (res.ok) {
        toast({ title: 'Payment added', description: `${formatBDT(amount)} received via ${PAYMENT_METHOD_CONFIG[payMethod].label}.` });
        setShowPaymentDialog(false);
        setPayAmount('');
        setPayReference('');
        setPayMethod('CASH');
        await fetchSale();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Payment failed', description: err.error || 'Could not add payment.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Payment failed', description: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setPayLoading(false);
    }
  };
  // ── Generate Mushak 6.3 ──
  const handleGenerateMushak = async () => {
    if (!contextId || !sale) return;
    setMushakLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/mushak-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: contextId,
          buyerName: mushakBuyerName || sale.customerName,
          buyerBin: mushakBuyerBin || undefined,
          buyerAddress: mushakBuyerAddress || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Mushak 6.3 Generated', description: json.data.invoiceNumber });
        setShowMushakDialog(false);
        navigate('mushak-invoice-detail', json.data.id);
      } else {
        toast({ title: 'Failed', description: json.error || 'Could not generate invoice', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally {
      setMushakLoading(false);
    }
  };

  // ── Cancel sale ──
  const handleCancelSale = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/sales/${contextId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Sale cancelled', description: 'The sale has been cancelled and items returned.' });
        goBack();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'Cancel failed', description: err.error || 'Could not cancel sale.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Cancel failed', description: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setCancelLoading(false);
    }
  };

  // ── Computed values ──
  const totalPaid = (sale?.payments || []).reduce((s, p) => s + p.amount, 0);
  const balance = sale ? sale.totalDue - totalPaid : 0;
  const isPending = sale?.status === 'PENDING';
  const isPartiallyPaid = sale?.status === 'PARTIALLY_PAID';
  const canCancel = isPending && (!sale?.payments || sale.payments.length === 0);

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-6">
        {/* Header skeleton */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="p-4 space-y-4">
          {/* Status card skeleton */}
          <Skeleton className="h-36 w-full rounded-2xl" />
          {/* Customer card */}
          <Skeleton className="h-20 w-full rounded-2xl" />
          {/* Items card */}
          <Skeleton className="h-56 w-full rounded-2xl" />
          {/* Payments card */}
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Sale Details</h1>
        </header>
        <div className="p-4 text-center text-gray-500 py-20">
          <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Sale not found</p>
        </div>
      </div>
    );
  }

  const statusCfg = SALE_STATUS_CONFIG[sale.status];

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={goBack}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Sale Details</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* ── Status Card ── */}
        <motion.div
          {...fadeUp}
          className={cn('rounded-2xl p-5 text-white', statusCfg.bg)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {statusCfg.icon}
              <span className="text-white/80 text-sm font-medium">Sale Receipt</span>
            </div>
            <Badge className={cn('text-sm px-3 py-1 border', statusCfg.badge)}>
              {statusCfg.label}
            </Badge>
          </div>
          <p className="text-2xl font-bold tracking-tight mb-3">{sale.saleCode}</p>
          <div className="flex items-center gap-2 text-white/80 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDate(sale.createdAt)}</span>
          </div>
          {sale.status === 'PAID' && sale.completedAt && (
            <div className="mt-2 flex items-center gap-2 text-white/90 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Paid at {formatDate(sale.completedAt)}</span>
            </div>
          )}
          {sale.status === 'PARTIALLY_PAID' && (
            <div className="mt-3 bg-black/15 rounded-xl px-3 py-2 inline-flex items-center gap-2">
              <span className="text-white/90 text-sm">Remaining:</span>
              <span className="text-white font-bold text-lg">
                {formatBDT(balance)}
              </span>
            </div>
          )}
        </motion.div>

        {/* ── Customer Card ── */}
        <motion.div {...fadeUp} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {sale.customerName || 'Walk-in Customer'}
              </p>
              {sale.customerPhone ? (
                <a
                  href={`tel:${sale.customerPhone}`}
                  className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1 mt-0.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {sale.customerPhone}
                </a>
              ) : (
                <p className="text-sm text-gray-400 mt-0.5">Walk-in Customer</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Items Card (Receipt-style) ── */}
        <motion.div {...fadeUp} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">
              Items ({sale.items?.length || 0})
            </h3>
          </div>

          <div className="space-y-0">
            {sale.items && sale.items.length > 0 ? (
              sale.items.map((item, idx) => (
                <div key={item.id}>
                  <div className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm leading-snug">
                          {item.productName}
                          {(item as Record<string, unknown>).kit && (
                            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200 align-middle">
                              Kit
                            </span>
                          )}
                        </p>
                        {item.productBrand && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.productBrand}</p>
                        )}
                        {item.serialItem && (
                          <div className="flex items-center gap-1 mt-1">
                            <Hash className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-violet-600 font-mono">
                              {item.serialItem.serialNumber}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          {formatBDT(item.totalPrice)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.quantity} × {formatBDT(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {idx < sale.items!.length - 1 && (
                    <div className="border-t border-gray-100" />
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 py-3 text-center">No items</p>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 mt-1 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700 font-medium">{formatBDT(sale.subtotal)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-red-500 font-medium">-{formatBDT(sale.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-dashed border-gray-200">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">{formatBDT(sale.totalDue)}</span>
            </div>
          </div>
        </motion.div>

        {/* ── Payments Card ── */}
        <motion.div {...fadeUp} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">
              Payments ({sale.payments?.length || 0})
            </h3>
          </div>

          {sale.payments && sale.payments.length > 0 ? (
            <>
              <div className="space-y-0">
                {sale.payments.map((payment, idx) => {
                  const mCfg = PAYMENT_METHOD_CONFIG[payment.method];
                  return (
                    <div key={payment.id}>
                      <div className="py-3 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <Badge variant="outline" className={cn('text-xs px-2 py-0.5 border flex-shrink-0', mCfg.badge)}>
                            <span className="flex items-center gap-1">
                              {mCfg.icon}
                              {mCfg.label}
                            </span>
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">
                              {formatBDT(payment.amount)}
                            </p>
                            {payment.referenceNumber && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                Ref: {payment.referenceNumber}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                      {idx < sale.payments!.length - 1 && (
                        <div className="border-t border-gray-100" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Payment summary */}
              <div className="border-t border-gray-200 mt-1 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Paid</span>
                  <span className="text-emerald-600 font-semibold">{formatBDT(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Balance</span>
                  <span className={cn('font-bold', balance > 0 ? 'text-red-600' : 'text-gray-900')}>
                    {formatBDT(balance)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-3 text-center">No payments yet</p>
          )}
        </motion.div>

        {/* ── Add Payment Button (PARTIALLY_PAID) ── */}
        {isPartiallyPaid && (
          <motion.div {...fadeUp}>
            <button
              onClick={() => setShowPaymentDialog(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold
                         flex items-center justify-center gap-2 hover:from-violet-700 hover:to-purple-700
                         active:scale-[0.98] transition-all shadow-lg shadow-violet-200"
            >
              <Plus className="w-5 h-5" />
              Add Payment
            </button>
          </motion.div>
        )}

        {/* ── Return Items Button (for paid/partially paid sales) ── */}
        {(sale.status === 'PAID' || sale.status === 'PARTIALLY_PAID') && sale.items && sale.items.length > 0 && (
          <motion.div {...fadeUp}>
            <button
              onClick={() => setShowReturnDialog(true)}
              className="w-full py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold
                         flex items-center justify-center gap-2 hover:bg-amber-100 active:scale-[0.98] transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Return Items
            </button>
          </motion.div>
        )}

        {/* ── Cancel Sale Button (PENDING, no payments) ── */}
        {canCancel && (
          <motion.div {...fadeUp}>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="w-full py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-semibold
                         flex items-center justify-center gap-2 hover:bg-red-100 active:scale-[0.98] transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Cancel Sale
            </button>
          </motion.div>
        )}

        {/* ── Generate Mushak 6.3 Button ── */}
        {sale && sale.status === 'PAID' && (
          <motion.div {...fadeUp}>
            <button
              onClick={() => { setMushakBuyerName(sale.customerName); setShowMushakDialog(true); }}
              className="w-full py-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold
                         flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 active:scale-[0.98] transition-all"
            >
              <FileText className="w-4 h-4" />
              Generate Mushak 6.3
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Return Items Dialog ── */}
      {sale && (
        <CCTVReturnDialog
          sale={sale}
          open={showReturnDialog}
          onClose={() => setShowReturnDialog(false)}
          onReturnSuccess={fetchSale}
        />
      )}

      {/* ── Add Payment Dialog ── */}
      <AlertDialog open={showPaymentDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPaymentDialog(false);
          setPayAmount('');
          setPayReference('');
          setPayMethod('CASH');
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-600" />
              Add Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remaining balance: <span className="font-bold text-gray-900">{formatBDT(balance)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 mt-2">
            {/* Method selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Payment Method</p>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(PAYMENT_METHOD_CONFIG) as PaymentMethod[]).map((method) => {
                  const ms = METHOD_SELECTOR_STYLES[method];
                  const isActive = payMethod === method;
                  return (
                    <button
                      key={method}
                      onClick={() => {
                        setPayMethod(method);
                        if (method === 'CASH') setPayReference('');
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center',
                        isActive ? ms.active : ms.inactive,
                        isActive && 'shadow-sm'
                      )}
                    >
                      {ms.icon}
                      <span className="text-[10px] font-semibold leading-tight">
                        {PAYMENT_METHOD_CONFIG[method].label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Amount (৳)</label>
              <Input
                type="number"
                placeholder={String(balance)}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                min={1}
                step={1}
                className="text-lg font-semibold"
              />
            </div>

            {/* Reference (non-CASH) */}
            {payMethod !== 'CASH' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Reference / Txn ID
                </label>
                <Input
                  type="text"
                  placeholder="Enter transaction reference"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                />
              </div>
            )}
          </div>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              onClick={handleAddPayment}
              disabled={payLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold
                         flex items-center gap-2 hover:from-violet-700 hover:to-purple-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {payLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Payment
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Cancel Sale Confirmation ── */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Cancel Sale
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel sale <span className="font-semibold text-gray-900">{sale.saleCode}</span>?
              This will return all items to stock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Keep Sale</AlertDialogCancel>
            <button
              onClick={handleCancelSale}
              disabled={cancelLoading}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold
                         flex items-center gap-2 hover:bg-red-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {cancelLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, Cancel Sale
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Generate Mushak 6.3 Dialog ── */}
      <AlertDialog open={showMushakDialog} onOpenChange={(open) => {
        if (!open) setShowMushakDialog(false);
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-600" />
              Generate Mushak 6.3
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enter buyer details for the tax invoice. Buyer BIN is required for B2B transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Buyer Name</label>
              <Input value={mushakBuyerName} onChange={(e) => setMushakBuyerName(e.target.value)} placeholder="Customer or business name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Buyer BIN</label>
              <Input value={mushakBuyerBin} onChange={(e) => setMushakBuyerBin(e.target.value)} placeholder="Business Identification Number" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Buyer Address</label>
              <Input value={mushakBuyerAddress} onChange={(e) => setMushakBuyerAddress(e.target.value)} placeholder="Business address" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mushakLoading}>Cancel</AlertDialogCancel>
            <button
              onClick={handleGenerateMushak}
              disabled={mushakLoading || !mushakBuyerName.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold
                         flex items-center gap-2 shadow-lg shadow-violet-500/20
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {mushakLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Invoice
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}