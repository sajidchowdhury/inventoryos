'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RotateCcw, Loader2, Check, AlertCircle, Package, Hash,
  Banknote, CreditCard, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type {
  CCTVSale, CCTVSaleItem, RefundMethod, SerialRestoreStatus,
} from '../types';
import { useCctvBusinessId } from '../hooks/use-cctv-business-id';
import { useToast } from '@/hooks/use-toast';

const REFUND_METHODS: { value: RefundMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'CASH', label: 'Cash', icon: <Banknote className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'CARD', label: 'Card', icon: <CreditCard className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'BKASH', label: 'bKash', icon: <span className="text-xs font-bold">b</span>, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'NAGAD', label: 'Nagad', icon: <span className="text-xs font-bold">N</span>, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'ROCKET', label: 'Rocket', icon: <span className="text-xs font-bold">R</span>, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'STORE_CREDIT', label: 'Store Credit', icon: <CreditCard className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'NO_REFUND', label: 'No Refund', icon: <X className="w-4 h-4" />, color: 'bg-gray-100 text-gray-500 border-gray-200' },
];

const RETURN_REASONS = [
  'Defective / DOA',
  'Wrong item delivered',
  'Customer changed mind',
  'Warranty claim',
  'Not as described',
  'Other',
];

const SERIAL_RESTORE_OPTIONS: { value: SerialRestoreStatus; label: string; desc: string }[] = [
  { value: 'RETURNED', label: 'Returned', desc: 'Mark as returned — not available for immediate resale' },
  { value: 'IN_STOCK', label: 'Back to Stock', desc: 'Restore to IN_STOCK — available for resale' },
];

const formatBDT = (n: number) => '\u09F3' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface ReturnItemState {
  saleItemId: string;
  selected: boolean;
  quantity: number;
  maxQuantity: number;
  refundAmount: number;
  serialItemId?: string;
  serialNumber?: string;
  serialRestoredTo: SerialRestoreStatus;
}

interface CCTVReturnDialogProps {
  sale: CCTVSale;
  open: boolean;
  onClose: () => void;
  onReturnSuccess: () => void;
}

