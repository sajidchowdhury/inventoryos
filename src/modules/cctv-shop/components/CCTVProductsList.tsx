'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, ArrowLeft, Plus, Camera, HardDrive, Cable,
  Wrench, Package, X,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const categories = ['All', 'Cameras', 'DVR/NVR', 'Accessories', 'Cables'] as const;

const mockProducts = [
  { id: '1', name: 'Hikvision DS-2CD2143G2', brand: 'Hikvision', category: 'Cameras', price: 4200, stock: 45 },
  { id: '2', name: 'Dahua IPC-HDW2431T-AS', brand: 'Dahua', category: 'Cameras', price: 3850, stock: 32 },
  { id: '3', name: 'Hikvision DS-7608NI-Q2/8P', brand: 'Hikvision', category: 'DVR/NVR', price: 12500, stock: 8 },
  { id: '4', name: 'Dahua XVR5108HS-I3', brand: 'Dahua', category: 'DVR/NVR', price: 9800, stock: 12 },
  { id: '5', name: 'TP-Link TL-SG1008P PoE Switch', brand: 'TP-Link', category: 'Accessories', price: 6500, stock: 20 },
  { id: '6', name: 'CCTV Cable Cat6 100m', brand: 'Local', category: 'Cables', price: 1800, stock: 150 },
  { id: '7', name: 'Hikvision DS-2CE5AD0T-IRP', brand: 'Hikvision', category: 'Cameras', price: 2200, stock: 65 },
  { id: '8', name: 'Hikvision DS-7604NI-K1/4P', brand: 'Hikvision', category: 'DVR/NVR', price: 7800, stock: 5 },
  { id: '9', name: 'Dahua NVR4108HS-EI', brand: 'Dahua', category: 'DVR/NVR', price: 14500, stock: 3 },
  { id: '10', name: 'BNC Connector Pack (50pcs)', brand: 'Local', category: 'Accessories', price: 450, stock: 80 },
  { id: '11', name: 'Hikvision DS-2DE4A425IW', brand: 'Hikvision', category: 'Cameras', price: 18500, stock: 4 },
  { id: '12', name: 'Dahua DH-IPC-HFW2831E', brand: 'Dahua', category: 'Cameras', price: 5200, stock: 28 },
  { id: '13', name: 'Power Supply 12V 5A', brand: 'Local', category: 'Accessories', price: 350, stock: 120 },
  { id: '14', name: 'RG59 Coaxial Cable 100m', brand: 'Local', category: 'Cables', price: 1200, stock: 90 },
  { id: '15', name: 'Hikvision DS-2CD2346G2', brand: 'Hikvision', category: 'Cameras', price: 7800, stock: 18 },
  { id: '16', name: 'Dahua DH-XVR5108HS-X', brand: 'Dahua', category: 'DVR/NVR', price: 11200, stock: 7 },
  { id: '17', name: 'Junction Box IP65', brand: 'Local', category: 'Accessories', price: 180, stock: 200 },
  { id: '18', name: 'Hikvision DS-7216NI-K2', brand: 'Hikvision', category: 'DVR/NVR', price: 19500, stock: 2 },
  { id: '19', name: 'UTP Cat5e Cable 305m Box', brand: 'Local', category: 'Cables', price: 3200, stock: 40 },
  { id: '20', name: 'Dahua IPC-HDW3641EM-AS', brand: 'Dahua', category: 'Cameras', price: 9500, stock: 15 },
  { id: '21', name: 'Hikvision DS-2CD2T47G2', brand: 'Hikvision', category: 'Cameras', price: 6200, stock: 22 },
  { id: '22', name: 'Dahua NVR4416-EI', brand: 'Dahua', category: 'DVR/NVR', price: 22000, stock: 3 },
  { id: '23', name: 'Video Balun Pair (10 sets)', brand: 'Local', category: 'Accessories', price: 600, stock: 55 },
  { id: '24', name: 'HDD Seagate SkyHawk 2TB', brand: 'Seagate', category: 'DVR/NVR', price: 7500, stock: 10 },
];

const categoryIcon = (cat: string) => {
  switch (cat) {
    case 'Cameras': return Camera;
    case 'DVR/NVR': return HardDrive;
    case 'Accessories': return Wrench;
    case 'Cables': return Cable;
    default: return Package;
  }
};

const categoryColor: Record<string, string> = {
  Cameras: 'bg-violet-100 text-violet-700',
  'DVR/NVR': 'bg-amber-100 text-amber-700',
  Accessories: 'bg-emerald-100 text-emerald-700',
  Cables: 'bg-sky-100 text-sky-700',
};

export function CCTVProductsList() {
  const { navigate, goBack } = useCCTVNavStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filtered = mockProducts.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const totalStock = mockProducts.reduce((a, p) => a + p.stock, 0);
  const lowStock = mockProducts.filter((p) => p.stock <= 10).length;

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
        <h1 className="text-lg font-bold text-gray-900 flex-1">Products</h1>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
        <span className="font-semibold text-gray-700">{mockProducts.length} Products</span>
        <span>·</span>
        <span>{totalStock.toLocaleString()} Stock Items</span>
        <span>·</span>
        <span className="text-amber-600 font-medium">{lowStock} Low Stock</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
        <input
          type="text"
          placeholder="Search by name, brand..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-10 rounded-2xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeCategory === cat
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 px-1">
        {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {filtered.map((product, i) => {
          const Icon = categoryIcon(product.category);
          const colorClass = categoryColor[product.category] || 'bg-gray-100 text-gray-700';
          const isLow = product.stock <= 10;

          return (
            <motion.button
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.04 } }}
              onClick={() => navigate('product-detail', product.id)}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{product.brand}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', colorClass)}>
                  {product.category}
                </span>
                {isLow && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">
                    Low
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-sm font-bold text-gray-900">৳{product.price.toLocaleString()}</span>
                <span
                  className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    isLow ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                  )}
                >
                  {product.stock} in stock
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No products found</p>
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => navigate('add-product')}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center active:scale-95 transition-transform z-50"
      >
        <Plus className="w-6 h-6" />
      </button>
    </motion.div>
  );
}