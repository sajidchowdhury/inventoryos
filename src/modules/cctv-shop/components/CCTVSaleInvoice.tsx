'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Printer, Camera } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// Convert number to words (simple version for BDT)
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 > 0 ? ' ' + ones[n % 10] : '');
  }

  function threeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    let str = '';
    if (h > 0) str += ones[h] + ' Hundred';
    if (r > 0) str += (h > 0 ? ' ' : '') + twoDigits(r);
    return str;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = '';
  if (integerPart >= 10000000) {
    words += threeDigits(Math.floor(integerPart / 10000000)) + ' Crore ';
  }
  const r1 = integerPart % 10000000;
  if (r1 >= 100000) {
    words += threeDigits(Math.floor(r1 / 100000)) + ' Lakh ';
  }
  const r2 = r1 % 100000;
  if (r2 >= 1000) {
    words += threeDigits(Math.floor(r2 / 1000)) + ' Thousand ';
  }
  const r3 = r2 % 1000;
  if (r3 > 0) {
    words += threeDigits(r3);
  }

  words = words.trim();
  if (decimalPart > 0) {
    words += ` and ${twoDigits(decimalPart)} Paisa`;
  }
  return words + ' Only';
}

export function CCTVSaleInvoice() {
  const { goBack, contextId } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId || !contextId) return;
    fetch(`/api/businesses/${businessId}/cctv/sales/${contextId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId, contextId]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!data || !data.sale) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500">Sale not found</p>
      </div>
    );
  }

  const { sale, customer, business, previousDue } = data;
  const subtotal = sale.subtotal || sale.totalAmount;
  const discount = sale.discount || 0;
  const totalAmount = sale.totalAmount;
  const totalQty = sale.items.reduce((s: number, item: any) => s + item.quantity, 0);
  const totalDue = previousDue + totalAmount - sale.paidAmount;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header — hidden on print */}
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Sale Invoice</h1>
        <button onClick={handlePrint}
          className="ml-auto h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
          <Printer className="w-4 h-4" /> Print Invoice
        </button>
      </div>

      {/* Printable Invoice */}
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none print:max-w-none">
        {/* ── Invoice Header ── */}
        <div className="border-b-2 border-gray-800 p-6">
          <div className="flex items-start justify-between gap-6">
            {/* Shop info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 uppercase">{business?.name || 'CCTV Shop'}</h1>
                  <p className="text-[10px] text-gray-500">CCTV & Security Solutions</p>
                </div>
              </div>
              <p className="text-xs text-gray-600">{business?.address || ''}</p>
              <p className="text-xs text-gray-600">
                Mobile: {business?.phone || '—'}
              </p>
            </div>

            {/* Invoice meta */}
            <div className="text-right shrink-0">
              <h2 className="text-2xl font-bold text-gray-900 uppercase mb-1">Sales Invoice</h2>
              <table className="text-xs ml-auto">
                <tbody>
                  <tr>
                    <td className="pr-2 text-gray-500 text-right">Invoice No.</td>
                    <td className="font-bold text-gray-900 text-left">{sale.invoiceNo || sale.id.slice(-12).toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-gray-500 text-right">Date</td>
                    <td className="font-semibold text-gray-900 text-left">{formatDate(sale.saleDate)}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-gray-500 text-right">Entry Time</td>
                    <td className="text-gray-700 text-left">{formatDateTime(sale.saleDate)}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-gray-500 text-right">Bill Status</td>
                    <td className="text-left">
                      <span className={cn(
                        'font-bold',
                        sale.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600'
                      )}>
                        {sale.dueAmount > 0 ? 'Due' : 'Paid'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Customer Info ── */}
        <div className="border-b border-gray-200 p-6">
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="w-1/4 text-gray-500 font-semibold">Customer :</td>
                <td className="w-1/4 font-semibold text-gray-900">{customer?.name || sale.customerName || 'Walk-in Customer'}</td>
                <td className="w-1/4 text-gray-500 font-semibold">Prepared By :</td>
                <td className="w-1/4 text-gray-700">System</td>
              </tr>
              <tr>
                <td className="text-gray-500 font-semibold">Address :</td>
                <td className="text-gray-700">{customer?.address || '—'}</td>
                <td className="text-gray-500 font-semibold">Payment Date :</td>
                <td className="text-gray-700">{sale.paidAmount > 0 ? formatDate(sale.saleDate) : '—'}</td>
              </tr>
              <tr>
                <td className="text-gray-500 font-semibold">Mobile :</td>
                <td className="text-gray-700">{customer?.phone || '—'}</td>
                <td className="text-gray-500 font-semibold">Sales Person :</td>
                <td className="text-gray-700">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Items Table ── */}
        <div className="p-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-y border-gray-300">
                <th className="text-left p-2 font-bold text-gray-700 border-r border-gray-300 w-8">SL</th>
                <th className="text-left p-2 font-bold text-gray-700 border-r border-gray-300">Product Description</th>
                <th className="text-center p-2 font-bold text-gray-700 border-r border-gray-300 w-16">Warranty</th>
                <th className="text-center p-2 font-bold text-gray-700 border-r border-gray-300 w-12">Qty</th>
                <th className="text-right p-2 font-bold text-gray-700 border-r border-gray-300 w-20">Unit Price</th>
                <th className="text-right p-2 font-bold text-gray-700 w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item: any, idx: number) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="p-2 text-center text-gray-600 border-r border-gray-100">{idx + 1}</td>
                  <td className="p-2 text-gray-800 border-r border-gray-100">
                    <p className="font-medium">{item.productName}</p>
                    {item.serialNumber && (
                      <p className="text-[10px] text-gray-500 font-mono">S/N: {item.serialNumber}</p>
                    )}
                  </td>
                  <td className="p-2 text-center text-gray-600 border-r border-gray-100">—</td>
                  <td className="p-2 text-center text-gray-700 border-r border-gray-100">{item.quantity.toFixed(2)}</td>
                  <td className="p-2 text-right text-gray-700 border-r border-gray-100">{formatBDT(item.sellPrice)}</td>
                  <td className="p-2 text-right font-semibold text-gray-900">{formatBDT(item.sellPrice * item.quantity)}</td>
                </tr>
              ))}
              {/* Fill empty rows for professional look */}
              {sale.items.length < 8 && Array.from({ length: 8 - sale.items.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-100 h-8">
                  <td className="border-r border-gray-100"></td>
                  <td className="border-r border-gray-100"></td>
                  <td className="border-r border-gray-100"></td>
                  <td className="border-r border-gray-100"></td>
                  <td className="border-r border-gray-100"></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals Section ── */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Amount in words */}
            <div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 font-semibold uppercase">Taka In Word</p>
                <p className="text-xs font-semibold text-gray-800 mt-1">
                  {numberToWords(totalAmount)}
                </p>
              </div>
              {sale.notes && (
                <div className="mt-3">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Narration</p>
                  <p className="text-xs text-gray-600 mt-1">{sale.notes}</p>
                </div>
              )}
            </div>

            {/* Right: Totals table */}
            <div>
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-600">Total Qty :</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">{totalQty.toFixed(2)}</td>
                    <td className="py-1.5 pl-3 text-gray-600">Total Amount</td>
                    <td className="py-1.5 text-right font-bold text-gray-900">{formatBDT(subtotal)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5"></td>
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-3 text-gray-600">Less Discount</td>
                    <td className="py-1.5 text-right font-semibold text-red-600">{formatBDT(discount)}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5"></td>
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-3 text-gray-600">Add VAT & AIT</td>
                    <td className="py-1.5 text-right text-gray-500">{formatBDT(0)}</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300">
                    <td className="py-1.5"></td>
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-3 font-bold text-gray-700">Net Payable Amount</td>
                    <td className="py-1.5 text-right font-bold text-gray-900 text-sm">{formatBDT(totalAmount)}</td>
                  </tr>
                  {previousDue > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-1.5"></td>
                      <td className="py-1.5"></td>
                      <td className="py-1.5 pl-3 text-gray-600">Previous Due Amount</td>
                      <td className="py-1.5 text-right font-semibold text-red-600">{formatBDT(previousDue)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5"></td>
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-3 font-bold text-gray-700">Total Due Amount</td>
                    <td className="py-1.5 text-right font-bold text-red-600">{formatBDT(Math.max(0, totalDue))}</td>
                  </tr>
                  <tr className="border-b-2 border-gray-300">
                    <td className="py-1.5"></td>
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-3 text-gray-600">Received Amount</td>
                    <td className="py-1.5 text-right font-semibold text-emerald-600">{formatBDT(sale.paidAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5"></td>
                    <td className="py-1.5"></td>
                    <td className="py-1.5 pl-3 font-bold text-gray-700">Closing Balance</td>
                    <td className="py-1.5 text-right font-bold text-gray-900">{formatBDT(Math.max(0, totalDue))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Signature Section ── */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-6 pt-8 border-t border-gray-200">
            <div className="text-center">
              <div className="border-t border-gray-400 pt-1 mt-12">
                <p className="text-xs text-gray-600 font-semibold">Customer Signature</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-1 mt-12">
                <p className="text-xs text-gray-600 font-semibold">Authorised Signature</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span>This is a computer generated invoice.</span>
            <span>Print Date & Time: {formatDateTime(new Date())}</span>
          </div>
        </div>
      </div>

      {/* Helper text — hidden on print */}
      <p className="text-center text-xs text-gray-400 print:hidden">
        Tap "Print Invoice" to print or save as PDF. Uses your browser's print dialog.
      </p>
    </motion.div>
  );
}