export function CCTVReturnDialog({ sale, open, onClose, onReturnSuccess }: CCTVReturnDialogProps) {
  const businessId = useCctvBusinessId();
  const { toast } = useToast();

  // Item selection state
  const [itemStates, setItemStates] = useState<ReturnItemState[]>(() =>
    (sale.items || []).map((item: CCTVSaleItem) => ({
      saleItemId: item.id,
      selected: false,
      quantity: 1,
      maxQuantity: item.quantity,
      refundAmount: item.totalPrice,
      serialItemId: item.serialItemId || undefined,
      serialNumber: item.serialItem?.serialNumber,
      serialRestoredTo: 'RETURNED' as SerialRestoreStatus,
    }))
  );

  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedItems = itemStates.filter((i) => i.selected);
  const totalRefund = selectedItems.reduce((sum, i) => sum + i.refundAmount, 0);

  const toggleItem = (saleItemId: string) => {
    setItemStates((prev) =>
      prev.map((i) =>
        i.saleItemId === saleItemId ? { ...i, selected: !i.selected } : i
      )
    );
  };

  const updateQuantity = (saleItemId: string, qty: number) => {
    setItemStates((prev) =>
      prev.map((i) => {
        if (i.saleItemId !== saleItemId) return i;
        const clampedQty = Math.max(1, Math.min(qty, i.maxQuantity));
        const unitPrice = i.refundAmount / i.quantity;
        return { ...i, quantity: clampedQty, refundAmount: Math.round(unitPrice * clampedQty * 100) / 100 };
      })
    );
  };

  const updateRefundAmount = (saleItemId: string, amount: number) => {
    setItemStates((prev) =>
      prev.map((i) =>
        i.saleItemId === saleItemId
          ? { ...i, refundAmount: Math.max(0, amount) }
          : i
      )
    );
  };

  const updateSerialRestore = (saleItemId: string, status: SerialRestoreStatus) => {
    setItemStates((prev) =>
      prev.map((i) =>
        i.saleItemId === saleItemId
          ? { ...i, serialRestoredTo: status }
          : i
      )
    );
  };

  const handleReturn = async () => {
    if (selectedItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/sales/${sale.id}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((i) => ({
            saleItemId: i.saleItemId,
            quantity: i.quantity,
            refundAmount: i.refundAmount,
            serialItemId: i.serialItemId,
            serialRestoredTo: i.serialRestoredTo,
          })),
          refundMethod,
          refundReference: refundMethod !== 'CASH' && refundMethod !== 'NO_REFUND' ? refundReference.trim() || undefined : undefined,
          reason: reason || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Return Processed',
          description: `${data.return.returnCode} — ${formatBDT(data.return.refundAmount)} refunded`,
        });
        setShowConfirm(false);
        onReturnSuccess();
        onClose();
      } else {
        toast({
          title: 'Return Failed',
          description: data.error || 'Could not process return',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Return Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setItemStates((prev) =>
      prev.map((i) => ({ ...i, selected: false }))
    );
    setRefundMethod('CASH');
    setRefundReference('');
    setReason('');
    setNotes('');
    setShowConfirm(false);
    onClose();
  };

  return (
    <>
      <AlertDialog open={open && !showConfirm} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
        <AlertDialogContent className="max-w-[420px] max-h-[85vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 pt-5 pb-4 rounded-t-lg">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-white" />
                </div>
                <AlertDialogTitle className="text-white text-base">
                  Return Items
                </AlertDialogTitle>
              </div>
              <button onClick={resetAndClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <AlertDialogDescription className="text-white/70 text-xs">
              {sale.saleCode} · {sale.customerName}
            </AlertDialogDescription>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Item selection */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Select Items to Return</p>
              <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                {itemStates.map((item) => {
                  const saleItem = sale.items?.find((si) => si.id === item.saleItemId);
                  if (!saleItem) return null;

                  return (
                    <motion.div
                      key={item.saleItemId}
                      layout
                      className={cn(
                        'rounded-xl border p-3 transition-all cursor-pointer',
                        item.selected
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                      )}
                      onClick={() => toggleItem(item.saleItemId)}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Checkbox */}
                        <div className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                          item.selected ? 'bg-red-500 border-red-500' : 'border-gray-300'
                        )}>
                          {item.selected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {saleItem.productName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {saleItem.productBrand && (
                              <span className="text-[10px] text-gray-400">{saleItem.productBrand}</span>
                            )}
                            {item.serialNumber && (
                              <span className="flex items-center gap-0.5 text-[10px] text-violet-600 font-mono">
                                <Hash className="w-2.5 h-2.5" />
                                {item.serialNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-900">
                            {formatBDT(saleItem.unitPrice)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            ×{saleItem.quantity}
                          </p>
                        </div>
                      </div>

                      {/* Expanded options when selected */}
                      <AnimatePresence>
                        {item.selected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="mt-3 pt-3 border-t border-red-100 space-y-3">
                              {/* Quantity (non-serial only) */}
                              {!item.serialItemId && item.maxQuantity > 1 && (
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] text-gray-500 w-16 shrink-0">Qty</label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => updateQuantity(item.saleItemId, item.quantity - 1)}
                                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-sm"
                                    >-</button>
                                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                                    <button
                                      onClick={() => updateQuantity(item.saleItemId, item.quantity + 1)}
                                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-sm"
                                    >+</button>
                                  </div>
                                  <span className="text-[10px] text-gray-400">of {item.maxQuantity}</span>
                                </div>
                              )}

                              {/* Refund amount */}
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] text-gray-500 w-16 shrink-0">Refund</label>
                                <div className="relative flex-1">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">৳</span>
                                  <Input
                                    type="number"
                                    value={item.refundAmount || ''}
                                    onChange={(e) => updateRefundAmount(item.saleItemId, parseFloat(e.target.value) || 0)}
                                    className="h-8 rounded-lg pl-6 text-xs"
                                    min={0}
                                    max={saleItem.totalPrice}
                                  />
                                </div>
                              </div>

                              {/* Serial restore status (serial items only) */}
                              {item.serialItemId && (
                                <div>
                                  <label className="text-[11px] text-gray-500 mb-1.5 block">Restore Status</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {SERIAL_RESTORE_OPTIONS.map((opt) => (
                                      <button
                                        key={opt.value}
                                        onClick={() => updateSerialRestore(item.saleItemId, opt.value)}
                                        className={cn(
                                          'p-2 rounded-lg border text-left transition-all',
                                          item.serialRestoredTo === opt.value
                                            ? 'border-violet-300 bg-violet-50'
                                            : 'border-gray-200 bg-gray-50'
                                        )}
                                      >
                                        <p className={cn(
                                          'text-[11px] font-semibold',
                                          item.serialRestoredTo === opt.value ? 'text-violet-700' : 'text-gray-600'
                                        )}>
                                          {opt.label}
                                        </p>
                                        <p className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</p>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Return reason */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Reason</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Refund method */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Refund Method</label>
              <div className="grid grid-cols-4 gap-1.5">
                {REFUND_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { setRefundMethod(m.value); if (m.value === 'CASH' || m.value === 'NO_REFUND') setRefundReference(''); }}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center',
                      refundMethod === m.value
                        ? m.color + ' shadow-sm'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    )}
                  >
                    {m.icon}
                    <span className="text-[9px] font-semibold leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Refund reference (non-cash) */}
              {refundMethod !== 'CASH' && refundMethod !== 'NO_REFUND' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Ref. / Txn ID</label>
                  <Input
                    placeholder="Transaction reference"
                    value={refundReference}
                    onChange={(e) => setRefundReference(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Notes (optional)</label>
              <Input
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 rounded-xl text-xs"
              />
            </div>
          </div>

          {/* Footer with total */}
          <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50 space-y-3">
            {selectedItems.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
                </span>
                <span className="text-sm font-bold text-red-600">
                  Refund: {formatBDT(totalRefund)}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAndClose} className="flex-1 rounded-xl h-10">
                Cancel
              </Button>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={selectedItems.length === 0 || submitting}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold shadow-lg shadow-red-500/20 hover:from-red-600 hover:to-rose-600 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Confirm Return
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-[340px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Confirm Return
            </AlertDialogTitle>
            <AlertDialogDescription>
              Return {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} from{' '}
              <span className="font-semibold text-gray-900">{sale.saleCode}</span>?
              {totalRefund > 0 && (
                <span className="block mt-2 font-semibold text-red-600">
                  Refund: {formatBDT(totalRefund)} via {REFUND_METHODS.find((m) => m.value === refundMethod)?.label}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={submitting}>Go Back</AlertDialogCancel>
            <button
              onClick={handleReturn}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold flex items-center gap-2 hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Yes, Process Return
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}