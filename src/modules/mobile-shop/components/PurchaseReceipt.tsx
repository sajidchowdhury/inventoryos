'use client';

import { useCallback } from 'react';
import type { MSPurchase, MSPurchaseItem } from '../types';

interface PurchaseReceiptProps {
  purchase: MSPurchase;
  width?: '58mm' | '80mm';
  /** Serial numbers for serial-tracked items (productId -> serials[]) */
  serialResults?: { productId: string; productName: string; serialNumbers?: string[] }[];
  /** Extra content to show at bottom */
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

export function PurchaseReceipt({ purchase, width = '80mm', serialResults, footerExtra }: PurchaseReceiptProps) {
  const W = LINE_CHARS[width];
  const fmt = useCallback((n: number) => formatBDT(n), []);

  // Build serial number lookup
  const serialMap = new Map<string, string[]>();
  for (const sr of serialResults || []) {
    if (sr.serialNumbers && sr.serialNumbers.length > 0) {
      serialMap.set(sr.productId, sr.serialNumbers);
    }
  }

  const lines: { text: string; bold?: boolean; align?: 'left' | 'center' | 'right' }[] = [];

  // ── Header ──
  lines.push({ text: center('PURCHASE RECEIPT', W), bold: true, align: 'center' });
  lines.push({ text: dashLine(W) });

  // ── Purchase Info ──
  lines.push({ text: `PO:      ${purchase.purchaseNo}`, bold: true });
  lines.push({ text: `Date:    ${new Date(purchase.createdAt).toLocaleDateString('en-BD')}` });
  lines.push({ text: `Time:    ${new Date(purchase.createdAt).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}` });
  if (purchase.invoiceNo) {
    lines.push({ text: `Inv Ref: ${purchase.invoiceNo}` });
  }
  lines.push({ text: '' });

  // ── Supplier ──
  if (purchase.supplier) {
    lines.push({ text: `Supplier: ${purchase.supplier.name}`, bold: true });
    if (purchase.supplier.code) {
      lines.push({ text: `Code:    ${purchase.supplier.code}` });
    }
  } else {
    lines.push({ text: `Supplier: Walk-in / Unknown`, bold: true });
  }
  lines.push({ text: '' });
  lines.push({ text: dashLine(W) });

  // ── Items ──
  lines.push({ text: 'Item', bold: true });
  lines.push({ text: padRight('Description', W - 14) + padLeft('Qty', 4) + padLeft('Cost', 10), bold: true });
  lines.push({ text: dashLine(W) });

  for (const item of purchase.items || []) {
    const name = item.productBrand ? `${item.productName} (${item.productBrand})` : item.productName;
    const qtyCost = padLeft(`${item.quantity} x ${fmt(item.unitCost)}`, 14);
    if (name.length <= W - 14) {
      lines.push({ text: padRight(name, W - 14) + qtyCost });
    } else {
      lines.push({ text: name.slice(0, W) });
      lines.push({ text: padRight('', W - 14) + qtyCost });
    }
    // Serial numbers for this product
    const serials = serialMap.get(item.productId);
    if (serials && serials.length > 0) {
      for (const sn of serials) {
        lines.push({ text: `  SN: ${sn}` });
      }
    }
    const totalLabel = fmt(item.totalPrice);
    lines.push({ text: padRight('  Total:', W - totalLabel.length) + totalLabel });
    lines.push({ text: '' });
  }

  lines.push({ text: dashLine(W) });

  // ── Totals ──
  lines.push({ text: padRight('Subtotal', W - fmt(purchase.subtotal).length) + fmt(purchase.subtotal) });
  if (purchase.discountAmount > 0) {
    lines.push({ text: padRight('Discount', W - fmt(purchase.discountAmount).length) + '-' + fmt(purchase.discountAmount) });
  }
  lines.push({ text: '' });
  lines.push({ text: padRight('GRAND TOTAL', W - fmt(purchase.totalAmount).length) + fmt(purchase.totalAmount), bold: true });

  // ── Payment status ──
  lines.push({ text: '' });
  const statusLabel = purchase.paymentStatus === 'paid' ? 'PAID' : purchase.paymentStatus === 'partial' ? 'PARTIALLY PAID' : 'UNPAID';
  lines.push({ text: `Payment: ${statusLabel}`, bold: purchase.paymentStatus === 'paid' });
  if (purchase.paidAmount > 0 && purchase.paymentStatus !== 'paid') {
    lines.push({ text: `Paid:    ${fmt(purchase.paidAmount)}` });
    lines.push({ text: `Due:     ${fmt(purchase.totalAmount - purchase.paidAmount)}` });
  }

  if (purchase.notes) {
    lines.push({ text: '' });
    lines.push({ text: `Notes:   ${purchase.notes}` });
  }

  lines.push({ text: dashLine(W) });

  // ── Footer ──
  if (footerExtra) {
    footerExtra.split('\n').forEach((line) => lines.push({ text: center(line, W), align: 'center' }));
    lines.push({ text: '' });
  }
  lines.push({ text: center('Purchase Receipt', W), align: 'center' });
  lines.push({ text: center('ক্রয় রসিদ', W), align: 'center' }); // Bengali: Purchase Receipt
  lines.push({ text: '' });
  lines.push({ text: center('Computer-generated document', W), align: 'center' });

  return (
    <div className="thermal-receipt" style={{ fontFamily: "'Noto Sans Bengali', 'Courier New', monospace" }}>
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

/** Trigger thermal print for purchase receipt. Opens a new window with receipt content styled for 58mm/80mm paper. */
export function printPurchaseReceipt(
  purchase: MSPurchase,
  width: '58mm' | '80mm' = '80mm',
  serialResults?: { productId: string; productName: string; serialNumbers?: string[] }[],
  footerExtra?: string
) {
  const printWindow = window.open('', '_blank', 'width=400,height=700');
  if (!printWindow) {
    alert('Please allow popups to print receipts.');
    return;
  }

  const W = LINE_CHARS[width];
  const mmWidth = width === '58mm' ? 58 : 80;

  // Build serial number lookup
  const serialMap = new Map<string, string[]>();
  for (const sr of serialResults || []) {
    if (sr.serialNumbers && sr.serialNumbers.length > 0) {
      serialMap.set(sr.productId, sr.serialNumbers);
    }
  }

  // Build plain text receipt
  let text = '';
  text += center('PURCHASE RECEIPT', W) + '\n';
  text += dashLine(W) + '\n';
  text += `PO:      ${purchase.purchaseNo}\n`;
  text += `Date:    ${new Date(purchase.createdAt).toLocaleDateString('en-BD')}\n`;
  text += `Time:    ${new Date(purchase.createdAt).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}\n`;
  if (purchase.invoiceNo) text += `Inv Ref: ${purchase.invoiceNo}\n`;
  text += '\n';
  if (purchase.supplier) {
    text += `Supplier: ${purchase.supplier.name}\n`;
  } else {
    text += `Supplier: Walk-in / Unknown\n`;
  }
  text += '\n' + dashLine(W) + '\n';

  for (const item of purchase.items || []) {
    const name = item.productBrand ? `${item.productName} (${item.productBrand})` : item.productName;
    text += `${name}\n`;
    text += `  ${item.quantity} x ${formatBDT(item.unitCost)} = ${formatBDT(item.totalPrice)}\n`;
    const serials = serialMap.get(item.productId);
    if (serials && serials.length > 0) {
      for (const sn of serials) {
        text += `  SN: ${sn}\n`;
      }
    }
    text += '\n';
  }

  text += dashLine(W) + '\n';
  text += padRight('Subtotal', W - formatBDT(purchase.subtotal).length) + formatBDT(purchase.subtotal) + '\n';
  if (purchase.discountAmount > 0) {
    text += padRight('Discount', W - formatBDT(purchase.discountAmount).length) + '-' + formatBDT(purchase.discountAmount) + '\n';
  }
  text += '\n';
  text += padRight('TOTAL', W - formatBDT(purchase.totalAmount).length) + formatBDT(purchase.totalAmount) + '\n\n';

  const statusLabel = purchase.paymentStatus === 'paid' ? 'PAID' : purchase.paymentStatus === 'partial' ? 'PARTIALLY PAID' : 'UNPAID';
  text += `Payment: ${statusLabel}\n`;
  if (purchase.paidAmount > 0 && purchase.paymentStatus !== 'paid') {
    text += `Paid:    ${formatBDT(purchase.paidAmount)}\n`;
    text += `Due:     ${formatBDT(purchase.totalAmount - purchase.paidAmount)}\n`;
  }
  if (purchase.notes) text += `Notes:   ${purchase.notes}\n`;

  text += '\n' + dashLine(W) + '\n';
  if (footerExtra) text += center(footerExtra, W) + '\n\n';
  text += center('Purchase Receipt / ক্রয় রসিদ', W) + '\n';

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${purchase.purchaseNo}</title>
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
