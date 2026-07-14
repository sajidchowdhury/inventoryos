'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, User, Building2, Phone, Plus, Search, CheckCircle2, MapPin,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Party {
  id: string;
  name: string;
  phone: string;
}

interface QuickPartyDialogProps {
  type: 'customer' | 'supplier';
  open: boolean;
  onClose: () => void;
  onSelect: (party: Party) => void;
  existingParties: Party[];
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export function QuickPartyDialog({ type, open, onClose, onSelect, existingParties }: QuickPartyDialogProps) {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const isCustomer = type === 'customer';
  const label = isCustomer ? 'Customer' : 'Supplier';
  const apiPath = isCustomer ? 'customers' : 'suppliers';

  const filtered = existingParties.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/${apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim() || null,
        }),
      });
      if (res.ok) {
        const newParty = await res.json();
        toast({ title: `${label} created`, description: newParty.name });
        onSelect(newParty);
        // Reset
        setName('');
        setPhone('');
        setMode('select');
        setSearch('');
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setMode('select');
    setSearch('');
    setName('');
    setPhone('');
    setAddress('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {mode === 'select' ? `Select ${label}` : `New ${label}`}
              </h3>
              <button onClick={handleClose}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {mode === 'select' ? (
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${label.toLowerCase()} by name or phone...`}
                    className="h-10 rounded-xl pl-10 text-sm" autoFocus />
                </div>

                {/* List */}
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">
                        {search.trim() ? `No ${label.toLowerCase()}s match "${search}"` : `No ${label.toLowerCase()}s yet`}
                      </p>
                    </div>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelect(p);
                          handleClose();
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 transition-colors text-left"
                      >
                        <div className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                          isCustomer ? 'bg-blue-50' : 'bg-amber-50'
                        )}>
                          {isCustomer
                            ? <User className="w-4 h-4 text-blue-500" />
                            : <Building2 className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.phone || 'No phone'}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-gray-300" />
                      </button>
                    ))
                  )}
                </div>

                {/* Create new button */}
                <button
                  onClick={() => setMode('create')}
                  className="w-full h-11 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-violet-100 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create New {label}
                </button>
              </div>
            ) : (
              /* Create mode */
              <div className="space-y-4">
                <div className="bg-violet-50 rounded-xl p-3 text-xs text-violet-700">
                  Quick-create {label.toLowerCase()} with just name + phone. You can add address and other details later.
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">{label} Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()} name...`}
                    className="h-10 rounded-xl text-sm" autoFocus />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="h-10 rounded-xl pl-10 text-sm" type="tel" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Address (optional)</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Textarea value={address} onChange={(e) => setAddress(e.target.value)}
                      placeholder="House, road, area..."
                      className="rounded-xl pl-10 text-sm resize-none" rows={2} />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setMode('select')}
                    className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                    Back
                  </button>
                  <button onClick={handleCreate} disabled={saving || !name.trim()}
                    className="flex-1 h-11 rounded-xl bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {saving ? 'Creating...' : `Create ${label}`}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
