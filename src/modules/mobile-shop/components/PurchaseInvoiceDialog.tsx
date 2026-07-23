'use client';

import { motion } from 'framer-motion';
import { Printer, X } from 'lucide-react';
import type { MSPurchase } from '../types';
import { PurchaseReceipt, printPurchaseReceipt } from './PurchaseReceipt';

interface PurchaseInvoiceDialogProps {
  purchase: MSPurchase;
  serialResults?: { productId: string; productName: string; created: number; method: string; serialNumbers?: string[] }[];
  open: boolean;
  onClose: () => void;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function PurchaseInvoiceDialog({ purchase, serialResults, open, onClose }: PurchaseInvoiceDialogProps) {
  if (!open) return null;

  const handlePrint = () => {
    printPurchaseReceipt(purchase, '80mm', serialResults);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        {...fadeUp}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Purchase Invoice</h2>
            <p className="text-sm text-gray-500">{purchase.purchaseNo}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Receipt preview */}
        <div className="p-5 overflow-y-auto max-h-[60vh] bg-gray-50">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <PurchaseReceipt purchase={purchase} width="80mm" serialResults={serialResults} />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-medium text-sm transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
