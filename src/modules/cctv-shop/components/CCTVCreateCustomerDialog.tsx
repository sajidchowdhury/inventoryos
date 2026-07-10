'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, UserPlus, Phone, Mail, MapPin } from 'lucide-react';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

// ── Types ──

interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface CCTVCreateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// ── Constants ──

const emptyForm: CustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
};

// ── Component ──

export function CCTVCreateCustomerDialog({
  open,
  onClose,
  onSaved,
}: CCTVCreateCustomerDialogProps) {
  const businessId = useCctvBusinessId();
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setError('');
      setSuccess(false);
    }
  }, [open]);

  if (!open) return null;

  const updateField = (field: keyof CustomerForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const isValid = form.name.trim().length > 0;

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Customer name is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const payload: Record<string, string> = {
        name: form.name.trim(),
      };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.address.trim()) payload.address = form.address.trim();

      const res = await fetch(
        `/api/businesses/${businessId}/cctv/customers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create customer');
        return;
      }

      setSuccess(true);
      onSaved();

      // Brief success flash before closing
      setTimeout(() => {
        onClose();
      }, 600);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{ animation: 'ccSlideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-900">New Customer</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Customer Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Md. Karim"
                autoFocus
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="e.g. 01712345678"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="e.g. customer@example.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
              <textarea
                value={form.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="e.g. House 12, Road 5, Dhanmondi, Dhaka"
                rows={2}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all resize-none"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs px-3 py-2 rounded-xl font-medium">
              Customer created successfully!
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
            disabled={saving || !isValid}
            className="flex-1 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 active:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Create
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes ccSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}