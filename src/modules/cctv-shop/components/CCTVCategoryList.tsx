'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Search, X, Loader2, Package, Pencil, Trash2, Tag,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface CategoryWithCount {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export function CCTVCategoryList() {
  const { navigate, goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : data.categories || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (cat: CategoryWithCount) => {
    if (!window.confirm(`Delete "${cat.name}"? Products in this category will become uncategorized.`)) return;
    setDeletingId(cat.id);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/categories/${cat.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Category deleted', description: `"${cat.name}" has been removed.` });
        fetchCategories();
      } else {
        const data = await res.json();
        toast({ title: 'Delete failed', description: data.error || 'Something went wrong' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete category' });
    } finally {
      setDeletingId(null);
    }
  };

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          Categories
          {!loading && categories.length > 0 && (
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
              {categories.length}
            </span>
          )}
        </h1>
        <button
          onClick={() => navigate('create-category')}
          className="h-8 px-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-sm active:scale-[0.97] transition-transform flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Create
        </button>
      </div>

      {/* Search bar */}
      {categories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full h-10 pl-9 pr-9 rounded-xl bg-white border border-gray-100 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 shadow-sm transition-shadow"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && categories.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No categories yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-5 max-w-[240px] mx-auto">
            Create your first category to organize your CCTV products
          </p>
          <button
            onClick={() => navigate('create-category')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Create your first category
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && categories.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No categories match "{search}"</p>
        </div>
      )}

      {/* Category list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-0.5 scrollbar-thin">
          <AnimatePresence>
            {filtered.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {/* Color dot + icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}18` }}
                  >
                    <Package className="w-5 h-5" style={{ color: cat.color }} />
                  </div>

                  {/* Name & product count */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <p className="text-sm font-semibold text-gray-900 truncate">{cat.name}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cat._count.products} product{cat._count.products !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigate('edit-category', cat.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-500 hover:bg-violet-50 active:scale-[0.95] transition-all"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deletingId === cat.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-[0.95] transition-all disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === cat.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}