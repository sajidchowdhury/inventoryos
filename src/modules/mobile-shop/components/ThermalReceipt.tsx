'use client';

import { useCallback } from 'react';
import type { MSMushakInvoice, MSMushakLineItem } from '../types';
import { numberToWords } from '../types';

interface ThermalReceiptProps {
  invoice: MSMushakInvoice;
  width?: '58mm' | '80mm';
  /** Extra content to show at bottom (e.g. payment info) */
  footerExtra?: string;
}

/** Monospace widths for 58mm (32 chars) and 80mm (48 chars) thermal paper */
const LINE_CHARS: Record<string, number> = { '58mm': 32, '80mm': 48 };

function padRight(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function padLeft(s: string, n: number) {
  return s.length >= n ? s.slice(s.length - n) : ' '.repeat(n - s.length) + s;
}
function center(s: string, n: number) {
  const diff = n - s.length;
  if (diff <= 0) return s.slice(0, n);
  const left = Math.floor(diff / 2);
  return ' '.repeat(left) + s + ' '.repeat(diff - left);
}
function dashLine(n: number) {
  return '─'.repeat(n);
}
function formatBDT(n: number) {
  return '৳' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ThermalReceipt({ invoice, width = '80mm', footerExtra }: ThermalReceiptProps) {
  const W = LINE_CHARS[width];
  const fmt = useCallback((n: number) => formatBDT(n), []);

  const lines: { text: string; bold?: boolean; align?: 'left' | 'center' | 'right' }[] = [];

  // ── Header ──
  lines.push({ text: center(invoice.sellerName || 'CCTV Shop', W), bold: true, align: 'center' });
  if (invoice.sellerAddress) {
    // Split long addresses
    const addr = invoice.sellerAddress;
    if (addr.length <= W) {
      lines.push({ text: center(addr, W), align: 'center' });
    } else {
      const mid = Math.ceil(addr.length / 2);
      const spaceIdx = addr.lastIndexOf(' ', mid);
      const splitAt = spaceIdx > 0 ? spaceIdx : mid;
      lines.push({ text: center(addr.slice(0, splitAt), W), align: 'center' });
      lines.push({ text: center(addr.slice(splitAt + 1), W), align: 'center' });
    }
  }
  if (invoice.sellerBin) {
    lines.push({ text: `BIN: ${invoice.sellerBin}`, align: 'center' });
  }
  lines.push({ text: dashLine(W) });

  // ── Invoice Info ──
  lines.push({ text: `Invoice: ${invoice.invoiceNumber}`, bold: true });
  lines.push({ text: `Date:    ${new Date(invoice.issueDate).toLocaleDateString('en-BD')}` });
  lines.push({ text: `Time:    ${new Date(invoice.issueDate).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}` });
  if (invoice.tradeLicenseNo) {
    lines.push({ text: `License: ${invoice.tradeLicenseNo}` });
  }
  lines.push({ text: '' });

  // ── Buyer ──
  lines.push({ text: `Customer: ${invoice.buyerName}`, bold: true });
  if (invoice.buyerAddress) lines.push({ text: `Address:  ${invoice.buyerAddress}` });
  if (invoice.buyerBin) lines.push({ text: `BIN:      ${invoice.buyerBin}` });
  lines.push({ text: '' });
  lines.push({ text: dashLine(W) });

  // ── Items ──
  lines.push({ text: 'Item', bold: true });
  lines.push({ text: padRight('Description', W - 14) + padLeft('Qty', 4) + padLeft('Rate', 10), bold: true });
  lines.push({ text: dashLine(W) });

  for (const item of invoice.lineItems || []) {
    const name = item.productName;
    // First line: name + qty + price
    const qtyRate = padLeft(`${item.quantity} x ${fmt(item.unitPrice)}`, 14);
    if (name.length <= W - 14) {
      lines.push({ text: padRight(name, W - 14) + qtyRate });
    } else {
      lines.push({ text: name.slice(0, W) });
      lines.push({ text: padRight('', W - 14) + qtyRate });
    }
    // Second line: HS code + VAT + total
    const hs = item.hsCode || '-';
    const vatLabel = `${item.vatRate}% VAT`;
    const totalLabel = fmt(item.totalPrice);
    lines.push({ text: padRight(`  HS:${hs}  ${vatLabel}`, W - totalLabel.length) + totalLabel });
    // Warranty display
    if (item.warrantyMonths && item.warrantyMonths > 0) {
      lines.push({ text: `  Warranty: ${item.warrantyMonths} months` });
      if (item.warrantyEnd) {
        lines.push({ text: `  Expires: ${new Date(item.warrantyEnd).toLocaleDateString('en-BD')}` });
      }
    }
    lines.push({ text: '' });
  }

  lines.push({ text: dashLine(W) });

  // ── Totals ──
  lines.push({ text: padRight('Subtotal', W - fmt(invoice.subtotal).length) + fmt(invoice.subtotal) });
  if (invoice.discountAmount > 0) {
    lines.push({ text: padRight('Discount', W - fmt(invoice.discountAmount).length) + '-' + fmt(invoice.discountAmount) });
  }
  lines.push({ text: padRight('VAT', W - fmt(invoice.totalVat).length) + fmt(invoice.totalVat) });
  lines.push({ text: '' });
  lines.push({ text: padRight('GRAND TOTAL', W - fmt(invoice.grandTotal).length) + fmt(invoice.grandTotal), bold: true });
  lines.push({ text: '' });

  // ── Amount in words ──
  if (invoice.amountInWords) {
    lines.push({ text: center(invoice.amountInWords, W), align: 'center' });
    lines.push({ text: '' });
  }

  lines.push({ text: dashLine(W) });

  // ── Footer ──
  if (footerExtra) {
    footerExtra.split('\n').forEach((line) => lines.push({ text: center(line, W), align: 'center' }));
    lines.push({ text: '' });
  }
  lines.push({ text: center('Thank you for your purchase!', W), align: 'center', bold: true });
  lines.push({ text: center('ধন্যবাদ', W), align: 'center' }); // Bengali thank you
  lines.push({ text: '' });
  lines.push({ text: center('Computer-generated Mushak 6.3', W), align: 'center' });
  lines.push({ text: center('VAT & SD Act, 2012', W), align: 'center' });

  return (
    <div className="thermal-receipt thermal-receipt--${width}" style={{ fontFamily: "'Noto Sans Bengali', 'Courier New', monospace" }}>
      <div className="thermal-receipt__content">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`thermal-receipt__line ${line.bold ? 'thermal-receipt__line--bold' : ''} ${
              line.align === 'center' ? 'thermal-receipt__line--center' : line.align === 'right' ? 'thermal-receipt__line--right' : ''
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Trigger thermal print. Opens a new window with receipt content styled for 58mm/80mm paper. */
export function printThermalReceipt(
  invoice: MSMushakInvoice,
  width: '58mm' | '80mm' = '80mm',
  footerExtra?: string
) {
  const printWindow = window.open('', '_blank', 'width=400,height=700');
  if (!printWindow) {
    alert('Please allow popups to print receipts.');
    return;
  }

  const W = LINE_CHARS[width];
  const mmWidth = width === '58mm' ? 58 : 80;

  // Build plain text receipt
  let text = '';
  text += center(invoice.sellerName || 'CCTV Shop', W) + '\n';
  if (invoice.sellerAddress) text += center(invoice.sellerAddress, W) + '\n';
  if (invoice.sellerBin) text += center(`BIN: ${invoice.sellerBin}`, W) + '\n';
  text += dashLine(W) + '\n';
  text += `Invoice: ${invoice.invoiceNumber}\n`;
  text += `Date:    ${new Date(invoice.issueDate).toLocaleDateString('en-BD')}\n`;
  text += `Time:    ${new Date(invoice.issueDate).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}\n\n`;
  text += `Customer: ${invoice.buyerName}\n`;
  if (invoice.buyerBin) text += `BIN:      ${invoice.buyerBin}\n`;
  text += '\n' + dashLine(W) + '\n';

  for (const item of invoice.lineItems || []) {
    text += `${item.productName}\n`;
    text += `  ${item.quantity} x ${formatBDT(item.unitPrice)} = ${formatBDT(item.totalPrice)}`;
    if (item.hsCode) text += `  HS:${item.hsCode}`;
    text += '\n';
    if (item.warrantyMonths && item.warrantyMonths > 0) {
      text += `  Warranty: ${item.warrantyMonths} months\n`;
      if (item.warrantyEnd) {
        text += `  Expires: ${new Date(item.warrantyEnd).toLocaleDateString('en-BD')}\n`;
      }
    }
    text += '\n';
  }

  text += dashLine(W) + '\n';
  text += padRight('Subtotal', W - formatBDT(invoice.subtotal).length) + formatBDT(invoice.subtotal) + '\n';
  if (invoice.discountAmount > 0) {
    text += padRight('Discount', W - formatBDT(invoice.discountAmount).length) + '-' + formatBDT(invoice.discountAmount) + '\n';
  }
  text += padRight('VAT', W - formatBDT(invoice.totalVat).length) + formatBDT(invoice.totalVat) + '\n\n';
  text += padRight('TOTAL', W - formatBDT(invoice.grandTotal).length) + formatBDT(invoice.grandTotal) + '\n\n';
  if (invoice.amountInWords) text += center(invoice.amountInWords, W) + '\n\n';
  text += dashLine(W) + '\n';
  if (footerExtra) text += center(footerExtra, W) + '\n\n';
  text += center('Thank you! / ধন্যবাদ', W) + '\n';
  text += center('Mushak 6.3 — VAT & SD Act, 2012', W) + '\n';

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${invoice.invoiceNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: ${mmWidth}mm auto;
      margin: 2mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans Bengali', 'Courier New', monospace;
      font-size: ${width === '58mm' ? '9px' : '11px'};
      line-height: 1.4;
      color: #000;
      width: ${mmWidth}mm;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
      font-size: inherit;
    }
  </style>
</head>
<body>
  <pre>${text}</pre>
  <script>window.onload = () => window.print(); window.onafterprint = () => window.close();</script>
</body>
</html>
  `);
  printWindow.document.close();
}