'use client';

import {
  Banknote, Landmark, Smartphone, Wallet, CreditCard, FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { value: 'bank', label: 'Bank', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'bkash', label: 'bKash', icon: Smartphone, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  { value: 'nagad', label: 'Nagad', icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  // PM-7: added card (POS terminal) and cheque for Bangladesh CCTV shops.
  { value: 'card', label: 'Card', icon: CreditCard, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { value: 'cheque', label: 'Cheque', icon: FileCheck, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
  /** ST-9: optional list of active method codes. If provided, only those
   * methods are shown. If undefined, all 6 methods are shown (backward
   * compat). If `value` is not in `activeMethods`, it still shows so the
   * user can see the current selection — but they can't switch to a
   * method that's not active. */
  activeMethods?: string[];
}

export function PaymentMethodSelector({ value, onChange, label, compact = false, activeMethods }: PaymentMethodSelectorProps) {
  // ST-9: filter the list to active methods. If activeMethods is undefined,
  // show all (backward compat). Always include the current `value` so the
  // user can see what's selected even if it was deactivated since the last
  // payment.
  const visibleMethods = activeMethods
    ? PAYMENT_METHODS.filter((m) => activeMethods.includes(m.value) || m.value === value)
    : PAYMENT_METHODS;

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs text-gray-600 font-medium">{label}</label>}
      {/* PM-7: 6 methods now — use grid-cols-3 on larger screens for a tidy 2-row layout */}
      <div className={cn('grid gap-2', compact ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
        {visibleMethods.map((method) => {
          const Icon = method.icon;
          const isSelected = value === method.value;
          return (
            <button
              key={method.value}
              type="button"
              onClick={() => onChange(method.value)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl border-2 transition-all active:scale-95',
                compact ? 'h-9 px-2' : 'h-11 px-3',
                isSelected
                  ? `${method.bg} ${method.border} ${method.color}`
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              )}
            >
              <Icon className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              <span className={cn('font-semibold', compact ? 'text-[10px]' : 'text-xs')}>{method.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
