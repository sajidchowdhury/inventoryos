'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, ShoppingCart, CalendarDays } from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

type RegisterTab = 'sales' | 'purchases';

interface RegisterRow {
  date: string;
  invoiceNumber?: string;
  chalanNo?: string;
  buyerName?: string;
  supplierName?: string;
  buyerBin?: string;
  supplierBin?: string;
  productName: string;
  hsCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  totalValue?: number;
  vatRate: number;
  vatAmount: number;
}

interface RegisterSummary {
  totalInvoices?: number;
  totalPurchases?: number;
  totalSaleValue: number;
  totalPurchaseValue: number;
  totalVat: number;
  totalTax: number;
  grandTotal: number;
}

export function MSMushakRegisters() {
  const { goBack } = useMSNavStore();
  const businessId = useMSBusinessId();
  const [tab, setTab] = useState<RegisterTab>('sales');
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [summary, setSummary] = useState<RegisterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const loadRegister = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const endpoint = tab === 'sales' ? 'sales' : 'purchases';
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/mushak-registers/${endpoint}?${params}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
        setSummary(json.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, fromDate, toDate]);

  useEffect(() => { loadRegister(); }, [loadRegister]);

  const handleExportCSV = () => {
    if (rows.length === 0) return;

    const isSales = tab === 'sales';
    const headers = isSales
      ? ['Date', 'Invoice #', 'Buyer Name', 'Buyer BIN', 'Product', 'HS Code', 'Qty', 'Unit Price', 'Total', 'VAT %', 'VAT Amount']
      : ['Date', 'Chalan #', 'Supplier', 'Supplier BIN', 'Product', 'HS Code', 'Qty', 'Unit Cost', 'Total', 'VAT %', 'VAT Amount'];

    const csvRows = rows.map((r) =>
      isSales
        ? [r.date, r.invoiceNumber || '', r.buyerName || '', r.buyerBin || '', r.productName, r.hsCode, r.quantity, r.unitPrice, r.totalPrice || 0, r.vatRate, r.vatAmount]
        : [r.date, r.chalanNo || '', r.supplierName || '', r.supplierBin || '', r.productName, r.hsCode, r.quantity, r.unitPrice, r.totalValue || 0, r.vatRate, r.vatAmount],
    );

    // Summary footer
    const totalVal = rows.reduce((s, r) => s + ((r.totalPrice || r.totalValue) || 0), 0);
    const totalVat = rows.reduce((s, r) => s + r.vatAmount, 0);
    csvRows.push([]);
    csvRows.push(['', '', '', '', '', '', '', 'TOTAL', totalVal.toFixed(2), '', totalVat.toFixed(2)]);

    const csvContent = [headers, ...csvRows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isSales ? `Mushak_6.2_Sales_Register_${today}.csv` : `Mushak_6.1_Purchase_Register_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBDT = (n: number) => `৳${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const isSales = tab === 'sales';

  return (
    <div className="px-4 pb-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-3 mb-5">
        <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Mushak Registers</h1>
          <p className="text-xs text-gray-500">NBR audit-ready purchase & sales registers</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </motion.div>

      {/* Tab Toggle */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('sales')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'sales' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <FileText className="w-4 h-4" />
          Mushak 6.2 (Sales)
        </button>
        <button
          onClick={() => setTab('purchases')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'purchases' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Mushak 6.1 (Purchase)
        </button>
      </motion.div>

      {/* Date Range Filter */}
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          max={toDate || today}
          className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          min={fromDate}
          max={today}
          className="flex-1 px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        />
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(''); setToDate(''); }}
            className="text-[10px] text-violet-600 font-semibold px-2 py-1 rounded-md bg-violet-50 hover:bg-violet-100 transition-colors"
          >
            Clear
          </button>
        )}
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {isSales ? 'Total Invoices' : 'Total Purchases'}
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {(summary.totalInvoices || summary.totalPurchases || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {isSales ? 'Sale Value' : 'Purchase Value'}
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatBDT(isSales ? summary.totalSaleValue : summary.totalPurchaseValue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {isSales ? 'VAT Collected' : 'Tax Paid'}
            </p>
            <p className="text-xl font-bold text-violet-600 mt-1">
              {formatBDT(isSales ? summary.totalVat : summary.totalTax)}
            </p>
          </div>
          <div className={`rounded-2xl border p-3.5 shadow-sm ${isSales ? 'bg-violet-50 border-violet-100' : 'bg-amber-50 border-amber-100'}`}>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Grand Total</p>
            <p className={`text-xl font-bold mt-1 ${isSales ? 'text-violet-700' : 'text-amber-700'}`}>
              {formatBDT(summary.grandTotal)}
            </p>
          </div>
        </motion.div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {isSales ? <FileText className="w-8 h-8 text-gray-300" /> : <ShoppingCart className="w-8 h-8 text-gray-300" />}
          </div>
          <p className="text-sm font-semibold text-gray-700">No {isSales ? 'Sales' : 'Purchase'} Records</p>
          <p className="text-xs text-gray-400 mt-1">
            {isSales
              ? 'Mushak 6.3 invoices will populate this register'
              : 'Received purchases will populate this register'}
          </p>
          {!fromDate && !toDate && (
            <button
              onClick={() => { setFromDate(thirtyDaysAgo); setToDate(today); }}
              className="mt-3 text-violet-600 text-xs font-semibold"
            >
              Show last 30 days
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className={`grid ${isSales ? 'grid-cols-[72px_1fr_52px_40px_44px_44px]' : 'grid-cols-[72px_1fr_52px_40px_44px_44px]'} gap-0 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[9px] font-semibold text-gray-500 uppercase tracking-wider`}>
              <span>Date</span>
              <span>{isSales ? 'Invoice / Buyer' : 'Chalan / Supplier'}</span>
              <span className="text-right">Qty</span>
              <span className="text-right">HS</span>
              <span className="text-right">Value</span>
              <span className="text-right">VAT</span>
            </div>

            {/* Rows */}
            <div className="max-h-96 overflow-y-auto">
              {rows.map((r, idx) => (
                <div
                  key={idx}
                  className={`grid ${isSales ? 'grid-cols-[72px_1fr_52px_40px_44px_44px]' : 'grid-cols-[72px_1fr_52px_40px_44px_44px]'} gap-0 px-3 py-2.5 text-[11px] border-b border-gray-50 items-baseline hover:bg-gray-50 transition-colors`}
                >
                  <span className="text-gray-400 font-mono text-[10px]">{r.date}</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">
                      {isSales ? (r.invoiceNumber || '') : (r.chalanNo || '')}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {r.productName}
                      {isSales && r.buyerName && ` → ${r.buyerName}`}
                      {!isSales && r.supplierName && ` → ${r.supplierName}`}
                    </p>
                    {(isSales ? r.buyerBin : r.supplierBin) && (
                      <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded font-mono">
                        BIN:{isSales ? r.buyerBin : r.supplierBin}
                      </span>
                    )}
                  </div>
                  <span className="text-right text-gray-700 font-mono">{r.quantity}</span>
                  <span className="text-right text-gray-400 font-mono text-[10px]">{r.hsCode || '-'}</span>
                  <span className="text-right text-gray-900 font-mono font-semibold">{((r.totalPrice || r.totalValue) || 0).toFixed(0)}</span>
                  <span className="text-right text-violet-600 font-mono font-medium">{r.vatAmount.toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Footer Total */}
            <div className={`grid ${isSales ? 'grid-cols-[72px_1fr_52px_40px_44px_44px]' : 'grid-cols-[72px_1fr_52px_40px_44px_44px]'} gap-0 px-3 py-2.5 bg-gray-50 border-t border-gray-200 text-[11px]`}>
              <span />
              <span className="font-semibold text-gray-700">{rows.length} items</span>
              <span className="text-right font-mono font-semibold text-gray-700">
                {rows.reduce((s, r) => s + r.quantity, 0)}
              </span>
              <span />
              <span className="text-right font-mono font-bold text-gray-900">
                {rows.reduce((s, r) => s + ((r.totalPrice || r.totalValue) || 0), 0).toFixed(0)}
              </span>
              <span className="text-right font-mono font-bold text-violet-600">
                {rows.reduce((s, r) => s + r.vatAmount, 0).toFixed(0)}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-3">
            {isSales ? 'Mushak 6.2' : 'Mushak 6.1'} — {isSales ? 'Sales' : 'Purchase'} Register
            {fromDate && ` from ${fromDate}`}
            {toDate && ` to ${toDate}`}
          </p>
        </motion.div>
      )}
    </div>
  );
}