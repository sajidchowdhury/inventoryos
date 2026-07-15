'use client';

import {
  Banknote, Landmark, Smartphone, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { value: 'bank', label: 'Bank', icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'bkash', label: 'bKash', icon: Smartphone, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  { value: 'nagad', label: 'Nagad', icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
}

export function PaymentMethodSelector({ value, onChange, label, compact = false }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs text-gray-600 font-medium">{label}</label>}
      <div className={cn('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}>
        {PAYMENT_METHODS.map((method) => {
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
