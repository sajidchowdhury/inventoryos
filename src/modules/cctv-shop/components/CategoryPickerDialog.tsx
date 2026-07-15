'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Tag, Plus, Search, CheckCircle2, Package,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  _count?: { products: number };
}

interface CategoryPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (categoryId: string, categoryName: string) => void;
  categories: Category[];
  selectedId?: string;
}

const CATEGORY_COLORS = [
  '#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4',
];

export function CategoryPickerDialog({
  open,
  onClose,
  onSelect,
  categories,
  selectedId,
}: CategoryPickerDialogProps) {
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const filtered = categories.filter((c) => {
    if (!search.trim()) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          icon: 'Package',
          slug: newName.trim().toLowerCase().replace(/\s+/g, '-'),
        }),
      });
      if (res.ok) {
        const cat = await res.json();
        toast({ title: 'Category created', description: cat.name });
        onSelect(cat.id, cat.name);
        setNewName('');
        setShowCreate(false);
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
    setSearch('');
    setShowCreate(false);
    setNewName('');
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
                {showCreate ? 'New Category' : 'Select Category'}
              </h3>
              <button onClick={handleClose}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {showCreate ? (
              /* Create mode */
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Category Name *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Cameras, NVRs, Cables..."
                    className="h-10 rounded-xl text-sm" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          'w-9 h-9 rounded-xl transition-all',
                          newColor === c && 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                        )}
                        style={{ backgroundColor: c }}
                      >
                        {newColor === c && <CheckCircle2 className="w-4 h-4 text-white mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowCreate(false)}
                    className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">
                    Back
                  </button>
                  <button onClick={handleCreate} disabled={saving || !newName.trim()}
                    className="flex-1 h-11 rounded-xl bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              /* Select mode */
              <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search categories..."
                    className="h-10 rounded-xl pl-10 text-sm" autoFocus />
                </div>

                {/* List */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-6">
                      {search.trim() ? `No categories match "${search}"` : 'No categories yet'}
                    </p>
                  ) : (
                    filtered.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          onSelect(cat.id, cat.name);
                          handleClose();
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left',
                          selectedId === cat.id ? 'bg-violet-50' : 'hover:bg-gray-50'
                        )}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.color}18` }}
                        >
                          <Package className="w-4 h-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
                          {cat._count && (
                            <p className="text-[10px] text-gray-400">{cat._count.products} product(s)</p>
                          )}
                        </div>
                        {selectedId === cat.id && (
                          <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Create new button */}
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full h-11 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-violet-100 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create New Category
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
