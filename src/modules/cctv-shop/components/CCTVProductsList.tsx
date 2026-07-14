'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, Package, Search, Loader2, Sparkles, Tag, Upload,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Product {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  costPrice: number;
  sellPrice: number;
  stock: number;
  serialTracked: boolean;
  warrantyMonths: number;
  category?: { name: string } | null;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVProductsList() {
  const { navigate, goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/products?limit=100`)
      .then((r) => r.json())
      .then((data) => { setProducts(data.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId]);

  const filtered = search
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Products</h1>
        <button
          onClick={() => navigate('categories')}
          className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        >
          <Tag className="w-4 h-4" /> Categories
        </button>
        <button
          onClick={() => navigate('import-products')}
          className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        >
          <Upload className="w-4 h-4" /> Import
        </button>
        <button
          onClick={() => navigate('add-product')}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="h-10 rounded-xl pl-10"
        />
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-400">{filtered.length} product(s)</div>

      {/* Product list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No products yet</p>
          <p className="text-xs text-gray-400 mt-1">Click Add to create your first product</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {product.brand}{product.model ? ` · ${product.model}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {product.category && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">
                    {product.category.name}
                  </span>
                )}
                {product.serialTracked && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                    Serial
                  </span>
                )}
                {product.warrantyMonths > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-600">
                    {product.warrantyMonths}mo warranty
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-sm font-bold text-gray-900">
                  ৳{product.sellPrice.toLocaleString()}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  product.stock <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                )}>
                  {product.stock} in stock
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
