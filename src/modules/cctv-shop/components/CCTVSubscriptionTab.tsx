'use client';

// CCTV Subscription Tab — SUB-2 implementation.
//
// Replaces the "Coming Soon" placeholder that was in CCTVSettings.tsx.
// Lets a CCTV business user:
//   1. See their current subscription status (tier, end date, days left, stage)
//   2. Submit a bKash/Nagad payment (TRX ID + amount) via /subscription/pay
//   3. View their payment history (pending + matched + rejected)
//
// This is the user-side flow. The super-admin side (verify / match / reject)
// lives in /admin and is out of scope for this component.
//
// Related audit bugs (docs/STOCK_CALCULATION_BUGS.md §13):
//   SUB-2  — Subscription tab was a "Coming Soon" placeholder. FIXED by this file.
//   SUB-11 — Billing period selection (locked to "month" here; annual not exposed
//            in the CCTV tab to keep the UX simple. The /subscription/pay
//            endpoint still accepts billingPeriod="year" if a future UI wants it).
//   SUB-18 — Payment history UI was unreachable. FIXED: this tab renders the
//            history from /subscription/payments.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, CreditCard, Calendar, ShieldCheck, ShieldAlert, ShieldX,
  Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Send,
  Smartphone, Wallet, Receipt,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ── Types matching the /subscription GET response ──
interface SubscriptionData {
  success: boolean;
  subscription: {
    tier: string;
    tierLabel: string;
    tierPrice: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
  };
  // The /subscription endpoint doesn't currently return `stage` directly,
  // but the business record has it. We'll fall back to computing a
  // stage from `status` + `endDate` if stage isn't present.
  stage?: string;
}

// ── Types matching the /subscription/payments GET response ──
interface PaymentRecord {
  id: string;
  method: string;
  trxId: string;
  amount: number;
  status: string; // "pending" | "matched" | "rejected"
  submittedAt: string;
  matchedAt: string | null;
  matchedBy: string | null;
  notes: string | null;
}

interface PaymentsResponse {
  success: boolean;
  payments: PaymentRecord[];
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Helpers ──

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Map a subscription status + endDate to a stage badge.
// The /subscription endpoint returns `status` (trial/active/suspended/etc.)
// but not `subscriptionStage` directly. We infer a display stage.
function inferStage(status: string, endDate: string | null): {
  label: string;
  color: string;
  bg: string;
  icon: typeof ShieldCheck;
} {
  const days = daysUntil(endDate);
  if (status === 'suspended' || status === 'expired') {
    return { label: 'Expired', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: ShieldX };
  }
  if (days !== null && days < 0) {
    return { label: 'Expired', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: ShieldX };
  }
  if (days !== null && days <= 7) {
    return { label: 'Expiring Soon', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: ShieldAlert };
  }
  return { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: ShieldCheck };
}

const PAYMENT_METHODS = [
  { value: 'bkash', label: 'bKash', icon: Smartphone, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  { value: 'nagad', label: 'Nagad', icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
] as const;

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending Verification', color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
  matched: { label: 'Verified', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
};

// ── Main component ──

export function CCTVSubscriptionTab({ businessId }: { businessId?: string }) {
  const { toast } = useToast();

  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/subscription`);
      const data = await res.json();
      if (data.success) {
        setSubData(data);
      }
    } catch {
      // Silent — the tab still renders, just with empty state
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadPayments = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/subscription/payments`);
      const data: PaymentsResponse = await res.json();
      if (data.success) {
        setPayments(data.payments || []);
      }
    } catch {
      // Silent
    } finally {
      setPaymentsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadSubscription();
    loadPayments();
  }, [loadSubscription, loadPayments]);

