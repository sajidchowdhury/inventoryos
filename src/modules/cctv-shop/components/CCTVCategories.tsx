'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Tag, Loader2, X, Trash2, Edit2, Package,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

const CATEGORY_COLORS = [
  { name: 'Violet', value: '#7c3aed', bg: 'bg-violet-100', text: 'text-violet-700' },
  { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-100', text: 'text-blue-700' },
  { name: 'Emerald', value: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { name: 'Amber', value: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700' },
  { name: 'Rose', value: '#f43f5e', bg: 'bg-rose-100', text: 'text-rose-700' },
  { name: 'Cyan', value: '#06b6d4', bg: 'bg-cyan-100', text: 'text-cyan-700' },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVCategories() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [icon, setIcon] = useState('Package');
  const [saving, setSaving] = useState(false);

  const loadCategories = () => {
    if (!businessId) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/categories`)
      .then((r) => r.json())
      .then((data) => {
        setCategories(data.categories || (Array.isArray(data) ? data : []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, [businessId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const url = `/api/businesses/${businessId}/cctv/categories`;
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId
        ? { name: name.trim(), color, icon }
        : { name: name.trim(), color, icon, slug: name.trim().toLowerCase().replace(/\s+/g, '-') };

      const res = await fetch(editingId ? `${url}/${editingId}` : url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: editingId ? 'Category updated' : 'Category created' });
        setShowForm(false);
        setName(''); setColor('#7c3aed'); setIcon('Package'); setEditingId(null);
        loadCategories();
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Products in it will be uncategorized.')) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Category deleted' });
        loadCategories();
      }
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon);
    setShowForm(true);
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Categories</h1>
        <button onClick={() => { setEditingId(null); setName(''); setColor('#7c3aed'); setShowForm(true); }}
          className="h-9 px-4 rounded-xl bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No categories yet</p>
          <p className="text-xs text-gray-400 mt-1">Create categories to organize your products</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((cat) => {
            const colorOption = CATEGORY_COLORS.find(c => c.value === cat.color) || CATEGORY_COLORS[0];
            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colorOption.bg)}>
                    <Tag className={cn('w-5 h-5', colorOption.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Package className="w-3 h-3" /> {cat._count?.products || 0} product(s)
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(cat)}
                      className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                      <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(cat.id)}
                      className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">
                  {editingId ? 'Edit Category' : 'New Category'}
                </h3>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Category Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cameras, NVRs, Cables..." className="h-10 rounded-xl text-sm" autoFocus />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                          c.bg,
                          color === c.value && 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        )}
                      >
                        <Tag className={cn('w-4 h-4', c.text)} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !name.trim()}
                  className="flex-1 h-11 rounded-xl bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
