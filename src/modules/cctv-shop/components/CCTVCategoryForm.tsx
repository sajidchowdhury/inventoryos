'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVCategoryForm() {
  const { goBack, contextId } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const { toast } = useToast();
  const isEdit = !!contextId;

  // Form fields
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Package');
  const [color, setColor] = useState('#7c3aed');
  const [sortOrder, setSortOrder] = useState('0');

  // UI state
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Fetch existing category for edit mode
  const fetchCategory = useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/categories/${contextId}`);
      if (res.ok) {
        const data = await res.json();
        setName(data.name || '');
        setIcon(data.icon || 'Package');
        setColor(data.color || '#7c3aed');
        setSortOrder(String(data.sortOrder ?? 0));
      } else {
        toast({ title: 'Error', description: 'Category not found' });
        goBack();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load category' });
      goBack();
    } finally {
      setLoading(false);
    }
  }, [contextId, businessId, toast, goBack]);

  useEffect(() => {
    if (isEdit) fetchCategory();
  }, [isEdit, fetchCategory]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Validation', description: 'Category name is required' });
      return;
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/businesses/${businessId}/mobile-shop/categories/${contextId}`
        : `/api/businesses/${businessId}/mobile-shop/categories`;

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          icon: icon.trim() || 'Package',
          color: color.trim() || '#7c3aed',
          sortOrder: parseInt(sortOrder, 10) || 0,
        }),
      });

      if (res.ok) {
        toast({
          title: isEdit ? 'Category updated' : 'Category created',
          description: `"${name.trim()}" has been ${isEdit ? 'updated' : 'created'}.`,
        });
        goBack();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Something went wrong' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save category' });
    } finally {
      setSaving(false);
    }
  };

  const isValidColor = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {isEdit ? 'Edit Category' : 'Create Category'}
        </h1>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4 mt-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 rounded-xl w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 rounded-xl w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-10 rounded-xl w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 rounded-xl w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cameras, DVR/NVR, Cables"
              className="h-10 rounded-xl text-sm"
            />
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Icon</Label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Package"
              className="h-10 rounded-xl text-sm"
            />
            <p className="text-[10px] text-gray-400">Lucide icon name (e.g. Camera, HardDrive, Cable)</p>
          </div>

          {/* Color with swatch */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Color</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl border border-gray-200 shrink-0"
                style={{
                  backgroundColor: isValidColor(color) ? color : '#7c3aed',
                }}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#7c3aed"
                className="h-10 rounded-xl text-sm font-mono flex-1"
              />
            </div>
            <p className="text-[10px] text-gray-400">Hex color code for the category badge</p>
          </div>

          {/* Sort Order */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Sort Order</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              className="h-10 rounded-xl text-sm"
            />
            <p className="text-[10px] text-gray-400">Lower numbers appear first</p>
          </div>
        </div>
      )}

      {/* Submit button */}
      {!loading && (
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="w-full h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving
            ? 'Saving...'
            : isEdit
              ? 'Update Category'
              : 'Create Category'}
        </button>
      )}
    </motion.div>
  );
}