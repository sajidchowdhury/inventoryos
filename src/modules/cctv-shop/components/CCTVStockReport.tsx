'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Boxes,
  DollarSign,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StockProduct {
  productId: string;
  productName: string;
  brand: string | null;
  model: string | null;
  serialTracked: boolean;
  available: number;
  inStock: number;
  inTransit: number;
  sold: number;
  installed: number;
  damaged: number;
  returned: number;
  totalSerials: number;
  costPrice: number;
  sellPrice: number;
  costValue: number;
  sellValue: number;
  minStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  productCount: number;
  totalAvailable: number;
  costValue: number;
  sellValue: number;
}

interface StockReportData {
  summary: {
    totalProducts: number;
    totalInStock: number;
    totalSerialItems: number;
    totalCostValue: number;
    totalSellValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    potentialProfit: number;
  };
  categorySummary: CategorySummary[];
  products: StockProduct[];
}

function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `৳${(amount / 1000).toLocaleString('en-BD', { maximumFractionDigits: 0 })}K`;
  }
  return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

const statusFilterOptions = [
  { value: '', label: 'All Items' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
];

export function CCTVStockReport() {
  const session = useAuthStore((s) => s.session);
  const { goBack } = useCCTVNavStore();
  const businessId = session?.business?.id;

  const [data, setData] = useState<StockReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReport = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryId) params.set('categoryId', categoryId);
      const qs = params.toString();
      const res = await fetch(`/api/businesses/${businessId}/reports/stock${qs ? `?${qs}` : ''}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Stock report error:', err);
    } finally {
      setLoading(false);
    }
  }, [businessId, debouncedSearch, statusFilter, categoryId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const headers = ['Product Name', 'Brand', 'Model', 'Type', 'Available', 'In Stock', 'In Transit', 'Sold', 'Installed', 'Damaged', 'Cost Price', 'Sell Price', 'Cost Value', 'Sell Value', 'Status'];
    const rows = data.products.map((p) => [
      p.productName,
      p.brand || '',
      p.model || '',
      p.serialTracked ? 'Serial' : 'Non-Serial',
      p.available,
      p.inStock,
      p.inTransit,
      p.sold,
      p.installed,
      p.damaged,
      p.costPrice,
      p.sellPrice,
      p.costValue,
      p.sellValue,
      p.isOutOfStock ? 'Out of Stock' : p.isLowStock ? 'Low Stock' : 'OK',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const summaryCards = data ? [
    {
      label: 'Total Products',
      value: data.summary.totalProducts.toString(),
      icon: <Package className="w-5 h-5" />,
      color: 'bg-gray-900 text-white',
    },
    {
      label: 'Total Stock',
      value: data.summary.totalInStock.toString(),
      icon: <Boxes className="w-5 h-5" />,
      color: 'bg-emerald-600 text-white',
    },
    {
      label: 'Cost Value',
      value: formatCurrency(data.summary.totalCostValue),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'bg-amber-500 text-white',
    },
    {
      label: 'Sell Value',
      value: formatCurrency(data.summary.totalSellValue),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-teal-600 text-white',
    },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Stock Report</h1>
          <p className="text-xs text-gray-500">Current inventory overview</p>
        </div>
        {data && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        )}
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {summaryCards.map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-gray-100">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg ${card.color} flex items-center justify-center`}>
                      {card.icon}
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{card.value}</p>
                  <p className="text-[11px] text-gray-500">{card.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Alert Cards */}
      {data && (data.summary.lowStockCount > 0 || data.summary.outOfStockCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {data.summary.lowStockCount > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-800">{data.summary.lowStockCount}</p>
                  <p className="text-[11px] text-amber-600">Low Stock Items</p>
                </div>
              </CardContent>
            </Card>
          )}
          {data.summary.outOfStockCount > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800">{data.summary.outOfStockCount}</p>
                  <p className="text-[11px] text-red-600">Out of Stock</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Profit indicator */}
      {data && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-700 font-medium">Potential Profit (Sell - Cost)</p>
                <p className="text-sm font-bold text-emerald-800">{formatCurrency(data.summary.potentialProfit)}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-100 text-[10px]">
              {data.summary.totalSerialItems} serial items
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search products, brands, models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      {data && data.categorySummary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            By Category
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.categorySummary
              .filter((c) => (categoryId ? c.id === categoryId : true))
              .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(categoryId === cat.id ? '' : cat.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    categoryId === cat.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                    {cat.icon || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {cat.productCount} products · {cat.totalAvailable} in stock
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-900">{formatCurrency(cat.costValue)}</p>
                    <p className="text-[10px] text-gray-400">cost value</p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Product Table */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : data && data.products.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-500 font-medium">{data.products.length} products</p>
            {data.products.some((p) => p.serialTracked) && (
              <p className="text-[10px] text-gray-400">Serial-tracked items show detailed breakdown</p>
            )}
          </div>
          {data.products.map((product, idx) => (
            <motion.div
              key={product.productId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
            >
              <Card className={`border overflow-hidden ${
                product.isOutOfStock
                  ? 'border-red-200 bg-red-50/30'
                  : product.isLowStock
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-gray-100'
              }`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-gray-900 truncate">{product.productName}</p>
                        {product.serialTracked && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200 flex-shrink-0">
                            SN
                          </Badge>
                        )}
                        {product.isLowStock && !product.isOutOfStock && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 flex-shrink-0">
                            LOW
                          </Badge>
                        )}
                        {product.isOutOfStock && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 flex-shrink-0">
                            OUT
                          </Badge>
                        )}
                      </div>
                      {(product.brand || product.model) && (
                        <p className="text-[11px] text-gray-500 truncate">
                          {[product.brand, product.model].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-gray-900">{product.available}</p>
                      <p className="text-[10px] text-gray-400">available</p>
                    </div>
                  </div>

                  {/* Serial breakdown for serial-tracked items */}
                  {product.serialTracked && product.totalSerials > 0 && (
                    <div className="flex gap-3 mb-2 text-[10px]">
                      <span className="text-emerald-600 font-medium">In Stock: {product.inStock}</span>
                      <span className="text-blue-600 font-medium">Transit: {product.inTransit}</span>
                      <span className="text-gray-500">Sold: {product.sold}</span>
                      <span className="text-gray-500">Installed: {product.installed}</span>
                      {product.damaged > 0 && <span className="text-red-500">Damaged: {product.damaged}</span>}
                    </div>
                  )}

                  {/* Price row */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex gap-4 text-[11px]">
                      <div>
                        <span className="text-gray-400">Cost: </span>
                        <span className="font-medium text-gray-700">{formatCurrency(product.costPrice)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Sell: </span>
                        <span className="font-medium text-gray-700">{formatCurrency(product.sellPrice)}</span>
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      <span className="text-gray-400">Value: </span>
                      <span className="font-semibold text-emerald-700">{formatCurrency(product.costValue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No products found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
}