'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Save, Package } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const UNITS = ['piece', 'box', 'pair', 'set', 'roll', 'meter'];

export function CCTVProductForm() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    name: '', brand: '', model: '', sku: '', description: '',
    categoryId: '', costPrice: '', sellPrice: '', stock: '',
    unit: 'piece', minStock: '', serialTracked: false, warrantyMonths: '',
  });

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/categories`)
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [businessId]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.brand.trim()) {
      toast({ title: 'Name and brand are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          brand: form.brand.trim(),
          model: form.model.trim() || null,
          sku: form.sku.trim() || null,
          description: form.description.trim() || null,
          categoryId: form.categoryId || null,
          costPrice: parseFloat(form.costPrice) || 0,
          sellPrice: parseFloat(form.sellPrice) || 0,
          stock: parseInt(form.stock) || 0,
          unit: form.unit,
          minStock: parseInt(form.minStock) || 0,
          serialTracked: form.serialTracked,
          warrantyMonths: parseInt(form.warrantyMonths) || 0,
        }),
      });
      if (res.ok) {
        toast({ title: 'Product created' });
        goBack();
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

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4 max-w-2xl">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Add Product</h1>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Package className="w-4 h-4 text-violet-500" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Basic Info</h2>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Product Name *</Label>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Hikvision DS-2CD2143G2" className="h-10 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Brand *</Label>
            <Input value={form.brand} onChange={(e) => update('brand', e.target.value)}
              placeholder="e.g. Hikvision" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Model</Label>
            <Input value={form.model} onChange={(e) => update('model', e.target.value)}
              placeholder="DS-2CD2143G2-I" className="h-10 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">SKU</Label>
            <Input value={form.sku} onChange={(e) => update('sku', e.target.value)}
              placeholder="HKV-2143" className="h-10 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Category</Label>
            <select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white">
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Description</Label>
          <Textarea value={form.description} onChange={(e) => update('description', e.target.value)}
            placeholder="Brief description" className="rounded-xl resize-none" rows={2} />
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-800">Pricing & Stock</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Cost Price (৳)</Label>
            <Input type="number" value={form.costPrice}
              onChange={(e) => update('costPrice', e.target.value)}
              placeholder="0" className="h-10 rounded-xl" min="0" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Sell Price (৳)</Label>
            <Input type="number" value={form.sellPrice}
              onChange={(e) => update('sellPrice', e.target.value)}
              placeholder="0" className="h-10 rounded-xl" min="0" step="0.01" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Stock (non-serial)</Label>
            <Input type="number" value={form.stock}
              onChange={(e) => update('stock', e.target.value)}
              placeholder="0" className="h-10 rounded-xl" min="0"
              disabled={form.serialTracked} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Min Stock Alert</Label>
            <Input type="number" value={form.minStock}
              onChange={(e) => update('minStock', e.target.value)}
              placeholder="0" className="h-10 rounded-xl" min="0" />
          </div>
        </div>
      </div>

      {/* Serial & Warranty */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-800">Serial & Warranty</h2>
        <div className="flex items-center justify-between py-1">
          <div>
            <Label className="text-xs text-gray-700 font-semibold">Serial Tracked</Label>
            <p className="text-[11px] text-gray-400 mt-0.5">Track each unit by serial number</p>
          </div>
          <Switch checked={form.serialTracked}
            onCheckedChange={(checked) => update('serialTracked', checked)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Unit</Label>
            <select value={form.unit} onChange={(e) => update('unit', e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white">
              {UNITS.map((u) => <option key={u} value={u} className="capitalize">{u}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Warranty (months)</Label>
            <Input type="number" value={form.warrantyMonths}
              onChange={(e) => update('warrantyMonths', e.target.value)}
              placeholder="0" className="h-10 rounded-xl" min="0" />
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Create Product'}
      </button>
    </motion.div>
  );
}
