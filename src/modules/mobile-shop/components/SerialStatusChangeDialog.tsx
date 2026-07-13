'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, RefreshCw, Check } from 'lucide-react';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { cn } from '@/lib/utils';

// ── Types ──

interface SerialStatusChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item: {
    id: string;
    serialNumber: string;
    status: string;
    productName?: string;
    brand?: string | null;
  } | null;
}

// ── Status options with styling ──

const STATUS_OPTIONS: { value: string; label: string; color: string; bg: string; icon: string }[] = [
  { value: 'IN_STOCK', label: 'In Stock', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '📦' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200', icon: '🚚' },
  { value: 'SOLD', label: 'Sold', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '💰' },
  { value: 'INSTALLED', label: 'Installed', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: '🔧' },
  { value: 'IN_REPAIR', label: 'In Repair', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '🛠️' },
  { value: 'RETURNED', label: 'Returned', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '↩️' },
  { value: 'WARRANTY_ACTIVE', label: 'Warranty Active', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: '🛡️' },
  { value: 'WARRANTY_EXPIRED', label: 'Warranty Expired', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '⏰' },
  { value: 'DEFECTIVE', label: 'Defective', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '⚠️' },
  { value: 'DISPOSED', label: 'Disposed', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: '🗑️' },
  { value: 'CONSUMED', label: 'Consumed', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', icon: '🔩' },
];

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Component ──

export function SerialStatusChangeDialog({
  open,
  onClose,
  onSaved,
  item,
}: SerialStatusChangeDialogProps) {
  const businessId = useMSBusinessId();
  const [selected, setSelected] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && item) {
      setSelected(item.status);
      setNotes('');
      setError('');
      setSuccess(false);
    }
  }, [open, item]);

  if (!open || !item) return null;

  const isChanged = selected !== item.status;

  const handleSave = async () => {
    if (!isChanged) {
      setError('Select a different status');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/serial-items/${item.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: selected, notes: notes.trim() || undefined }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update status');
        return;
      }

      setSuccess(true);
      onSaved();

      setTimeout(() => {
        onClose();
      }, 500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentLabel = formatStatusLabel(item.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
        style={{ animation: 'sscSlideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Change Status</h2>
              <p className="text-[10px] text-gray-400 font-mono">{item.serialNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Current status */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Current</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">
              {currentLabel}
            </span>
            {item.brand && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{item.brand}</span>
              </>
            )}
          </div>
        </div>

        {/* Status grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = selected === opt.value;
              const isCurrent = opt.value === item.status;

              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (!isCurrent) {
                      setSelected(opt.value);
                      if (error) setError('');
                    }
                  }}
                  disabled={isCurrent && !isChanged}
                  className={cn(
                    'relative flex items-center gap-2 p-3 rounded-xl border text-left transition-all',
                    isSelected
                      ? cn(opt.bg, 'ring-2 ring-violet-400 ring-offset-1')
                      : isCurrent && !isChanged
                        ? 'bg-gray-50 border-gray-200 opacity-50'
                        : 'bg-white border-gray-100 hover:border-gray-200 active:scale-[0.97]',
                  )}
                >
                  <span className="text-base">{opt.icon}</span>
                  <div className="min-w-0">
                    <p className={cn('text-xs font-semibold', isSelected ? opt.color : 'text-gray-700')}>
                      {opt.label}
                    </p>
                    {isCurrent && (
                      <p className="text-[9px] text-gray-400">Current</p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for status change..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs px-3 py-2 rounded-xl font-medium">
              Status updated successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isChanged}
            className="flex-1 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 active:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Update
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes sscSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}