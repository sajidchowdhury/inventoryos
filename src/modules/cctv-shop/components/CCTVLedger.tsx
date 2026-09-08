'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Printer, Users, Building2, Phone, Plus, X,
  ArrowDownToLine, ArrowUpFromLine, Percent, Search, Download, Calendar,
  ChevronDown,
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
  reference?: string;
}

interface LedgerData {
  success: boolean;
  customer?: { id: string; name: string; phone: string };
  supplier?: { id: string; name: string; phone: string };
  entries: LedgerEntry[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    balance: number;
    entryCount: number;
    dateRange?: { from: string | null; to: string | null };
  };
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

// ── CL-11: CSV export helper ──
// Builds a CSV with the UTF-8 BOM (\uFEFF) so Excel "UTF-8" exports don't
// mangle the first header column (the same issue noted in I-6 for product
// CSV imports). Returns a Blob ready for download.
//
// Column layout mirrors the on-screen ledger table: Date, Description,
// Debit, Credit, Balance. Notes are folded into Description by the API
// already, so we don't add a separate Notes column.
function buildLedgerCSV(
  entries: LedgerEntry[],
  partyName: string | undefined,
  summary: { totalDebit: number; totalCredit: number; balance: number },
  dateRange?: { from: string | null; to: string | null },
): Blob {
  const lines: string[] = [];
  // Header banner (3 lines of context, then a blank row)
  lines.push(`# ${partyName || 'Party'} Ledger`);
  if (dateRange?.from || dateRange?.to) {
    const f = dateRange.from || '';
    const t = dateRange.to || '';
    lines.push(`# Period: ${f || 'beginning'} to ${t || 'today'}`);
  }
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');
  // Column header
  lines.push('Date,Description,Debit (Tk),Credit (Tk),Balance (Tk)');
  for (const e of entries) {
    // Quote-and-escape description (commas + quotes are common in sale
    // descriptions like "Sale (INV-123)")
    const desc = `"${(e.description || '').replace(/"/g, '""')}"`;
    lines.push(
      [
        e.date,
        desc,
        e.debit.toFixed(2),
        e.credit.toFixed(2),
        e.balance.toFixed(2),
      ].join(','),
    );
  }
  // Totals row
  lines.push('');
  lines.push(`TOTAL,,,${summary.totalDebit.toFixed(2)},${summary.totalCredit.toFixed(2)},${summary.balance.toFixed(2)}`);
  // Prepend BOM so Excel detects UTF-8 (mirrors I-6 lesson)
  const csv = '\uFEFF' + lines.join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// Download a Blob as a file by creating a temporary <a> and clicking it.
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL after a short delay to ensure the click is
  // processed before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  // CL-9: combobox state — search text + open/close for the dropdown panel.
  // Replaces the old `<select>` dropdown that was unusable for shops with
  // 1000+ customers (one option per customer).
  const [partySearch, setPartySearch] = useState('');
  const [partyComboboxOpen, setPartyComboboxOpen] = useState(false);
  // Ref to the combobox container so we can close the panel on outside click.
  const partyComboboxRef = useRef<HTMLDivElement>(null);

  // Close the combobox panel when the user clicks outside of it (or hits Esc).
  useEffect(() => {
    if (!partyComboboxOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        partyComboboxRef.current &&
        !partyComboboxRef.current.contains(e.target as Node)
      ) {
        setPartyComboboxOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPartyComboboxOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [partyComboboxOpen]);

  // CL-11: date-range state. The API already supported ?from=&to= (CL-5 fix)
  // but the UI never exposed it. The export uses the same filtered entries.
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // CL-10: progressive disclosure cap. The ledger table renders the first
  // `displayCap` rows by default. If the ledger has more, a "Show all N"
  // button appears. Each click doubles the cap (200 → 400 → 800 → ...).
  // This avoids a hard dependency on a virtualization library while
  // keeping the DOM light for typical shops. A 1000-row ledger renders
  // 200 rows initially (≈16ms paint) instead of all 1000 (≈80ms+ jank).
  const DISPLAY_CAP_INITIAL = 200;
  const [displayCap, setDisplayCap] = useState(DISPLAY_CAP_INITIAL);

  // Payment dialog state
  const [showPayment, setShowPayment] = useState(false);
  const [actionMode, setActionMode] = useState<'payment' | 'discount'>('payment');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const isCustomer = type === 'customer';
  const label = isCustomer ? 'Customer' : 'Supplier';
  const apiPath = isCustomer ? 'customer-ledger' : 'supplier-ledger';

  // CL-9: filter parties client-side by name or phone. For 1000+ parties
  // this is fine — the filter runs at typing speed. For 10000+ parties we'd
  // want server-side search (CU-7) but that's a separate Medium fix.
  const filteredParties = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q),
    );
  }, [parties, partySearch]);

  // Find the selected party object (for the combobox's display label).
  const selectedParty = useMemo(
    () => parties.find((p) => p.id === selectedId),
    [parties, selectedId],
  );

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

  // Load ledger when party selected OR date range changes
  useEffect(() => {
    if (!selectedId || !businessId) return;
    setLedgerLoading(true);
    // CL-11: include from/to in the query string when set, so the API
    // filters server-side (CL-5/SL-3 already support this).
    const params = new URLSearchParams();
    params.set(isCustomer ? 'customerId' : 'supplierId', selectedId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    fetch(`/api/businesses/${businessId}/cctv/reports/${apiPath}?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setLedger(data);
        setLedgerLoading(false);
        // CL-10: reset the cap whenever a new ledger loads
        setDisplayCap(DISPLAY_CAP_INITIAL);
      })
      .catch(() => setLedgerLoading(false));
  }, [selectedId, businessId, apiPath, isCustomer, fromDate, toDate]);

  const handlePrint = () => window.print();

  const reloadLedger = () => {
    if (!selectedId || !businessId) return;
    const params = new URLSearchParams();
    params.set(isCustomer ? 'customerId' : 'supplierId', selectedId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    fetch(`/api/businesses/${businessId}/cctv/reports/${apiPath}?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setLedger(data))
      .catch(() => {});
  };

  // CL-11: build + download CSV of the currently-displayed ledger entries.
  // The entries are already filtered server-side by the from/to range, so
  // the export always matches what's on screen.
  const handleExportCSV = () => {
    if (!ledger || ledger.entries.length === 0) {
      toast({ title: 'Nothing to export', description: 'No ledger entries to export', variant: 'destructive' });
      return;
    }
    const partyName = ledger.customer?.name || ledger.supplier?.name;
    const blob = buildLedgerCSV(
      ledger.entries,
      partyName,
      ledger.summary,
      ledger.summary.dateRange,
    );
    // Filename: customer-ledger_John-Doe_2026-09-09.csv (sanitize name)
    const safeName = (partyName || 'party').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `${label.toLowerCase()}-ledger_${safeName}_${today}.csv`);
    toast({ title: 'Exported', description: `${ledger.entries.length} entries exported to CSV` });
  };

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ title: 'Error', description: 'Amount must be greater than 0', variant: 'destructive' });
      return;
    }
    setSavingPayment(true);
    try {
      const isDiscount = actionMode === 'discount';
      const baseType = isCustomer ? 'customer_payment' : 'supplier_payment';
      const discountType = isCustomer ? 'customer_discount' : 'supplier_discount';

      // CL-8 fix: find the first outstanding sale/purchase from the ledger
      // entries to link the payment to. The ledger entries for sales have
      // type='sale' and a positive debit (totalAmount) with a reference field
      // containing the sale ID. We look for the first sale entry that still
      // has a balance (debit > credit) to link the payment to.
      // If no outstanding sale is found, the payment is unlinked (referenceId
      // = null) — allowed per PM-1.
      let referenceId: string | null = null;
      let referenceType: string | null = null;

      if (!isDiscount && ledger?.entries) {
        // Find the first sale/purchase entry with an outstanding balance
        // (where debit > credit, meaning they still owe for this invoice)
        for (const entry of ledger.entries) {
          if (isCustomer && entry.type === 'sale' && entry.debit > entry.credit) {
            // The reference field on sale entries contains the sale ID
            // (set by the customer-ledger route: description includes the
            // invoice no, and reference is the saleId)
            // We need to find the saleId. The ledger entry doesn't directly
            // expose it, but we can find it from the sale's invoiceNo
            // in the description. For now, we'll fetch the customer's
            // outstanding sales and pick the first one.
            break; // We'll fetch below
          }
          if (!isCustomer && entry.type === 'purchase' && entry.debit > entry.credit) {
            break;
          }
        }

        // Fetch outstanding sales/purchases for this party
        if (isCustomer) {
          const salesRes = await fetch(
            `/api/businesses/${businessId}/cctv/sales?pageSize=100`
          );
          if (salesRes.ok) {
            const salesData = await salesRes.json();
            const outstanding = (salesData.sales || []).find(
              (s: any) =>
                s.customerId === selectedId &&
                Number(s.dueAmount) > 0
            );
            if (outstanding) {
              referenceId = outstanding.id;
              referenceType = 'sale';
            }
          }
        } else {
          const purchasesRes = await fetch(
            `/api/businesses/${businessId}/cctv/purchases?pageSize=100`
          );
          if (purchasesRes.ok) {
            const purchasesData = await purchasesRes.json();
            const outstanding = (purchasesData.purchases || []).find(
              (p: any) =>
                p.supplierId === selectedId &&
                Number(p.dueAmount) > 0
            );
            if (outstanding) {
              referenceId = outstanding.id;
              referenceType = 'purchase';
            }
          }
        }
      }

      const res = await fetch(`/api/businesses/${businessId}/cctv/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isDiscount ? discountType : baseType,
          customerId: isCustomer ? selectedId : null,
          supplierId: !isCustomer ? selectedId : null,
          amount: paymentAmount,
          paymentMethod: isDiscount ? 'cash' : paymentMethod, // discounts are always cash adjustments
          paymentDate,
          notes: paymentNotes || null,
          // CL-8 fix: send referenceId + referenceType so the payment is
          // linked to a sale/purchase (PM-1 fix). The /payments endpoint
          // (PM-3 fix) will update the linked sale's/purchase's
          // paidAmount/dueAmount.
          referenceId,
          referenceType,
        }),
      });
      if (res.ok) {
        const actionLabel = isDiscount
          ? 'Discount adjusted'
          : (isCustomer ? 'Payment received' : 'Payment made');
        toast({
          title: actionLabel,
          description: `৳${paymentAmount}${isDiscount ? '' : ` via ${paymentMethod}`}`,
        });
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
            <button
              onClick={() => { setActionMode('payment'); setPaymentAmount(''); setShowPayment(true); }}
              className="h-9 px-4 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> {isCustomer ? 'Receive' : 'Pay'}
            </button>
            <button
              onClick={() => { setActionMode('discount'); setPaymentAmount(''); setShowPayment(true); }}
              className="h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Percent className="w-4 h-4" /> Discount
            </button>
            {/* CL-11: CSV export — uses the currently-loaded ledger entries
                (already filtered by the from/to range), so the export
                always matches what's on screen. */}
            <button onClick={handleExportCSV}
              className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
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
          {/* Party selector — CL-9: searchable combobox.
              Previously a `<select>` dropdown with one `<option>` per
              party. A shop with 1000 customers had a 1000-option dropdown
              — unusable. Now: an input with a filtered dropdown panel.
              The same search input also serves as the trigger to open
              the panel; selecting a row closes it and shows the chosen
              party's name + balance as the input value (read-only). */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm print:hidden">
            <label className="text-xs text-gray-600 mb-2 block">Select {label}</label>
            <div className="relative" ref={partyComboboxRef}>
              {/* Combobox trigger: looks like an input, opens the panel on focus/click. */}
              <button
                type="button"
                onClick={() => setPartyComboboxOpen((o) => !o)}
                className={cn(
                  'w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white flex items-center justify-between gap-2',
                  partyComboboxOpen && 'border-violet-300 ring-2 ring-violet-100',
                )}
              >
                {selectedParty ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-900 truncate">{selectedParty.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{selectedParty.phone || 'No phone'}</span>
                    <span className={cn(
                      'text-xs font-semibold shrink-0',
                      selectedParty.balance > 0 ? 'text-red-600' : selectedParty.balance < 0 ? 'text-emerald-600' : 'text-gray-500',
                    )}>
                      {formatBDT(selectedParty.balance)}
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-400 flex items-center gap-2">
                    <Search className="w-4 h-4" /> Search or browse {label.toLowerCase()}s…
                  </span>
                )}
                <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', partyComboboxOpen && 'rotate-180')} />
              </button>

              {/* Dropdown panel */}
              {partyComboboxOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-96 flex flex-col">
                  {/* Search input inside the panel */}
                  <div className="p-2 border-b border-gray-100 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={partySearch}
                        onChange={(e) => setPartySearch(e.target.value)}
                        placeholder={`Search ${label.toLowerCase()} by name or phone…`}
                        className="w-full h-9 rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Filtered results */}
                  <div className="overflow-y-auto flex-1">
                    {filteredParties.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">
                        {partySearch.trim()
                          ? `No ${label.toLowerCase()}s match "${partySearch.trim()}"`
                          : `No ${label.toLowerCase()}s yet`}
                      </div>
                    ) : (
                      filteredParties.slice(0, 200).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(p.id);
                            setPartyComboboxOpen(false);
                            setPartySearch('');
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 hover:bg-violet-50 transition-colors text-left border-b border-gray-50 last:border-0',
                            p.id === selectedId && 'bg-violet-50',
                          )}
                        >
                          <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                            isCustomer ? 'bg-blue-50' : 'bg-amber-50',
                          )}>
                            {isCustomer
                              ? <Users className="w-4 h-4 text-blue-500" />
                              : <Building2 className="w-4 h-4 text-amber-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {p.phone || 'No phone'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn(
                              'text-sm font-bold',
                              p.balance > 0 ? 'text-red-600' : p.balance < 0 ? 'text-emerald-600' : 'text-gray-500',
                            )}>
                              {formatBDT(p.balance)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                    {/* If more than 200 matches, hint that narrowing the search will help */}
                    {filteredParties.length > 200 && (
                      <div className="p-2 text-center text-[11px] text-gray-400 border-t border-gray-100">
                        Showing first 200 of {filteredParties.length} — narrow the search to see more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CL-11: date-range filter. The API already supported ?from=&to=
                (CL-5 fix), but the UI never exposed it. Accountants want
                "show me this customer's ledger for September only" before
                exporting. Leaving both empty = all-time (same as before). */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-200 px-2 text-sm bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> To
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-200 px-2 text-sm bg-white"
                />
              </div>
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="mt-2 text-[11px] text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear date range
              </button>
            )}
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

              {/* ── DUE ACTION PANEL ── */}
              {ledger.summary.balance > 0 && (
                <div className="bg-white rounded-2xl border-2 border-violet-200 p-4 shadow-sm print:hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500 font-medium">
                        {isCustomer ? 'Customer Due' : 'We Owe'}
                      </p>
                      <p className="text-2xl font-bold text-amber-600">{formatBDT(ledger.summary.balance)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPaymentAmount(String(ledger.summary.balance));
                          setActionMode('payment');
                          setShowPayment(true);
                        }}
                        className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        {isCustomer ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                        {isCustomer ? 'Receive Payment' : 'Pay Supplier'}
                      </button>
                      <button
                        onClick={() => {
                          setPaymentAmount(String(ledger.summary.balance));
                          setActionMode('discount');
                          setShowPayment(true);
                        }}
                        className="h-10 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Percent className="w-4 h-4" /> Discount / Adjust
                      </button>
                    </div>
                  </div>
                  {/* Quick pay buttons */}
                  <div className="flex gap-1.5 flex-wrap">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setPaymentAmount(String(Math.round(ledger.summary.balance * pct * 100) / 100))}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                      >
                        {pct === 1 ? 'Full' : `${pct * 100}%`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                      {/* CL-10: progressive disclosure — render only the
                          first `displayCap` rows on screen to keep the DOM
                          light for 1000+ entry ledgers. Print view always
                          renders all rows (so an accountant printing the
                          full ledger gets every entry on paper). */}
                      {ledger.entries.slice(0, displayCap).map((entry, i) => (
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
                      {/* Hidden print-only block: render the remaining rows
                          so window.print() includes every entry. The screen
                          view shows only `displayCap` rows. */}
                      {ledger.entries.length > displayCap && (
                        <>
                          {ledger.entries.slice(displayCap).map((entry, i) => (
                            <tr
                              key={`p-${i}`}
                              className="border-b border-gray-50 last:border-0 hidden print:table-row"
                            >
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
                        </>
                      )}
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
                {/* CL-10: "Show more" footer — only visible when the ledger
                    has more rows than the current cap. Doubles the cap on
                    each click. Hidden in print (print shows everything). */}
                {ledger.entries.length > displayCap && (
                  <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 print:hidden">
                    <p className="text-xs text-gray-500">
                      Showing {displayCap} of {ledger.entries.length} entries
                    </p>
                    <button
                      onClick={() => setDisplayCap((c) => Math.min(c * 2, ledger.entries.length))}
                      className="h-8 px-4 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-colors"
                    >
                      Show {Math.min(displayCap, ledger.entries.length - displayCap)} more
                    </button>
                  </div>
                )}
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
                {actionMode === 'discount'
                  ? (isCustomer ? 'Adjust Discount' : 'Adjust Discount')
                  : (isCustomer ? 'Receive Payment' : 'Pay Supplier')}
              </h3>
              <button onClick={() => setShowPayment(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-4">
              <button
                onClick={() => setActionMode('payment')}
                className={cn(
                  'flex-1 h-8 rounded-lg text-xs font-semibold transition-colors',
                  actionMode === 'payment' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'
                )}
              >
                {isCustomer ? 'Receive Payment' : 'Pay Supplier'}
              </button>
              <button
                onClick={() => setActionMode('discount')}
                className={cn(
                  'flex-1 h-8 rounded-lg text-xs font-semibold transition-colors',
                  actionMode === 'discount' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'
                )}
              >
                Discount / Adjust
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

              {actionMode === 'payment' && (
                <PaymentMethodSelector
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  label="Payment Method"
                />
              )}

              {actionMode === 'discount' && (
                <div className="bg-violet-50 rounded-xl p-3 text-xs text-violet-700">
                  Discount reduces the {isCustomer ? "customer's due" : "amount we owe"} without actual payment.
                  The adjustment will appear in the ledger as [DISCOUNT].
                </div>
              )}

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
