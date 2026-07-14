'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Search, Plus, Minus, X, Loader2,
  Package, Truck, FileText, CheckCircle2, Hash, StickyNote,
  Tag, ShoppingCart, Percent, Shield, ChevronDown, ChevronUp,
} from 'lucide-react';
import { SerialNumberEntry } from './SerialNumberEntry';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { useCctvBusinessId } from '@/modules/cctv-shop/hooks/use-cctv-business-id';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const STEP_LABELS = ['Supplier', 'Products', 'Review'];

function formatBDT(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface SupplierResult {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  balance?: number;
}

interface ProductResult {
  id: string;
  name: string;
  brand?: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  serialTracked: boolean;
  warrantyMonths?: number;
  unit?: string;
}

interface PurchaseItem {
  _localId: string;
  productId: string;
  productName: string;
  productBrand?: string;
  quantity: number;
  unitCost: number;
  unitPrice?: number; // sell price
  warrantyMonths: number;
  serialTracked: boolean;
  unit?: string;
  serialNumbers: string[];
  showSerialEntry: boolean;
}

export function CCTVCreatePurchase() {
  const { goBack } = useCCTVNavStore();
  const businessId = useCctvBusinessId();

  // Step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Supplier
  const [supplier, setSupplier] = useState<SupplierResult | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [supplierResults, setSupplierResults] = useState<SupplierResult[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);

  // Products / Items
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  // Review
  const [invoiceNo, setInvoiceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Status
  const [submitting, setSubmitting] = useState(false);
  // Track which items have valid serials for submit validation
  const [serialErrors, setSerialErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Debounce refs
  const supplierTimer = useRef<ReturnType<typeof setTimeout>>();
  const productTimer = useRef<ReturnType<typeof setTimeout>>();

  // ─── Supplier search ─────────────────────────────────────
  const searchSuppliers = useCallback(async (q: string) => {
    if (!q.trim()) { setSupplierResults([]); return; }
    setSupplierLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setSupplierResults(data.suppliers ?? data ?? []);
      }
    } catch {
      // silent
    } finally {
      setSupplierLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (supplierTimer.current) clearTimeout(supplierTimer.current);
    if (!supplierSearch.trim()) { setSupplierResults([]); return; }
    supplierTimer.current = setTimeout(() => searchSuppliers(supplierSearch), 300);
    return () => { if (supplierTimer.current) clearTimeout(supplierTimer.current); };
  }, [supplierSearch, searchSuppliers]);

  // ─── Product search ──────────────────────────────────────
  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProductResults([]); return; }
    setProductLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/products?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setProductResults(data.products ?? data ?? []);
      }
    } catch {
      // silent
    } finally {
      setProductLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (productTimer.current) clearTimeout(productTimer.current);
    if (!productSearch.trim()) { setProductResults([]); return; }
    productTimer.current = setTimeout(() => searchProducts(productSearch), 300);
    return () => { if (productTimer.current) clearTimeout(productTimer.current); };
  }, [productSearch, searchProducts]);

  // ─── Item helpers ────────────────────────────────────────
  const isProductAdded = (productId: string) => items.some((it) => it.productId === productId);

  const addProduct = (p: ProductResult) => {
    if (isProductAdded(p.id)) return;
    setItems((prev) => [
      ...prev,
      {
        _localId: `${p.id}-${Date.now()}`,
        productId: p.id,
        productName: p.name,
        productBrand: p.brand,
        quantity: 1,
        unitCost: p.costPrice,
        unitPrice: p.sellPrice,
        warrantyMonths: p.warrantyMonths || 0,
        serialTracked: p.serialTracked,
        unit: p.unit,
        serialNumbers: [],
        showSerialEntry: false,
      },
    ]);
    setProductSearch('');
    setProductResults([]);
    setShowProductSearch(false);
  };

  const removeItem = (localId: string) => {
    setItems((prev) => prev.filter((it) => it._localId !== localId));
  };

  const updateItemQty = (localId: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it._localId === localId
          ? { ...it, quantity: Math.max(1, it.quantity + delta) }
          : it
      )
    );
  };

  const setItemQty = (localId: string, val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return;
    setItems((prev) =>
      prev.map((it) => (it._localId === localId ? { ...it, quantity: n } : it))
    );
  };

  const toggleSerialEntry = (localId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it._localId === localId
          ? { ...it, showSerialEntry: !it.showSerialEntry }
          : it
      )
    );
  };

  const handleSerialsChange = (localId: string, serials: string[]) => {
    setItems((prev) =>
      prev.map((it) =>
        it._localId === localId
          ? { ...it, serialNumbers: serials }
          : it
      )
    );
    // Clear error for this item when serials change
    setSerialErrors((prev) => {
      const next = { ...prev };
      delete next[localId];
      return next;
    });
  };

  const setItemCost = (localId: string, val: string) => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return;
    setItems((prev) =>
      prev.map((it) => (it._localId === localId ? { ...it, unitCost: n } : it))
    );
  };

  // ─── Calculations ────────────────────────────────────────
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const discount = Math.max(0, discountAmount);
  const grandTotal = Math.max(0, subtotal - discount);

  // ─── Submit ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier?.id ?? null,
          invoiceNo: invoiceNo.trim() || null,
          notes: notes.trim() || null,
          discountAmount: discount,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            unitPrice: it.unitPrice || 0,
            warrantyMonths: it.warrantyMonths || 0,
            serialNumbers: it.serialTracked ? it.serialNumbers : undefined,
          })),
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => goBack(), 1000);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.message || 'Failed to create purchase order';
        // If API returned duplicate serial info, parse and show
        if (data.duplicateSerials && Array.isArray(data.duplicateSerials)) {
          setError(`${msg} (${data.duplicateSerials.length} duplicate(s))`);
        } else {
          setError(msg);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step navigation ─────────────────────────────────────
  const canGoNext = step === 1 || (step === 2 && items.length > 0);

  const handleNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2 && items.length > 0) setStep(3);
  };

  const handleBack = () => {
    if (step === 1) goBack();
    else setStep((step - 1) as 1 | 2);
  };

  // ─── Step indicator ──────────────────────────────────────
  const progressPct = (step / 3) * 100;

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">New Purchase</h1>
        <span className="text-[11px] text-gray-400 font-medium">
          {step}/3
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const s = i + 1;
          const active = step >= s;
          const current = step === s;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                    active
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  )}
                >
                  {s}
                </div>
                <span
                  className={cn(
                    'text-[11px] font-semibold transition-colors',
                    current ? 'text-violet-600' : active ? 'text-gray-700' : 'text-gray-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className="flex-1 h-px bg-gray-200">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      step > s ? 'bg-violet-500' : 'bg-transparent'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Success overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl border border-green-100 p-6 text-center shadow-sm"
          >
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-green-700">Purchase Order Created!</p>
            <p className="text-xs text-gray-500 mt-1">Redirecting...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3.5 text-xs text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* ============================== STEP 1: Supplier ============================== */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {supplier ? (
              /* Selected supplier card */
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{supplier.name}</p>
                      {supplier.code && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mt-0.5 inline-block">
                          {supplier.code}
                        </span>
                      )}
                      {supplier.phone && (
                        <p className="text-[11px] text-gray-500 mt-0.5">{supplier.phone}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSupplier(null); setShowSupplierSearch(true); setSupplierSearch(''); }}
                    className="text-[11px] text-violet-600 font-semibold active:text-violet-700 transition-colors"
                  >
                    Change
                  </button>
                </div>
                {typeof supplier.balance === 'number' && (
                  <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Balance</span>
                    <span className={cn(
                      'text-xs font-bold',
                      supplier.balance > 0 ? 'text-red-500' : 'text-green-600'
                    )}>
                      {formatBDT(Math.abs(supplier.balance))}
                      {supplier.balance > 0 ? ' due' : ' advance'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Search supplier */
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">Select Supplier <span className="text-gray-400 font-normal">(optional)</span></p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search supplier by name or code..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    onFocus={() => setShowSupplierSearch(true)}
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                  />
                </div>

                {showSupplierSearch && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {supplierLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                      </div>
                    ) : supplierResults.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                        {supplierResults.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSupplier(s);
                              setShowSupplierSearch(false);
                              setSupplierSearch('');
                              setSupplierResults([]);
                            }}
                            className="w-full px-4 py-3 text-left active:bg-gray-50 transition-colors"
                          >
                            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {s.code && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                  {s.code}
                                </span>
                              )}
                              {s.phone && (
                                <span className="text-[11px] text-gray-400">{s.phone}</span>
                              )}
                              {typeof s.balance === 'number' && (
                                <span className={cn(
                                  'text-[10px] font-bold ml-auto',
                                  s.balance > 0 ? 'text-red-500' : 'text-green-600'
                                )}>
                                  {formatBDT(Math.abs(s.balance))}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : supplierSearch.trim() ? (
                      <div className="py-8 text-center">
                        <Truck className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                        <p className="text-xs text-gray-400">No suppliers found</p>
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <Search className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                        <p className="text-xs text-gray-400">Type to search suppliers</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Skip / Next buttons */}
            <div className="flex gap-2.5">
              {!supplier && (
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                onClick={handleNext}
                className={cn(
                  'flex-1 h-11 rounded-xl text-sm font-semibold transition-all',
                  supplier
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-gray-100 text-gray-400'
                )}
                disabled={!supplier}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1.5 inline-block" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================== STEP 2: Add Products ============================== */}
        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Items list — last added on top */}
            {items.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-sm font-semibold text-gray-700">
                  Items ({items.length})
                </p>
                {[...items].reverse().map((item, idx) => (
                  <motion.div
                    key={item._localId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.03 } }}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                          {item.serialTracked && (
                            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                              SERIAL
                            </span>
                          )}
                        </div>
                        {item.productBrand && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{item.productBrand}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item._localId)}
                        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center active:bg-red-100 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      {/* Quantity */}
                      <div className="flex items-center gap-0 bg-gray-50 rounded-xl border border-gray-200">
                        <button
                          onClick={() => updateItemQty(item._localId, -1)}
                          disabled={item.quantity <= 1}
                          className="w-9 h-9 flex items-center justify-center active:bg-gray-100 transition-colors disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) => setItemQty(item._localId, e.target.value)}
                          className="w-10 h-9 text-center text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none"
                        />
                        <button
                          onClick={() => updateItemQty(item._localId, 1)}
                          className="w-9 h-9 flex items-center justify-center active:bg-gray-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                      </div>

                      {/* Unit cost */}
                      <div className="flex-1 min-w-0">
                        <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wider block mb-0.5">Unit Cost</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitCost}
                          onChange={(e) => setItemCost(item._localId, e.target.value)}
                          className="w-full h-9 px-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                        />
                      </div>

                      {/* Line total */}
                      <div className="text-right shrink-0">
                        <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wider block mb-0.5">Total</label>
                        <p className="text-sm font-bold text-gray-900">
                          {formatBDT(item.quantity * item.unitCost)}
                        </p>
                      </div>
                    </div>

                    {/* Sell Price + Warranty row */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 min-w-0">
                        <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wider block mb-0.5">Sell Price</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice || ''}
                          onChange={(e) => setItems((prev) => prev.map((it) =>
                            it._localId === item._localId ? { ...it, unitPrice: parseFloat(e.target.value) || 0 } : it
                          ))}
                          placeholder="0"
                          className="w-full h-8 px-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                        />
                      </div>
                      <div className="shrink-0">
                        <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wider block mb-0.5">Warranty</label>
                        <select
                          value={item.warrantyMonths}
                          onChange={(e) => setItems((prev) => prev.map((it) =>
                            it._localId === item._localId ? { ...it, warrantyMonths: parseInt(e.target.value) } : it
                          ))}
                          className="h-8 px-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                        >
                          <option value={0}>None</option>
                          <option value={6}>6 mo</option>
                          <option value={12}>1 yr</option>
                          <option value={24}>2 yr</option>
                          <option value={36}>3 yr</option>
                          <option value={48}>4 yr</option>
                          <option value={60}>5 yr</option>
                        </select>
                      </div>
                    </div>

                    {/* Serial number entry (Phase 5) */}
                    {item.serialTracked && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={() => toggleSerialEntry(item._localId)}
                          className="flex items-center gap-2 w-full text-left group"
                        >
                          <Shield className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-xs font-semibold text-gray-700 flex-1">
                            Serial Numbers
                          </span>
                          <span className={cn(
                            'text-[10px] font-bold',
                            item.serialNumbers.length >= item.quantity
                              ? 'text-emerald-600'
                              : item.serialNumbers.length > 0
                                ? 'text-amber-600'
                                : 'text-gray-400'
                          )}>
                            {item.serialNumbers.length}/{item.quantity}
                          </span>
                          {item.showSerialEntry
                            ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          }
                        </button>

                        <AnimatePresence>
                          {item.showSerialEntry && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <SerialNumberEntry
                                  targetQty={item.quantity}
                                  initialSerials={item.serialNumbers}
                                  productName={item.productName}
                                  onChange={(serials) => handleSerialsChange(item._localId, serials)}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Running total — distinct colored section */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-4 shadow-lg shadow-violet-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-violet-100 uppercase tracking-wider font-medium">Running Total</p>
                      <p className="text-2xl font-bold text-white mt-0.5">{formatBDT(subtotal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-violet-100 uppercase tracking-wider">{items.length} item(s)</p>
                      <p className="text-xs text-violet-100 mt-0.5">
                        {items.reduce((s, it) => s + it.quantity, 0)} unit(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Product search */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                {items.length > 0 ? 'Add More Products' : 'Search Products'}
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by product name or brand..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductSearch(true);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                  className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                />
              </div>

              {showProductSearch && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {productLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                    </div>
                  ) : productResults.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {productResults.map((p) => {
                        const added = isProductAdded(p.id);
                        return (
                          <button
                            key={p.id}
                            disabled={added}
                            onClick={() => addProduct(p)}
                            className={cn(
                              'w-full px-4 py-3 text-left active:bg-gray-50 transition-colors',
                              added && 'opacity-50'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                  {p.serialTracked && (
                                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                                      SERIAL
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {p.brand && (
                                    <span className="text-[10px] text-gray-400">{p.brand}</span>
                                  )}
                                  <span className="text-[10px] text-gray-400">Stock: {p.stock}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-gray-900">{formatBDT(p.costPrice)}</p>
                                {added && (
                                  <span className="text-[10px] text-violet-500 font-medium">Added</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : productSearch.trim() ? (
                    <div className="py-8 text-center">
                      <Package className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                      <p className="text-xs text-gray-400">No products found</p>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Search className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
                      <p className="text-xs text-gray-400">Type to search products</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Back / Next */}
            <div className="flex gap-2.5">
              <button
                onClick={() => setStep(1)}
                className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline-block mr-1" />
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={items.length === 0}
                className={cn(
                  'flex-1 h-11 rounded-xl text-sm font-semibold transition-all',
                  items.length > 0
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                Review Order
                <ArrowRight className="w-4 h-4 ml-1.5 inline-block" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================== STEP 3: Review & Submit ============================== */}
        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Supplier summary */}
            {supplier && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Truck className="w-4.5 h-4.5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Supplier</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{supplier.name}</p>
                    {supplier.phone && (
                      <p className="text-[11px] text-gray-400">{supplier.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Invoice # */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-700">Invoice #</label>
                <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
              </div>
              <input
                type="text"
                placeholder="Enter invoice number..."
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
              />
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-700">Notes</label>
                <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
              </div>
              <textarea
                placeholder="Add any notes about this purchase..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all resize-none"
              />
            </div>

            {/* Items summary table */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">
                  Items ({items.length})
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] text-gray-400 font-semibold uppercase tracking-wider pb-2">Product</th>
                      <th className="text-center text-[10px] text-gray-400 font-semibold uppercase tracking-wider pb-2 w-14">Qty</th>
                      <th className="text-right text-[10px] text-gray-400 font-semibold uppercase tracking-wider pb-2 w-24">Unit Cost</th>
                      <th className="text-right text-[10px] text-gray-400 font-semibold uppercase tracking-wider pb-2 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => (
                      <tr key={item._localId}>
                        <td className="py-2.5 pr-2">
                          <p className="text-xs font-semibold text-gray-900 truncate max-w-[120px]">{item.productName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.productBrand && (
                              <p className="text-[10px] text-gray-400">{item.productBrand}</p>
                            )}
                            {item.serialTracked && (
                              <span className={cn(
                                'text-[9px] font-bold px-1.5 py-0.5 rounded',
                                item.serialNumbers.length > 0
                                  ? item.serialNumbers.length >= item.quantity
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-amber-50 text-amber-600'
                                  : 'bg-amber-50 text-amber-500'
                              )}>
                                {item.serialNumbers.length > 0
                                  ? `${item.serialNumbers.length}/${item.quantity} SN`
                                  : 'No SN'
                                }
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-center text-xs font-medium text-gray-700">{item.quantity}</td>
                        <td className="py-2.5 text-right text-xs font-medium text-gray-700">{formatBDT(item.unitCost)}</td>
                        <td className="py-2.5 text-right text-xs font-bold text-gray-900">{formatBDT(item.quantity * item.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discount */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-gray-400" />
                <label className="text-sm font-semibold text-gray-700">Discount</label>
                <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">৳</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={discountAmount || ''}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setDiscountAmount(isNaN(n) ? 0 : Math.max(0, n));
                  }}
                  className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all"
                />
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Subtotal</span>
                <span className="text-sm font-semibold text-gray-700">{formatBDT(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Discount</span>
                  <span className="text-sm font-semibold text-red-500">-{formatBDT(discount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Grand Total</span>
                <span className="text-base font-bold text-violet-600">{formatBDT(grandTotal)}</span>
              </div>
            </div>

            {/* Back / Submit */}
            <div className="flex gap-2.5">
              <button
                onClick={() => setStep(2)}
                disabled={submitting}
                className="h-11 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4 inline-block mr-1" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                className={cn(
                  'flex-1 h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  !submitting && items.length > 0
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Create Purchase Order
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}