'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import type { CCTVMushakInvoice } from '../types';
import { printThermalReceipt } from './ThermalReceipt';

const BUSINESS_ID = 'bus_placeholder';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export function CCTVMushakInvoiceDetail() {
  const { contextId, goBack } = useCCTVNavStore();
  const [invoice, setInvoice] = useState<CCTVMushakInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contextId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/businesses/${BUSINESS_ID}/cctv/mushak-invoices/${contextId}`);
        const json = await res.json();
        if (json.success) setInvoice(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contextId]);

  const handlePrint = () => window.print();
  const handleThermalPrint = () => {
    if (!invoice) return;
    printThermalReceipt(invoice, '80mm');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="px-4 pt-4 text-center py-16">
        <p className="text-sm text-gray-500">Invoice not found</p>
        <button onClick={goBack} className="mt-3 text-violet-600 text-sm font-semibold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {/* Non-printable header */}
      <div className="print:hidden">
        <motion.div variants={fadeUp} initial="initial" animate="animate" className="flex items-center gap-3 mb-5">
          <button onClick={goBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</h1>
            <p className="text-xs text-gray-500">Mushak 6.3 Tax Invoice</p>
          </div>
          <button onClick={handlePrint} className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
            <Printer className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={handleThermalPrint} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors">
            <Printer className="w-4 h-4" />
            <span className="text-xs font-semibold">Thermal</span>
          </button>
        </motion.div>
      </div>

      {/* Print-ready invoice */}
      <div id="mushak-invoice" className="print:m-0 print:p-0">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">
          {/* ── Header ── */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-4 print:bg-white print:border-b-2 print:border-gray-800">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-base font-bold text-white print:text-black">MUSHAK 6.3</h1>
                <p className="text-xs text-violet-200 print:text-gray-600 mt-0.5">Tax Invoice (VAT)</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-white print:text-black">{invoice.invoiceNumber}</p>
                <p className="text-[10px] text-violet-200 print:text-gray-500 mt-0.5">
                  {new Date(invoice.issueDate).toLocaleDateString('en-BD', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* ── Buyer / Seller ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Seller */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Seller</p>
                <p className="text-xs font-semibold text-gray-900">{invoice.sellerName}</p>
                {invoice.sellerAddress && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{invoice.sellerAddress}</p>}
                {invoice.sellerBin && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    BIN: <span className="font-mono font-semibold text-gray-700">{invoice.sellerBin}</span>
                  </p>
                )}
              </div>
              {/* Buyer */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Buyer</p>
                <p className="text-xs font-semibold text-gray-900">{invoice.buyerName}</p>
                {invoice.buyerAddress && <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{invoice.buyerAddress}</p>}
                {invoice.buyerBin && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    BIN: <span className="font-mono font-semibold text-gray-700">{invoice.buyerBin}</span>
                  </p>
                )}
              </div>
            </div>

            {/* ── Items Table ── */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[28px_1fr_64px_36px_56px_52px_56px] gap-0 bg-gray-50 px-2.5 py-2 text-[9px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <span>#</span>
                <span>Description</span>
                <span className="text-right">HS Code</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">VAT</span>
                <span className="text-right">Total</span>
              </div>

              {/* Table rows */}
              {invoice.lineItems?.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[28px_1fr_64px_36px_56px_52px_56px] gap-0 px-2.5 py-2.5 text-[11px] border-b border-gray-100 last:border-b-0 items-baseline"
                >
                  <span className="text-gray-400 font-mono">{item.slNo}</span>
                  <span className="text-gray-800 font-medium truncate pr-1" title={item.productName}>{item.productName}</span>
                  <span className="text-right text-gray-500 font-mono text-[10px]">{item.hsCode || '-'}</span>
                  <span className="text-right text-gray-700 font-mono">{item.quantity}</span>
                  <span className="text-right text-gray-700 font-mono">{item.unitPrice.toFixed(0)}</span>
                  <span className="text-right text-violet-600 font-mono font-medium">{item.vatAmount.toFixed(0)}</span>
                  <span className="text-right text-gray-900 font-mono font-semibold">{item.totalPrice.toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* ── Totals ── */}
            <div className="space-y-1.5 text-right">
              {invoice.discountAmount > 0 && (
                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-gray-500">Discount</span>
                  <span className="text-xs font-mono text-red-500 font-medium">-৳{invoice.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <span className="text-xs text-gray-500">Subtotal</span>
                <span className="text-sm font-mono text-gray-900 font-semibold">৳{invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="text-xs text-gray-500">VAT</span>
                <span className="text-sm font-mono text-violet-600 font-semibold">৳{invoice.totalVat.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-end gap-3 pt-1.5 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                <span className="text-lg font-mono font-bold text-gray-900">৳{invoice.grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* ── Amount in Words ── */}
            {invoice.amountInWords && (
              <div className="bg-gray-50 rounded-lg px-3.5 py-2.5">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Amount in Words</p>
                <p className="text-xs text-gray-700 font-medium italic">{invoice.amountInWords}</p>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="grid grid-cols-2 gap-6 pt-3">
              <div className="text-center">
                <div className="border-t border-gray-300 pt-2 mt-8">
                  <p className="text-[10px] text-gray-500">Authorized Signature</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Seller</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-300 pt-2 mt-8">
                  <p className="text-[10px] text-gray-500">Received By</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Buyer</p>
                </div>
              </div>
            </div>

            {/* ── Legal Notice ── */}
            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-[9px] text-gray-400 leading-relaxed">
                This is a computer-generated Mushak 6.3 tax invoice under the Value Added Tax and Supplementary Duty Act, 2012.
                Generated on {new Date(invoice.createdAt).toLocaleDateString('en-BD', { day: '2-digit', month: 'long', year: 'numeric' })}.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          #mushak-invoice { padding: 0; margin: 0; }
        }
      `}</style>
    </div>
  );
}