'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Printer, Users, Building2, Phone, Plus, X,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PaymentMethodSelector } from './PaymentMethodSelector';

interface Party {
  id: string;
  name: string;
  phone: string;
  balance: number;
  totalPurchases?: number;
  totalPaid?: number;
}

interface LedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: string;
}

interface LedgerData {
  success: boolean;
  customer?: { id: string; name: string; phone: string };
  supplier?: { id: string; name: string; phone: string };
  entries: LedgerEntry[];
  summary: { totalDebit: number; totalCredit: number; balance: number; entryCount: number };
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${Math.abs(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CCTVLedger({ type }: { type: 'customer' | 'supplier' }) {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');
  const { toast } = useToast();

  const [parties, setParties] = useState<Party[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Payment dialog state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const isCustomer = type === 'customer';
  const label = isCustomer ? 'Customer' : 'Supplier';
  const apiPath = isCustomer ? 'customer-ledger' : 'supplier-ledger';

  // Load party list
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/reports/${apiPath}`)
      .then((r) => r.json())
      .then((data) => {
        setParties(data.customers || data.suppliers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [businessId, apiPath]);

  // Load ledger when party selected
  useEffect(() => {
    if (!selectedId || !businessId) return;
    setLedgerLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/reports/${apiPath}?${isCustomer ? 'customerId' : 'supplierId'}=${selectedId}`)
      .then((r) => r.json())
      .then((data) => { setLedger(data); setLedgerLoading(false); })
      .catch(() => setLedgerLoading(false));
  }, [selectedId, businessId, apiPath, isCustomer]);

  const handlePrint = () => window.print();

  const reloadLedger = () => {
    if (!selectedId || !businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/reports/${apiPath}?${isCustomer ? 'customerId' : 'supplierId'}=${selectedId}`)
      .then((r) => r.json())
      .then((data) => setLedger(data))
      .catch(() => {});
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ title: 'Error', description: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    setSavingPayment(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isCustomer ? 'customer_payment' : 'supplier_payment',
          customerId: isCustomer ? selectedId : null,
          supplierId: !isCustomer ? selectedId : null,
          amount: paymentAmount,
          paymentMethod,
          paymentDate,
          notes: paymentNotes || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Payment recorded', description: `৳${paymentAmount} ${paymentMethod}` });
        setShowPayment(false);
        setPaymentAmount('');
        setPaymentNotes('');
        reloadLedger();
        // Also reload party list to update balances
        fetch(`/api/businesses/${businessId}/cctv/reports/${apiPath}`)
          .then((r) => r.json())
          .then((data) => setParties(data.customers || data.suppliers || []))
          .catch(() => {});
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">{label} Ledger</h1>
        {ledger && (
          <>
            <button onClick={() => setShowPayment(true)}
              className="h-9 px-4 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
              <Plus className="w-4 h-4" /> Payment
            </button>
            <button onClick={handlePrint}
              className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Print
            </button>
          </>
        )}
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{businessName}</h1>
        <p className="text-sm text-gray-600">{label} Ledger — {ledger?.customer?.name || ledger?.supplier?.name}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <>
          {/* Party selector */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm print:hidden">
            <label className="text-xs text-gray-600 mb-2 block">Select {label}</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white"
            >
              <option value="">— Select {label} —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.phone} (Balance: {formatBDT(p.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Party list with balances (when no one selected) */}
          {!selectedId && parties.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-800">All {label}s ({parties.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {parties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-violet-50 transition-colors text-left"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      isCustomer ? 'bg-blue-50' : 'bg-amber-50'
                    )}>
                      {isCustomer ? <Users className="w-5 h-5 text-blue-500" /> : <Building2 className="w-5 h-5 text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.phone || 'No phone'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-sm font-bold',
                        p.balance > 0 ? 'text-red-600' : p.balance < 0 ? 'text-emerald-600' : 'text-gray-500'
                      )}>
                        {formatBDT(p.balance)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {p.balance > 0 ? `${isCustomer ? 'owes' : 'we owe'}` : p.balance < 0 ? 'settled' : 'no balance'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!selectedId && parties.length === 0 && !loading && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              {isCustomer ? <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" /> : <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />}
              <p className="text-sm font-medium text-gray-700">No {label.toLowerCase()}s yet</p>
              <p className="text-xs text-gray-400 mt-1">
                {label}s are created automatically when you make {isCustomer ? 'sales' : 'purchases'}
              </p>
            </div>
          )}

          {/* Ledger detail */}
          {selectedId && ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : selectedId && ledger && ledger.entries.length > 0 ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
                <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
                  <span className="text-xs text-red-700 font-medium">Total {isCustomer ? 'They Owe' : 'We Owe'}</span>
                  <p className="text-xl font-bold text-red-700 mt-1">{formatBDT(ledger.summary.totalDebit - ledger.summary.totalCredit)}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
                  <span className="text-xs text-emerald-700 font-medium">Total Paid</span>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatBDT(ledger.summary.totalCredit)}</p>
                </div>
                <div className={cn(
                  'rounded-2xl border p-4',
                  ledger.summary.balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-violet-50 border-violet-100'
                )}>
                  <span className={cn(
                    'text-xs font-medium',
                    ledger.summary.balance > 0 ? 'text-amber-700' : 'text-violet-700'
                  )}>Current Balance</span>
                  <p className={cn(
                    'text-xl font-bold mt-1',
                    ledger.summary.balance > 0 ? 'text-amber-700' : 'text-violet-700'
                  )}>{formatBDT(ledger.summary.balance)}</p>
                </div>
              </div>

              {/* Ledger table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left p-3 font-semibold text-gray-700">Date</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Description</th>
                        <th className="text-right p-3 font-semibold text-red-700">Debit (৳)</th>
                        <th className="text-right p-3 font-semibold text-emerald-700">Credit (৳)</th>
                        <th className="text-right p-3 font-semibold text-gray-700">Balance (৳)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.entries.map((entry, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="p-3 text-gray-700">{entry.description}</td>
                          <td className="p-3 text-right font-medium text-red-600">
                            {entry.debit > 0 ? formatBDT(entry.debit) : '—'}
                          </td>
                          <td className="p-3 text-right font-medium text-emerald-600">
                            {entry.credit > 0 ? formatBDT(entry.credit) : '—'}
                          </td>
                          <td className="p-3 text-right font-semibold text-gray-900">{formatBDT(entry.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={2} className="p-3 font-bold text-gray-800">Total</td>
                        <td className="p-3 text-right font-bold text-red-700">{formatBDT(ledger.summary.totalDebit)}</td>
                        <td className="p-3 text-right font-bold text-emerald-700">{formatBDT(ledger.summary.totalCredit)}</td>
                        <td className="p-3 text-right font-bold text-violet-700">{formatBDT(ledger.summary.balance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : selectedId && ledger && ledger.entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <p className="text-sm font-medium text-gray-700">No transactions found</p>
              <p className="text-xs text-gray-400 mt-1">This {label.toLowerCase()} has no transactions yet</p>
            </div>
          ) : null}
        </>
      )}

      {/* Payment Dialog */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {isCustomer ? 'Receive Payment' : 'Pay Supplier'}
              </h3>
              <button onClick={() => setShowPayment(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                {isCustomer ? ledger?.customer?.name : ledger?.supplier?.name}
                {ledger && ledger.summary.balance > 0 && (
                  <span className="text-red-600 font-semibold ml-2">
                    Balance due: {formatBDT(ledger.summary.balance)}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Amount (৳) *</Label>
                <Input type="number" value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0" className="h-10 rounded-xl" min="0" step="0.01" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Date</Label>
                  <Input type="date" value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Quick Pay</Label>
                  <button
                    onClick={() => setPaymentAmount(String(ledger?.summary.balance || 0))}
                    disabled={!ledger || ledger.summary.balance <= 0}
                    className="w-full h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold disabled:opacity-50 hover:bg-violet-100 transition-colors"
                  >
                    Pay Full ৳{ledger?.summary.balance.toLocaleString() || 0}
                  </button>
                </div>
              </div>

              <PaymentMethodSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
                label="Payment Method"
              />

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Notes (optional)</Label>
                <Textarea value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Any notes..." className="rounded-xl resize-none" rows={2} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowPayment(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={handlePayment} disabled={savingPayment}
                className="flex-1 h-11 rounded-xl bg-emerald-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {savingPayment ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