  const reloadAll = () => {
    loadSubscription();
    loadPayments();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const sub = subData?.subscription;
  const stage = inferStage(sub?.status || 'active', sub?.endDate || null);
  const StageIcon = stage.icon;
  const daysLeft = daysUntil(sub?.endDate || null);
  const expectedAmount = sub?.tierPrice ?? 0;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* ── Status card ── */}
      <div className={cn('rounded-2xl border p-5 shadow-sm', stage.bg)}>
        <div className="flex items-start gap-3">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', stage.bg)}>
            <StageIcon className={cn('w-6 h-6', stage.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-gray-900">
                {sub?.tierLabel || 'Unknown'} Plan
              </h2>
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', stage.color, stage.bg)}>
                {stage.label}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {sub?.endDate ? (
                <>
                  Expires on <strong>{formatDate(sub.endDate)}</strong>
                  {daysLeft !== null && (
                    <span className={cn('ml-2 font-semibold', daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-700' : 'text-emerald-700')}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                    </span>
                  )}
                </>
              ) : (
                'No expiry date set — contact support'
              )}
            </p>
            {expectedAmount > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Monthly fee: <strong>{formatBDT(expectedAmount)}</strong>
              </p>
            )}
          </div>
          <button
            onClick={reloadAll}
            className="shrink-0 w-8 h-8 rounded-lg hover:bg-white/50 flex items-center justify-center"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Warning if expiring soon / expired ── */}
      {stage.label !== 'Active' && (
        <div className={cn(
          'rounded-2xl border p-4 flex items-start gap-3',
          stage.label === 'Expired' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        )}>
          <AlertCircle className={cn('w-5 h-5 shrink-0 mt-0.5', stage.label === 'Expired' ? 'text-red-600' : 'text-amber-600')} />
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', stage.label === 'Expired' ? 'text-red-800' : 'text-amber-800')}>
              {stage.label === 'Expired'
                ? 'Your subscription has expired.'
                : 'Your subscription is expiring soon.'}
            </p>
            <p className={cn('text-xs mt-1', stage.label === 'Expired' ? 'text-red-700' : 'text-amber-700')}>
              {stage.label === 'Expired'
                ? 'You can still view reports and submit a payment, but you cannot make new sales, purchases, or repairs until your payment is verified.'
                : 'Submit your monthly payment now to avoid interruption.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Payment form ── */}
      <PaymentForm
        businessId={businessId}
        expectedAmount={expectedAmount}
        onSubmitted={() => {
          reloadAll();
        }}
      />

      {/* ── Payment history ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-violet-500" />
            Payment History
          </h3>
          <span className="text-[10px] text-gray-400">{payments.length} record(s)</span>
        </div>

        {paymentsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-6">
            <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No payments submitted yet</p>
            <p className="text-[10px] text-gray-400 mt-1">Submit your first payment above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const style = STATUS_STYLES[p.status] || STATUS_STYLES.pending;
              const StatusIcon = style.icon;
              return (
                <div key={p.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold', style.color, style.bg)}>
                          <StatusIcon className="w-2.5 h-2.5 inline mr-0.5" />
                          {style.label}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">{p.method}</span>
                      </div>
                      <p className="text-xs font-mono text-gray-700 mt-1 break-all">
                        TX ID: <strong>{p.trxId}</strong>
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Submitted {formatDate(p.submittedAt)}
                        {p.matchedAt && ` · Verified ${formatDate(p.matchedAt)}`}
                      </p>
                      {p.notes && (
                        <p className="text-[10px] text-gray-500 mt-1 italic">{p.notes}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-900 shrink-0">
                      {formatBDT(Number(p.amount))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Help / instructions ── */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
        <h4 className="text-xs font-bold text-blue-800 mb-2">How to pay</h4>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Send <strong>{expectedAmount > 0 ? formatBDT(expectedAmount) : 'your monthly fee'}</strong> via bKash or Nagad to the shop number provided by support.</li>
          <li>Copy the transaction ID (TX ID) from your bKash/Nagad confirmation SMS.</li>
          <li>Open the payment form above, select the method, paste the TX ID, enter the amount, and submit.</li>
          <li>Wait for the super-admin to verify your payment. You will see the status change from "Pending" to "Verified" here.</li>
          <li>Once verified, your subscription is extended by 30 days from the current end date.</li>
        </ol>
      </div>
    </motion.div>
  );
}

// ── Payment form (separated for clarity) ──

function PaymentForm({
  businessId,
  expectedAmount,
  onSubmitted,
}: {
  businessId?: string;
  expectedAmount: number;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [trxId, setTrxId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!businessId) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return;
    }
    if (!trxId.trim() || trxId.trim().length < 6) {
      toast({ title: 'TX ID must be at least 6 characters', variant: 'destructive' });
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Amount must be a positive number', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/subscription/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          trxId: trxId.trim(),
          amount: amountNum,
          // billingPeriod intentionally omitted — defaults to "month" in the endpoint.
          // We don't expose annual billing in the CCTV tab to keep the UX simple.
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Payment submitted',
          description: `TX ID ${data.payment.trxId} is pending verification. Check back in a few hours.`,
        });
        // Reset form
        setTrxId('');
        setAmount('');
        setNote('');
        setOpen(false);
        onSubmitted();
      } else {
        toast({
          title: data.error || 'Failed to submit payment',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-500" />
          Submit Monthly Payment
        </h3>
        {expectedAmount > 0 && (
          <span className="text-[10px] text-gray-500">
            Expected: <strong className="text-violet-700">{formatBDT(expectedAmount)}</strong>/month
          </span>
        )}
      </div>

      {!open ? (
        <button
          onClick={() => {
            setAmount(String(expectedAmount || ''));
            setOpen(true);
          }}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Send className="w-4 h-4" />
          Submit a Payment
        </button>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {/* Method selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Payment Method *</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const isSelected = method === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 h-11 rounded-xl border-2 transition-all active:scale-95',
                        isSelected
                          ? `${m.bg} ${m.border} ${m.color}`
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-semibold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TX ID */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Transaction ID (TX ID) *</Label>
              <Input
                value={trxId}
                onChange={(e) => setTrxId(e.target.value)}
                placeholder="e.g. 9XKQ2P3M7N"
                className="h-10 rounded-xl font-mono text-sm"
                autoFocus
              />
              <p className="text-[10px] text-gray-400">
                Find this in your {method === 'bkash' ? 'bKash' : 'Nagad'} confirmation SMS. Minimum 6 characters.
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Amount (৳) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(expectedAmount || 0)}
                className="h-10 rounded-xl"
                min="0"
                step="0.01"
              />
              {expectedAmount > 0 && parseFloat(amount) !== expectedAmount && (
                <p className="text-[10px] text-amber-600">
                  Note: expected amount is {formatBDT(expectedAmount)}. If you send a different amount, verification may be delayed.
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any note for the super-admin..."
                className="rounded-xl text-sm resize-none"
                rows={2}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !trxId.trim() || !amount}
                className="flex-1 h-11 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {saving ? 'Submitting...' : 'Submit Payment'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
