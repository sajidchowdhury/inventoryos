'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Printer, Package, AlertTriangle,
  TrendingUp, TrendingDown, Search,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

interface StockRow {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  category: string | null;
  stock: number;
  minStock: number;
  costPrice: number;
  sellPrice: number;
  costValue: number;
  sellValue: number;
  serialTracked: boolean;
  unit: string;
  isLowStock: boolean;
}

interface StockData {
  success: boolean;
  products: StockRow[];
  summary: {
    totalProducts: number;
    totalStockValue: number;
    totalSellValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function CCTVStockReport() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');

  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    if (!businessId) return;
    setLoading(true);
    setHasSearched(true);
    fetch(`/api/businesses/${businessId}/cctv/reports/stock`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const handlePrint = () => window.print();

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Stock Report</h1>
        <button onClick={handleSearch} disabled={loading}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Loading...' : 'Load Stock'}
        </button>
        {data && (
          <button onClick={handlePrint}
            className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </button>
        )}
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{businessName}</h1>
        <p className="text-sm text-gray-600">Stock Report — {new Date().toLocaleDateString('en-GB')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : !hasSearched ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Click "Load Stock" to view inventory</p>
          <p className="text-xs text-gray-400 mt-1">Shows all products with current stock levels and values</p>
        </div>
      ) : data && data.products.length > 0 ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Total Products</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.totalProducts}</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
              <span className="text-xs text-emerald-700 font-medium">Stock Value (Cost)</span>
              <p className="text-xl font-bold text-emerald-700 mt-1">{formatBDT(data.summary.totalStockValue)}</p>
            </div>
            <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4">
              <span className="text-xs text-violet-700 font-medium">Stock Value (Sell)</span>
              <p className="text-xl font-bold text-violet-700 mt-1">{formatBDT(data.summary.totalSellValue)}</p>
            </div>
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <span className="text-xs text-red-700 font-medium">Low Stock</span>
              <p className="text-xl font-bold text-red-700 mt-1">{data.summary.lowStockCount}</p>
            </div>
          </div>

          {/* Stock table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left p-3 font-semibold text-gray-700">Product</th>
                    <th className="text-left p-3 font-semibold text-gray-700 hidden md:table-cell">Category</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Stock</th>
                    <th className="text-right p-3 font-semibold text-gray-700 hidden md:table-cell">Cost Value</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Sell Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className={cn(
                      'border-b border-gray-50 last:border-0 hover:bg-gray-50/50',
                      p.isLowStock && 'bg-red-50/30'
                    )}>
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.brand}{p.model ? ` · ${p.model}` : ''}</p>
                      </td>
                      <td className="p-3 text-gray-500 hidden md:table-cell">{p.category || '—'}</td>
                      <td className="p-3 text-center">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-semibold',
                          p.stock === 0 ? 'bg-red-50 text-red-600' :
                          p.isLowStock ? 'bg-amber-50 text-amber-600' :
                          'bg-emerald-50 text-emerald-700'
                        )}>
                          {p.stock} {p.unit}
                        </span>
                        {p.serialTracked && (
                          <span className="ml-1 text-[9px] text-blue-500">serial</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-gray-600 hidden md:table-cell">{formatBDT(p.costValue)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900">{formatBDT(p.sellValue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="p-3 font-bold text-gray-800">Total</td>
                    <td className="p-3 text-right font-bold text-emerald-700 hidden md:table-cell">{formatBDT(data.summary.totalStockValue)}</td>
                    <td className="p-3 text-right font-bold text-violet-700">{formatBDT(data.summary.totalSellValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No products in stock</p>
          <p className="text-xs text-gray-400 mt-1">Add products first from the Products page</p>
        </div>
      )}
    </motion.div>
  );
}
