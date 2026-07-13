'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, Edit3, Trash2, Shield, Hash, Plus,
  ChevronRight, AlertCircle, Loader2, Copy, BarChart3, Tag, RefreshCw, Sparkles, X,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { CCTVSerialItem } from '@/modules/cctv-shop/types';
import { SerialStatusChangeDialog } from './SerialStatusChangeDialog';
import { SerialNumberEntry } from './SerialNumberEntry';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  'in-stock': { label: 'In Stock', color: 'bg-emerald-50 text-emerald-700' },
  'sold': { label: 'Sold', color: 'bg-blue-50 text-blue-700' },
  'installed': { label: 'Installed', color: 'bg-violet-50 text-violet-700' },
  'in-repair': { label: 'In Repair', color: 'bg-amber-50 text-amber-700' },
  'warranty-claim': { label: 'Warranty Claim', color: 'bg-red-50 text-red-600' },
  'defective': { label: 'Defective', color: 'bg-gray-100 text-gray-600' },
};

const categoryColor: Record<string, string> = {
  Cameras: 'bg-violet-100 text-violet-700',
  'DVR/NVR': 'bg-amber-100 text-amber-700',
  Accessories: 'bg-emerald-100 text-emerald-700',
  Cables: 'bg-sky-100 text-sky-700',
};

