'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Loader2, Users, AlertTriangle, Phone, Download, DollarSign, X } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${Math.abs(n).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// DC-7: CSV export helper. Mirrors the CL-11 pattern (UTF-8 BOM + quoted
// fields). Columns: Name, Phone, Balance, Aging Days, Aging Bucket, Oldest
// Due Date, Unpaid Sales Count, Total Purchases, Total Paid.
function buildDueCSV(customers: any[]): Blob {
  const lines: string[] = [];
  lines.push(`# Due Collection Report`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Name,Phone,Balance (Tk),Aging Days,Aging Bucket,Oldest Due Date,Unpaid Sales Count,Total Purchases (Tk),Total Paid (Tk)');
  for (const c of customers) {
    const esc = (v: string | null | undefined) => `"${(v || '').replace(/"/g, '""')}"`;
    lines.push([
      esc(c.name),
      esc(c.phone),
      c.balance.toFixed(2),
      c.agingDays,
      esc(c.agingBucket),
      c.oldestDueDate || '',
      c.unpaidSalesCount,
      (c.totalPurchases || 0).toFixed(2),
      (c.totalPaid || 0).toFixed(2),
    ].join(','));
  }
  const total = customers.reduce((s, c) => s + c.balance, 0);
  lines.push('');
  lines.push(`TOTAL,,,${total.toFixed(2)},,,,,`);
  const csv = '\uFEFF' + lines.join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const AGING_COLORS: Record<string, string> = {
  '0-30 days': 'bg-emerald-50 text-emerald-700',
  '31-60 days': 'bg-amber-50 text-amber-700',
  '61-90 days': 'bg-orange-50 text-orange-700',
  '90+ days': 'bg-red-50 text-red-700',
};

export function CCTVDueCollection() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // DC-8: auto-load on mount (same pattern as R-1 Stock Report).
  const [hasSearched, setHasSearched] = useState(true);

  // DC-6: collect-payment dialog state. Opens pre-filled with the customer
  // and the full balance as the amount. Mirrors the CCTVLedger payment flow.
  const [showCollect, setShowCollect] = useState(false);
  const [collectCustomer, setCollectCustomer] = useState<any>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');
  const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectNotes, setCollectNotes] = useState('');
  const [savingCollect, setSavingCollect] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/reports/due-collection`);
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // DC-8: auto-load on mount + when businessId changes
  useEffect(() => {
    if (businessId) handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // DC-7: export the current customer list to CSV
  const handleExportCSV = () => {
    if (!data || !data.customers || data.customers.length === 0) {
      toast({ title: 'Nothing to export', description: 'No dues to export', variant: 'destructive' });
      return;
    }
    const blob = buildDueCSV(data.customers);
    const today = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `due-collection_${today}.csv`);
    toast({ title: 'Exported', description: `${data.customers.length} customers exported to CSV` });
  };

  // DC-6: open the collect dialog pre-filled with a customer's balance
  const openCollect = (customer: any) => {
    setCollectCustomer(customer);
    setCollectAmount(String(customer.balance));
    setCollectMethod('cash');
    setCollectDate(new Date().toISOString().split('T')[0]);
    setCollectNotes('');
    setShowCollect(true);
  };

  // DC-6: submit the payment via the standard /payments endpoint.
  const handleCollect = async () => {
    if (!collectCustomer) return;
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Error', description: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    setSavingCollect(true);
    try {
      let referenceId: string | null = null;
      let referenceType: string | null = null;
      const salesRes = await fetch(`/api/businesses/${businessId}/cctv/sales?pageSize=100`);
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        const outstanding = (salesData.sales || []).find(
          (s: any) => s.customerId === collectCustomer.id && Number(s.dueAmount) > 0
        );
        if (outstanding) {
          referenceId = outstanding.id;
          referenceType = 'sale';
        }
      }
      const res = await fetch(`/api/businesses/${businessId}/cctv/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'customer_payment',
          customerId: collectCustomer.id,
          amount,
          paymentMethod: collectMethod,
          paymentDate: collectDate,
          notes: collectNotes || null,
          referenceId,
          referenceType,
        }),
      });
      if (res.ok) {
        toast({
          title: 'Payment recorded',
          description: `${formatBDT(amount)} from ${collectCustomer.name} via ${collectMethod}`,
        });
        setShowCollect(false);
        setCollectCustomer(null);
        handleSearch();
      } else {
        const d = await res.json();
        toast({ title: d.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSavingCollect(false);
    }
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Due Collection Report</h1>
          <p className="text-xs text-gray-500">Customers who owe you money, with aging analysis</p>
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        {/* DC-7: CSV export */}
        {data && data.customers && data.customers.length > 0 && (
          <button onClick={handleExportCSV}
            className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : hasSearched && data ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <span className="text-xs text-red-700 font-medium">Total Due</span>
              <p className="text-xl font-bold text-red-700 mt-1">{formatBDT(data.summary.totalDue)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Customers with Due</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.customerCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Average Due</span>
              <p className="text-xl font-bold text-violet-600 mt-1">{formatBDT(data.summary.avgDue)}</p>
            </div>
          </div>

          {/* Customer list */}
          {data.customers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <Users className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">No outstanding dues!</p>
              <p className="text-xs text-gray-400 mt-1">All customers are settled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.customers.map((c: any) => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold', AGING_COLORS[c.agingBucket] || 'bg-gray-100 text-gray-600')}>
                          {c.agingBucket}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {c.phone || 'No phone'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {c.unpaidSalesCount} unpaid sale(s) · oldest: {c.oldestDueDate || '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{formatBDT(c.balance)}</p>
                        <p className="text-[10px] text-gray-400">due</p>
                      </div>
                      {/* DC-6: Collect button — opens the payment dialog
                          pre-filled with the customer + full balance */}
                      <button
                        onClick={() => openCollect(c)}
                        className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <DollarSign className="w-3 h-3" /> Collect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-amber-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Loading dues…</p>
          <p className="text-xs text-gray-400 mt-1">Shows all customers with outstanding balances + aging</p>
        </div>
      )}

      {/* DC-6: Collect Payment dialog */}
      {showCollect && collectCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Collect Payment</h3>
              <button onClick={() => setShowCollect(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-sm mb-4">
              <p className="font-semibold text-gray-900">{collectCustomer.name}</p>
              <p className="text-xs text-gray-500">{collectCustomer.phone || 'No phone'}</p>
              <p className="text-sm text-red-600 font-semibold mt-1">
                Outstanding: {formatBDT(collectCustomer.balance)}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Amount (৳) *</Label>
                <Input type="number" value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="0" className="h-10 rounded-xl" min="0" step="0.01" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Date</Label>
                  <Input type="date" value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
                    className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Quick Pay</Label>
                  <button
                    onClick={() => setCollectAmount(String(collectCustomer.balance))}
                    className="w-full h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 text-xs font-semibold hover:bg-violet-100 transition-colors"
                  >
                    Full ৳{collectCustomer.balance.toLocaleString()}
                  </button>
                </div>
              </div>
              <PaymentMethodSelector
                value={collectMethod}
                onChange={setCollectMethod}
                label="Payment Method"
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">Notes (optional)</Label>
                <Input value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder="Any notes..."
                  className="h-10 rounded-xl" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCollect(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={handleCollect} disabled={savingCollect}
                className="flex-1 h-11 rounded-xl bg-emerald-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {savingCollect ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {savingCollect ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
