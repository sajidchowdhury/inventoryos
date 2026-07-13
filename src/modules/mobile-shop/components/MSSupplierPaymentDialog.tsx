'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Wallet,
  CreditCard,
  Smartphone,
  Landmark,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  Banknote,
  Tag,
} from 'lucide-react';

// ── Constants ──

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { key: 'bkash', label: 'bKash', icon: Smartphone, color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { key: 'nagad', label: 'Nagad', icon: Smartphone, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { key: 'rocket', label: 'Rocket', icon: Smartphone, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { key: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { key: 'bank', label: 'Bank Transfer', icon: Landmark, color: 'bg-sky-50 text-sky-600 border-sky-200' },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['key'];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000, 50000];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: 16, transition: { duration: 0.2 } },
};

// ── Types ──

interface OutstandingPurchase {
  id: string;
  purchaseNo: string;
  invoiceNo?: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  createdAt: string;
  ageDays: number;
  bucket: string;
  source: 'purchase' | 'cctv';
}

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  outstandingBalance: number;
  outstandingPurchases: OutstandingPurchase[];
  onPaymentSuccess: () => void;
  businessId: string;
}

// ── Helpers ──

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Component ──

export function MSSupplierPaymentDialog({
  open,
  onClose,
  supplierId,
  supplierName,
  outstandingBalance,
  outstandingPurchases,
  onPaymentSuccess,
  businessId,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [allocationMode, setAllocationMode] = useState<'fifo' | 'specific'>('fifo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMethodGrid, setShowMethodGrid] = useState(false);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');

  // Reset state on open
  useEffect(() => {
    if (open) {
      setAmount('');
      setMethod('cash');
      setReference('');
      setSelectedPurchaseId('');
      setAllocationMode('fifo');
      setError('');
      setSuccess('');
      setShowMethodGrid(false);
      setStep('enter');
    }
  }, [open]);

  const parsedAmount = useMemo(() => parseFloat(amount) || 0, [amount]);
  const selectedMethod = PAYMENT_METHODS.find((m) => m.key === method)!;

  // FIFO allocation preview
  const fifoPreview = useMemo(() => {
    if (parsedAmount <= 0) return [];
    let remaining = parsedAmount;
    const purchases = selectedPurchaseId
      ? outstandingPurchases.filter((p) => p.id === selectedPurchaseId)
      : [...outstandingPurchases].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return purchases
      .map((p) => {
        const due = p.dueAmount;
        const apply = Math.min(due, remaining);
        remaining -= apply;
        return { ...p, applyAmount: apply };
      })
      .filter((p) => p.applyAmount > 0);
  }, [parsedAmount, outstandingPurchases, selectedPurchaseId]);

  const fullyCovered = fifoPreview.every((p) => p.applyAmount >= p.dueAmount);
  const remainingAfterPayment = outstandingBalance - parsedAmount;

  // ── Submit ──
  const handleSubmit = async () => {
    if (parsedAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (parsedAmount > outstandingBalance) {
      setError(`Amount exceeds outstanding balance of ${formatBDT(outstandingBalance)}`);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const body: Record<string, unknown> = {
        amount: parsedAmount,
        method,
      };
      if (reference.trim()) body.reference = reference.trim();
      if (allocationMode === 'specific' && selectedPurchaseId) {
        body.purchaseId = selectedPurchaseId;
      }

      const res = await fetch(`/api/businesses/${businessId}/suppliers/${supplierId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Payment failed');
        setStep('enter');
        return;
      }

      setSuccess(data.message || `Payment of ${formatBDT(parsedAmount)} recorded successfully!`);
      setTimeout(() => {
        onPaymentSuccess();
        onClose();
      }, 1200);
    } catch {
      setError('Network error. Please try again.');
      setStep('enter');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

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
            className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white rounded-t-3xl shadow-2xl z-[70] max-h-[90vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Record Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">{supplierName}</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {/* Outstanding balance */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 p-4 mb-4">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                  Outstanding Balance
                </p>
                <p className="text-2xl font-bold text-amber-700 mt-0.5">
                  {formatBDT(outstandingBalance)}
                </p>
                <p className="text-[11px] text-amber-500 mt-1">
                  {outstandingPurchases.length} outstanding purchase{outstandingPurchases.length !== 1 ? 's' : ''}
                </p>
              </div>

              {step === 'enter' ? (
                <motion.div {...fadeUp} className="space-y-4">
                  {/* Amount input */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                      Payment Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400 font-semibold">
                        ৳
                      </span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setError(''); }}
                        placeholder="0"
                        autoFocus
                        className="w-full h-14 pl-9 pr-20 rounded-2xl bg-gray-50 border border-gray-200 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      {parsedAmount > 0 && parsedAmount <= outstandingBalance && (
                        <button
                          onClick={() => setAmount(outstandingBalance.toString())}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg"
                        >
                          MAX
                        </button>
                      )}
                    </div>

                    {/* Quick amounts */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {QUICK_AMOUNTS.filter((qa) => qa <= outstandingBalance * 1.5).map((qa) => (
                        <button
                          key={qa}
                          onClick={() => setAmount(qa.toString())}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            parsedAmount === qa
                              ? 'bg-violet-100 text-violet-700 border border-violet-200'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {formatBDT(qa)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment method */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                      Payment Method
                    </label>
                    <button
                      onClick={() => setShowMethodGrid(!showMethodGrid)}
                      className="w-full h-12 rounded-2xl bg-gray-50 border border-gray-200 px-4 flex items-center justify-between active:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedMethod.color}`}>
                          <selectedMethod.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{selectedMethod.label}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showMethodGrid ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showMethodGrid && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-3 gap-2 mt-2 overflow-hidden"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <button
                              key={m.key}
                              onClick={() => { setMethod(m.key); setShowMethodGrid(false); }}
                              className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                                method === m.key
                                  ? `${m.color} shadow-sm`
                                  : 'bg-white border-gray-100 text-gray-500'
                              }`}
                            >
                              <m.icon className="w-4 h-4" />
                              <span className="text-[10px] font-semibold">{m.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Reference */}
                  {method !== 'cash' && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                        Transaction Reference
                      </label>
                      <div className="relative">
                        <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="Txn ID / Reference No."
                          className="w-full h-11 pl-10 pr-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Allocation mode */}
                  {outstandingPurchases.length > 1 && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                        Allocation
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAllocationMode('fifo')}
                          className={`flex-1 h-11 rounded-xl border-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            allocationMode === 'fifo'
                              ? 'border-violet-400 bg-violet-50 text-violet-700'
                              : 'border-gray-100 bg-white text-gray-500'
                          }`}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          FIFO (Oldest)
                        </button>
                        <button
                          onClick={() => setAllocationMode('specific')}
                          className={`flex-1 h-11 rounded-xl border-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            allocationMode === 'specific'
                              ? 'border-violet-400 bg-violet-50 text-violet-700'
                              : 'border-gray-100 bg-white text-gray-500'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Specific
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Specific purchase picker */}
                  {allocationMode === 'specific' && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {outstandingPurchases.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPurchaseId(p.id === selectedPurchaseId ? '' : p.id)}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                            selectedPurchaseId === p.id
                              ? 'border-violet-400 bg-violet-50'
                              : 'border-gray-100 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-gray-900">
                                {p.purchaseNo}
                                {p.source === 'cctv' && (
                                  <span className="ml-1.5 text-[9px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">
                                    CCTV
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{p.ageDays}d old · {formatBDT(p.totalAmount)}</p>
                            </div>
                            <p className="text-sm font-bold text-amber-600">{formatBDT(p.dueAmount)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* FIFO preview */}
                  {allocationMode === 'fifo' && fifoPreview.length > 0 && parsedAmount > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                        FIFO Allocation Preview
                      </label>
                      <div className="space-y-1.5">
                        {fifoPreview.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-gray-900 truncate">
                                {p.purchaseNo}
                                {p.source === 'cctv' && (
                                  <span className="ml-1 text-[9px] font-bold bg-violet-100 text-violet-600 px-1 py-0.5 rounded">
                                    CCTV
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-gray-400">Due: {formatBDT(p.dueAmount)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-emerald-600">−{formatBDT(p.applyAmount)}</p>
                              {p.applyAmount >= p.dueAmount && (
                                <p className="text-[9px] text-emerald-500 font-semibold">FULL</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remaining after payment */}
                  {parsedAmount > 0 && parsedAmount <= outstandingBalance && (
                    <div className={`rounded-xl p-3 text-center ${
                      remainingAfterPayment === 0
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-gray-50 border border-gray-100'
                    }`}>
                      <p className="text-[10px] text-gray-400">
                        Remaining balance after payment
                      </p>
                      <p className={`text-base font-bold mt-0.5 ${
                        remainingAfterPayment === 0 ? 'text-emerald-600' : 'text-gray-900'
                      }`}>
                        {remainingAfterPayment === 0 ? '✓ Fully Settled' : formatBDT(remainingAfterPayment)}
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600">{error}</p>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={() => setStep('confirm')}
                    disabled={parsedAmount <= 0 || parsedAmount > outstandingBalance || (allocationMode === 'specific' && !selectedPurchaseId)}
                    className="w-full h-13 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-violet-500/20 active:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    Review Payment
                  </button>
                </motion.div>
              ) : (
                <motion.div {...fadeUp} className="space-y-4">
                  {/* Confirmation summary */}
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Amount</span>
                      <span className="text-lg font-bold text-gray-900">{formatBDT(parsedAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Method</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${selectedMethod.color}`}>
                          <selectedMethod.icon className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{selectedMethod.label}</span>
                      </div>
                    </div>
                    {reference && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Reference</span>
                        <span className="text-xs font-mono text-gray-700">{reference}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">Allocation</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {allocationMode === 'fifo' ? 'FIFO (Oldest first)' : 'Specific Purchase'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-[10px] text-gray-400 mb-1.5">Payments will be applied to:</p>
                      {fifoPreview.map((p) => (
                        <div key={p.id} className="flex justify-between items-center py-1">
                          <span className="text-[11px] text-gray-600">
                            {p.purchaseNo}
                            {p.source === 'cctv' && (
                              <span className="ml-1 text-[9px] font-bold bg-violet-100 text-violet-600 px-1 py-0.5 rounded">
                                CCTV
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600">−{formatBDT(p.applyAmount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-xs text-gray-500">New Balance</span>
                      <span className={`text-sm font-bold ${remainingAfterPayment === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {remainingAfterPayment === 0 ? '✓ Settled' : formatBDT(remainingAfterPayment)}
                      </span>
                    </div>
                  </div>

                  {/* Success message */}
                  {success && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <p className="text-xs text-emerald-600 font-medium">{success}</p>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600">{error}</p>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('enter')}
                      disabled={submitting}
                      className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 active:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Confirm Payment
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}