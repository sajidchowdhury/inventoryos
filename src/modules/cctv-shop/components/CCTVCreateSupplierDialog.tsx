'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';

interface SupplierForm {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  code: string;
  notes: string;
}

interface CCTVCreateSupplierDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: {
    id: string;
    name: string;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    code?: string | null;
    notes?: string | null;
  } | null;
}

const emptyForm: SupplierForm = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  code: '',
  notes: '',
};

export function CCTVCreateSupplierDialog({
  open,
  onClose,
  onSaved,
  editData,
}: CCTVCreateSupplierDialogProps) {
  const businessId = useCctvBusinessId();
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          name: editData.name || '',
          contactPerson: editData.contactPerson || '',
          phone: editData.phone || '',
          email: editData.email || '',
          address: editData.address || '',
          code: editData.code || '',
          notes: editData.notes || '',
        });
      } else {
        setForm(emptyForm);
      }
      setError('');
    }
  }, [open, editData]);

  if (!open) return null;

  const updateField = (field: keyof SupplierForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Supplier name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = isEdit
        ? `/api/businesses/${businessId}/suppliers/${editData!.id}`
        : `/api/businesses/${businessId}/suppliers`;

      const method = isEdit ? 'PUT' : 'POST';
      const payload: Record<string, string> = { name: form.name.trim() };
      if (form.contactPerson.trim()) payload.contactPerson = form.contactPerson.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.code.trim()) payload.code = form.code.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Failed to ${isEdit ? 'update' : 'create'} supplier`);
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Supplier' : 'New Supplier'}
          </h2>
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
              Supplier Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Hikvision Bangladesh"
              className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Supplier Code
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
              placeholder="Auto-generated if empty"
              className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Contact Person
            </label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => updateField('contactPerson', e.target.value)}
              placeholder="e.g. Md. Rahim"
              className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="e.g. 01712345678"
              className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="e.g. supplier@example.com"
              className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Address
            </label>
            <textarea
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="e.g. 45 Elephant Road, Dhaka"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold active:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 active:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Update' : 'Create'}
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}