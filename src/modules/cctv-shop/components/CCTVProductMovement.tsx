'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Printer, Package, TrendingUp, TrendingDown,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  stock: number;
  serialTracked: boolean;
}

interface MovementEntry {
  date: string;
  type: string;
  description: string;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  price: number;
}

interface MovementData {
  success: boolean;
  product: {
    id: string;
    name: string;
    brand: string;
    model?: string | null;
    costPrice: number;
    sellPrice: number;
    stock: number;
    serialTracked: boolean;
    actualStock: number;
  };
  entries: MovementEntry[];
  summary: {
    totalPurchased: number;
    totalSold: number;
    currentStock: number;
    entryCount: number;
  };
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function formatBDT(n: number): string {
  return `\u09F3${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CCTVProductMovement() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const businessName = useAuthStore((s) => s.session?.business?.name || 'CCTV Shop');

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState<MovementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [movementLoading, setMovementLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/cctv/reports/product-movement`)
      .then((r) => r.json())
      .then((d) => { setProducts(d.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [businessId]);

  useEffect(() => {
    if (!selectedId || !businessId) return;
    setMovementLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/reports/product-movement?productId=${selectedId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setMovementLoading(false); })
      .catch(() => setMovementLoading(false));
  }, [selectedId, businessId]);

  const handlePrint = () => window.print();

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      <div className="flex items-center gap-3 pt-1 print:hidden">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Product Movement</h1>
        {data && (
          <button onClick={handlePrint}
            className="h-9 px-4 rounded-xl bg-white border border-gray-200 text-xs font-semibold flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </button>
        )}
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{businessName}</h1>
        <p className="text-sm text-gray-600">Product Movement — {data?.product.name}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <>
          {/* Product selector */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm print:hidden">
            <label className="text-xs text-gray-600 mb-2 block">Select Product</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white"
            >
              <option value="">— Select Product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.brand} ({p.stock} in stock)
                </option>
              ))}
            </select>
          </div>

          {selectedId && movementLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : selectedId && data && data.entries.length > 0 ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-700 font-medium">Purchased</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{data.summary.totalPurchased}</p>
                </div>
                <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-700 font-medium">Sold</span>
                  </div>
                  <p className="text-xl font-bold text-red-700 mt-1">{data.summary.totalSold}</p>
                </div>
                <div className="bg-violet-50 rounded-2xl border border-violet-100 p-4">
                  <span className="text-xs text-violet-700 font-medium">Current Stock</span>
                  <p className="text-xl font-bold text-violet-700 mt-1">{data.summary.currentStock}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
                  <span className="text-xs text-blue-700 font-medium">Transactions</span>
                  <p className="text-xl font-bold text-blue-700 mt-1">{data.summary.entryCount}</p>
                </div>
              </div>

              {/* Movement table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left p-3 font-semibold text-gray-700">Date</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Description</th>
                        <th className="text-center p-3 font-semibold text-emerald-700">In</th>
                        <th className="text-center p-3 font-semibold text-red-700">Out</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Balance</th>
                        <th className="text-right p-3 font-semibold text-gray-700 hidden md:table-cell">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map((entry, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="p-3 text-gray-700">
                            {entry.description}
                            <span className={cn(
                              'ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                              entry.type === 'purchase' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                            )}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="p-3 text-center font-semibold text-emerald-600">
                            {entry.qtyIn > 0 ? `+${entry.qtyIn}` : '—'}
                          </td>
                          <td className="p-3 text-center font-semibold text-red-600">
                            {entry.qtyOut > 0 ? `-${entry.qtyOut}` : '—'}
                          </td>
                          <td className="p-3 text-center font-bold text-gray-900">{entry.balance}</td>
                          <td className="p-3 text-right text-gray-500 hidden md:table-cell">{formatBDT(entry.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={2} className="p-3 font-bold text-gray-800">Total</td>
                        <td className="p-3 text-center font-bold text-emerald-700">+{data.summary.totalPurchased}</td>
                        <td className="p-3 text-center font-bold text-red-700">-{data.summary.totalSold}</td>
                        <td className="p-3 text-center font-bold text-violet-700">{data.summary.currentStock}</td>
                        <td className="p-3 hidden md:table-cell"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : selectedId && data && data.entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">No movement yet</p>
              <p className="text-xs text-gray-400 mt-1">This product has no purchases or sales recorded</p>
            </div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
