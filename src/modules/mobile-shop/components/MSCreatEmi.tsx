'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calculator, Sparkles, Search, X, Package, ChevronDown } from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const MONTH_PRESETS = [3, 6, 12, 18, 24];

interface ProductOption {
  id: string;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  barcode?: string | null;
  inventory?: { stockQuantity: number } | null;
}

export function MSCreatEmi() {
  const { goBack, navigate } = useMSNavStore();
  const businessId = useMSBusinessId();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Product selector state
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [selectedProductBrand, setSelectedProductBrand] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  const [totalAmount, setTotalAmount] = useState('');
  const [downPayment, setDownPayment] = useState('0');
  // Interest rate is permanently 0 — no state needed
  const [months, setMonths] = useState('12');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next.toISOString().split('T')[0];
  });
  const [graceDays, setGraceDays] = useState('3');
  const [notes, setNotes] = useState('');

  // ── Fetch products for dropdown ──
  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      setProductsLoading(true);
      try {
        const res = await fetch(`/api/businesses/${businessId}/products?limit=100`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list: ProductOption[] = Array.isArray(data) ? data : data.products ?? [];
          setProducts(list);
        }
      } catch { /* silent */ }
      if (!cancelled) setProductsLoading(false);
    };
    fetchProducts();
    return () => { cancelled = true; };
  }, [businessId]);

  // ── Filtered products ──
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.genericName?.toLowerCase().includes(q) ||
        p.manufacturer?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  // ── Get stock for selected product ──
  const selectedProductStock = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId)?.inventory?.stockQuantity ?? null;
  }, [selectedProductId, products]);

  // Computed — interest-free
  const computed = useMemo(() => {
    const total = parseFloat(totalAmount) || 0;
    const down = parseFloat(downPayment) || 0;
    const m = parseInt(months) || 0;
    const financed = Math.max(0, total - down);
    const emi = financed > 0 && m > 0 ? financed / m : 0;
    return { emi, totalInterest: 0, grandTotal: financed };
  }, [totalAmount, downPayment, months]);

  const financed = Math.max(0, (parseFloat(totalAmount) || 0) - (parseFloat(downPayment) || 0));

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast({ title: 'Customer name required', variant: 'destructive' }); return; }
    if (!customerPhone.trim()) { toast({ title: 'Customer phone required', variant: 'destructive' }); return; }
    if (!selectedProductName.trim()) { toast({ title: 'Select a product', variant: 'destructive' }); return; }
    if (!totalAmount || parseFloat(totalAmount) <= 0) { toast({ title: 'Enter a valid total amount', variant: 'destructive' }); return; }
    if (!months || parseInt(months) <= 0) { toast({ title: 'Enter valid months', variant: 'destructive' }); return; }
    if (!startDate) { toast({ title: 'Select a start date', variant: 'destructive' }); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/emi-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          productId: selectedProductId || undefined,
          productName: selectedProductName.trim(),
          productBrand: selectedProductBrand.trim() || undefined,
          totalAmount: parseFloat(totalAmount),
          downPayment: parseFloat(downPayment) || 0,
          interestRate: 0,
          interestType: 'REDUCING',
          months: parseInt(months),
          startDate,
          graceDays: parseInt(graceDays) || 3,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        const plan = await res.json();
        toast({ title: 'EMI plan created!' });
        navigate('emi-detail', plan.id);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error || 'Failed to create', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Create EMI Plan</h1>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">0% Interest</span>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Customer</h3>
        <Input placeholder="Customer name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <Input placeholder="Phone number *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" />
      </div>

      {/* Product — searchable selector from inventory */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Product</h3>

        {/* Selected product display */}
        {selectedProductName && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-cyan-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-cyan-800 truncate">{selectedProductName}</p>
              <div className="flex items-center gap-2 text-[10px] text-cyan-500">
                {selectedProductBrand && <span>{selectedProductBrand}</span>}
                {selectedProductStock !== null && (
                  <span className="px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-600 font-medium">
                    Stock: {selectedProductStock}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setSelectedProductId(''); setSelectedProductName(''); setSelectedProductBrand(''); }}
              className="w-6 h-6 rounded-full bg-cyan-200 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-cyan-600" />
            </button>
          </div>
        )}

        {/* Product search dropdown */}
        {!selectedProductName && (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={productsLoading ? 'Loading products...' : 'Search product by name, brand, or barcode...'}
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                onFocus={() => setShowProductDropdown(true)}
                disabled={productsLoading}
                className="pl-9 pr-10 bg-gray-50 border-0 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {showProductDropdown && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                {productsLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                    <p className="text-[10px] text-gray-400 mt-1">Loading products...</p>
                  </div>
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map((p) => {
                    const stock = p.inventory?.stockQuantity ?? 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setSelectedProductName(p.name);
                          setSelectedProductBrand(p.manufacturer || '');
                          setShowProductDropdown(false);
                          setProductSearch('');
                        }}
                        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                            stock > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
                          )}>
                            {stock} in stock
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                          {p.manufacturer && <span>{p.manufacturer}</span>}
                          {p.barcode && <span>· {p.barcode}</span>}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-xs text-gray-400">No products found</p>
                    <p className="text-[10px] text-gray-300 mt-1">Add products from the Stock section first</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Financial Terms */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Financial Terms</h3>

        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Total Amount (৳)</label>
          <Input type="number" placeholder="50000" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Down Payment (৳)</label>
          <Input type="number" placeholder="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
        </div>

        {/* Month presets */}
        <div>
          <label className="text-[11px] text-gray-500 mb-1.5 block">Number of Months</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {MONTH_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => setMonths(String(m))}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  parseInt(months) === m
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Input type="number" placeholder="Custom months" value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">First Due Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Grace Days</label>
            <Input type="number" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Live calculation preview — interest-free */}
      {financed > 0 && parseInt(months) > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-cyan-50 rounded-2xl border-2 border-cyan-200 p-4 space-y-2"
        >
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-cyan-600" />
            <span className="text-sm font-semibold text-cyan-900">EMI Calculation</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Interest-Free</span>
          </div>
          <div className="text-center py-2">
            <p className="text-2xl font-bold text-cyan-700">৳{computed.emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-cyan-500">per month × {months} months</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-500">Financed Amount</p>
              <p className="text-xs font-bold text-gray-900">৳{financed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Total Payable</p>
              <p className="text-xs font-bold text-gray-900">৳{computed.grandTotal.toLocaleString()}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Notes (optional)</h3>
        <Textarea
          placeholder="Any additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 rounded-2xl text-sm font-semibold text-white bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Create EMI Plan
      </button>
    </motion.div>
  );
}