function getCategoryColor(name: string): string {
  return categoryColor[name] || 'bg-purple-100 text-purple-700';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface ProductDetail {
  id: string;
  name: string;
  brand: string;
  model?: string;
  sku: string;
  masterProductId?: string | null;
  category?: { id: string; name: string };
  description?: string;
  costPrice: number;
  sellPrice: number;
  mrp?: number;
  vatRate?: number;
  stock: number;
  unit: string;
  minStockAlert?: number;
  serialTracked: boolean;
  warrantyMonths: number;
  serialItemsCount?: number;
  serialItemsByStatus?: Record<string, number>;
  hsnCode?: string;
  createdAt: string;
  updatedAt: string;
}

export function CCTVProductDetail() {
  const { contextId, navigate, goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [serials, setSerials] = useState<CCTVSerialItem[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusItem, setStatusItem] = useState<{ id: string; serialNumber: string; status: string; productName?: string; brand?: string | null } | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  // Bulk serial addition state
  const [showAddSerialsDialog, setShowAddSerialsDialog] = useState(false);
  const [newSerials, setNewSerials] = useState<string[]>([]);
  const [addingSerials, setAddingSerials] = useState(false);

  // Fetch product detail
  useEffect(() => {
    if (!businessId || !contextId) return;
    setLoading(true);
    fetch(`/api/businesses/${businessId}/cctv/products/${contextId}`)
      .then((res) => res.json())
      .then((data) => {
        const p: ProductDetail = data.product || data;
        setProduct(p);
        // If serial tracked, fetch serial items
        if (p.serialTracked) {
          fetchSerials();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId, contextId]);

  const fetchSerials = useCallback(async () => {
    if (!businessId || !contextId) return;
    setSerialsLoading(true);
    try {
      // Only fetch IN_STOCK serials — sold/installed items are archived and not shown here
      const res = await fetch(
        `/api/businesses/${businessId}/cctv/products/${contextId}/serials?status=IN_STOCK&limit=50`
      );
      const data = await res.json();
      setSerials(data.items || data.serialItems || data.serials || []);
    } catch {
      // ignore
    } finally {
      setSerialsLoading(false);
    }
  }, [businessId, contextId]);

  const handleAddSerials = async () => {
    if (newSerials.length === 0) {
      setShowAddSerialsDialog(false);
      return;
    }
    setAddingSerials(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/cctv/products/${contextId}/serials`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: newSerials.map((s) => ({ serialNumber: s })),
          }),
        }
      );
      if (res.ok) {
        setShowAddSerialsDialog(false);
        setNewSerials([]);
        fetchSerials();
      }
    } catch {
      // ignore
    } finally {
      setAddingSerials(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !contextId) return;
    setDeleting(true);
    try {
      await fetch(`/api/businesses/${businessId}/cctv/products/${contextId}`, {
        method: 'DELETE',
      });
      goBack();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100" />
          <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Product</h1>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Product not found</p>
        </div>
      </div>
    );
  }

  const isLowStock = !product.serialTracked && product.minStockAlert != null && product.stock <= product.minStockAlert;
  const categoryName = product.category?.name || 'Uncategorized';
  const serialCounts = product.serialItemsByStatus || {};
  const totalSerials = product.serialItemsCount || Object.values(serialCounts).reduce((a: number, b) => a + (b as number), 0);

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1 truncate">{product.name}</h1>
      </div>

      {/* Product Info Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {product.brand}
          {product.model ? ` · ${product.model}` : ''}
        </p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold', getCategoryColor(categoryName))}>
            {categoryName}
          </span>
          {product.masterProductId && (
            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-violet-100 text-violet-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Master Catalog
            </span>
          )}
          {product.sku && (
            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
              <Copy className="w-3 h-3" />
              {product.sku}
            </span>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">{product.description}</p>
        )}

        {/* Key details */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Brand</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{product.brand}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Model</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{product.model || '—'}</p>
          </div>
        </div>
      </div>

      {/* Pricing Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Tag className="w-4 h-4 text-violet-500" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Pricing</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Cost Price</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">৳{product.costPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Sell Price</p>
            <p className="text-sm font-bold text-violet-600 mt-0.5">৳{product.sellPrice.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">MRP</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {product.mrp ? `৳${product.mrp.toLocaleString()}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">VAT Rate</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">
              {product.vatRate ? `${product.vatRate}%` : '—'}
            </p>
          </div>
        </div>

        {/* Profit margin indicator */}
        {product.costPrice > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Profit Margin</span>
              <span className="text-[11px] font-semibold text-emerald-600">
                {(((product.sellPrice - product.costPrice) / product.sellPrice) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stock & Tracking Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-violet-500" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Stock & Tracking</h2>
        </div>

        {product.serialTracked ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-700 flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Serial Tracked
              </span>
              <span className="text-xs text-gray-500">{totalSerials} total items</span>
            </div>

            {/* Status breakdown pills */}
            {Object.keys(serialCounts).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(serialCounts).map(([status, count]) => {
                  const cfg = statusConfig[status];
                  if (!cfg) return null;
                  return (
                    <span
                      key={status}
                      className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', cfg.color)}
                    >
                      {cfg.label}: {count as number}
                    </span>
                  );
                })}
              </div>
            )}

            {product.warrantyMonths > 0 && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                <Shield className="w-3.5 h-3.5" />
                <span>{product.warrantyMonths} months warranty</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Stock</p>
                <p className={cn(
                  'text-xl font-bold mt-0.5',
                  isLowStock ? 'text-red-600' : 'text-gray-900'
                )}>
                  {product.stock}
                  <span className="text-xs font-normal text-gray-400 ml-1">{product.unit}</span>
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Min Alert</p>
                <p className="text-xl font-bold text-gray-700 mt-0.5">
                  {product.minStockAlert || 0}
                </p>
              </div>
            </div>

            {isLowStock && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Stock is at or below minimum alert level</span>
              </div>
            )}

            {product.warrantyMonths > 0 && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                <Shield className="w-3.5 h-3.5" />
                <span>{product.warrantyMonths} months warranty</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Serial Items Section (if serial tracked) */}
      {product.serialTracked && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Hash className="w-4 h-4 text-violet-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-800">Serial Items</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                {totalSerials}
              </span>
            </div>
            <button
              onClick={() => setShowAddSerialsDialog(true)}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 active:scale-[0.98] transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Serials
            </button>
          </div>

          {serialsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : serials.length === 0 ? (
            <div className="text-center py-6">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">No serial items yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {serials.map((si) => {
                const cfg = statusConfig[si.status] || { label: si.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <div
                    key={si.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono font-semibold text-gray-800 truncate">
                        {si.serialNumber}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Added: {formatDate(si.createdAt)}
                        {si.warrantyExpiry && ` · Exp: ${formatDate(si.warrantyExpiry)}`}
                      </p>
                      {si.soldTo && (
                        <p className="text-[10px] text-gray-500 mt-0.5">Customer: {si.soldTo}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                        {cfg.label}
                      </span>
                      <button
                        onClick={() => {
                          setStatusItem({
                            id: si.id,
                            serialNumber: si.serialNumber,
                            status: si.status,
                            productName: product.name,
                            brand: product.brand,
                          });
                          setShowStatusDialog(true);
                        }}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-violet-50 active:border-violet-200 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* View All link */}
          {totalSerials > 10 && (
            <button
              onClick={() => navigate('serial-items', contextId)}
              className="w-full mt-3 py-2 text-xs font-semibold text-violet-600 flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
            >
              View All {totalSerials} Serial Items
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-4 py-3 z-40 -mx-4">
        <div className="flex gap-3">
          <button
            onClick={() => navigate('edit-product', contextId)}
            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Edit3 className="w-4 h-4" />
            Edit Product
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="h-11 px-5 rounded-2xl border border-red-200 text-red-600 font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform hover:bg-red-50">
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status Change Dialog */}
      <SerialStatusChangeDialog
        open={showStatusDialog}
        onClose={() => setShowStatusDialog(false)}
        onSaved={() => fetchSerials()}
        item={statusItem}
      />

      {/* Bulk Add Serials Dialog */}
      {showAddSerialsDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Add Serial Numbers</h3>
              <button
                onClick={() => { setShowAddSerialsDialog(false); setNewSerials([]); }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Type or scan serial numbers for <strong>{product?.name}</strong>. Press Enter after each one.
            </p>
            <SerialNumberEntry
              targetQty={999}
              productName={product?.name}
              onChange={setNewSerials}
            />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowAddSerialsDialog(false); setNewSerials([]); }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSerials}
                disabled={newSerials.length === 0 || addingSerials}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingSerials ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {addingSerials ? 'Adding...' : `Add ${newSerials.length} Serial${newSerials.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}