'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Search, X, Plus, Minus, Trash2,
  ShoppingCart, User, Phone, Package, Loader2,
  Banknote, CreditCard, Smartphone, Check, CircleDollarSign,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentMethod } from '@/modules/mobile-shop/types';
import { useMSBusinessId } from '@/modules/mobile-shop/hooks/use-ms-business-id';
import { SerialPickerDialog } from './SerialPickerDialog';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const slideLeft = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: -60, transition: { duration: 0.2, ease: 'easeIn' } },
};

const slideRight = {
  initial: { opacity: 0, x: -60 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: 60, transition: { duration: 0.2, ease: 'easeIn' } },
};

const formatBDT = (n: number | null | undefined) => {
  if (n == null) return '৳0';
  return '৳' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

interface ProductResult {
  id: string;
  name: string;
  brand: string;
  sellPrice: number;
  stock: number;
  serialTracked: boolean;
}

interface CartItem {
  productId: string;
  name: string;
  brand: string;
  unitPrice: number;
  quantity: number;
  serialTracked: boolean;
  maxStock: number;
  serialItemId?: string | null;
  serialNumber?: string | null;
}

interface TempPayment {
  _tempId: string;
  method: PaymentMethod;
  amount: number;
  referenceNumber: string;
}

const PAYMENT_METHODS: {
  method: PaymentMethod;
  label: string;
  icon: typeof Banknote;
  bg: string;
  border: string;
  iconColor: string;
  needsRef: boolean;
  refLabel: string;
  refPlaceholder: string;
}[] = [
  { method: 'CASH', label: 'Cash', icon: Banknote, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-600', needsRef: false, refLabel: '', refPlaceholder: '' },
  { method: 'CARD', label: 'Card', icon: CreditCard, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-600', needsRef: true, refLabel: 'Card Terminal Reference', refPlaceholder: 'e.g. TID-001234' },
  { method: 'BKASH', label: 'bKash', icon: Smartphone, bg: 'bg-pink-50', border: 'border-pink-200', iconColor: 'text-pink-600', needsRef: true, refLabel: 'Transaction ID', refPlaceholder: 'e.g. TXN123ABC' },
  { method: 'NAGAD', label: 'Nagad', icon: Smartphone, bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-600', needsRef: true, refLabel: 'Transaction ID', refPlaceholder: 'e.g. TXN456DEF' },
  { method: 'ROCKET', label: 'Rocket', icon: Smartphone, bg: 'bg-purple-50', border: 'border-purple-200', iconColor: 'text-purple-600', needsRef: true, refLabel: 'Transaction ID', refPlaceholder: 'e.g. TXN789GHI' },
];

const METHOD_BADGE_COLORS: Record<PaymentMethod, string> = {
  CASH: 'bg-emerald-100 text-emerald-700',
  CARD: 'bg-blue-100 text-blue-700',
  BKASH: 'bg-pink-100 text-pink-700',
  NAGAD: 'bg-orange-100 text-orange-700',
  ROCKET: 'bg-purple-100 text-purple-700',
};

export function MSSellView() {
  const { goBack } = useMSNavStore();
  const { toast } = useToast();
  const businessId = useMSBusinessId();

  // ── Step control ──
  const [step, setStep] = useState<'cart' | 'payment'>('cart');
  const [direction, setDirection] = useState<1 | -1>(1);

  // ── Customer ──
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // ── Product search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Cart ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountStr, setDiscountStr] = useState('');

  // ── Serial Picker State ──
  const [serialPickerOpen, setSerialPickerOpen] = useState(false);
  const [serialPickerProduct, setSerialPickerProduct] = useState<{ productId: string; name: string; brand: string; sellPrice: number; stock: number } | null>(null);

  // ── Payment ──
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [paymentRefStr, setPaymentRefStr] = useState('');
  const [payments, setPayments] = useState<TempPayment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Computed ──
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = Math.min(Math.max(0, parseFloat(discountStr) || 0), subtotal);
  const totalDue = subtotal - discountAmount;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalDue - totalPaid;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Product search with debounce ──
  const fetchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(
        `/api/businesses/${businessId}/mobile-shop/products?limit=100&search=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : (data.data ?? data.products ?? []));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchProducts(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, fetchProducts]);

  // Reset payment amount when transitioning to payment step
  useEffect(() => {
    if (step === 'payment') {
      setPaymentAmountStr(String(Math.max(0, remaining)));
    }
  }, [step, remaining]);

  // ── Cart actions ──
  const addToCart = (product: ProductResult) => {
    // For serial-tracked products, open serial picker instead of adding directly
    if (product.serialTracked) {
      setSerialPickerProduct({
        productId: product.id,
        name: product.name,
        brand: product.brand,
        sellPrice: product.sellPrice,
        stock: product.stock,
      });
      setSerialPickerOpen(true);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (newQty > product.stock) return prev;
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: newQty } : c
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          unitPrice: product.sellPrice,
          quantity: 1,
          serialTracked: false,
          maxStock: product.stock,
        },
      ];
    });
  };

  const handleSerialSelected = (serialItem: { id: string; serialNumber: string; imei?: string | null }) => {
    if (!serialPickerProduct) return;
    // Check if this serial is already in cart
    const alreadyInCart = cart.some((c) => c.serialItemId === serialItem.id);
    if (alreadyInCart) {
      toast({ title: 'Already in Cart', description: 'This serial unit is already selected.', variant: 'destructive' });
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        productId: serialPickerProduct.productId,
        name: serialPickerProduct.name,
        brand: serialPickerProduct.brand,
        unitPrice: serialPickerProduct.sellPrice,
        quantity: 1,
        serialTracked: true,
        maxStock: serialPickerProduct.stock,
        serialItemId: serialItem.id,
        serialNumber: serialItem.serialNumber,
      },
    ]);
    setSerialPickerOpen(false);
    setSerialPickerProduct(null);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.productId !== productId) return c;
          if (c.serialTracked) return c; // can't change qty for serial-tracked
          const newQty = c.quantity + delta;
          if (newQty <= 0) return c;
          if (newQty > c.maxStock) return c;
          return { ...c, quantity: newQty };
        })
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  // Check if all serial-tracked items have a serial selected
  const hasUnresolvedSerial = cart.some((item) => item.serialTracked && !item.serialItemId);


  // ── Payment actions ──
  const addPayment = () => {
    const amount = parseFloat(paymentAmountStr) || 0;
    if (amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Payment amount must be greater than 0.', variant: 'destructive' });
      return;
    }
    if (amount > remaining + 0.5) {
      toast({ title: 'Excess Amount', description: 'Payment exceeds remaining balance.', variant: 'destructive' });
      return;
    }
    const methodConfig = PAYMENT_METHODS.find((m) => m.method === selectedMethod);
    if (!methodConfig) return;
    if (methodConfig.needsRef && !paymentRefStr.trim()) {
      toast({ title: 'Reference Required', description: `Please enter the ${methodConfig.refLabel.toLowerCase()}.`, variant: 'destructive' });
      return;
    }
    const newPayment: TempPayment = {
      _tempId: Date.now().toString(),
      method: selectedMethod!,
      amount: Math.round(amount),
      referenceNumber: methodConfig.needsRef ? paymentRefStr.trim() : '',
    };
    setPayments((prev) => [...prev, newPayment]);
    setPaymentAmountStr('');
    setPaymentRefStr('');
    setSelectedMethod(null);
  };

  const removePayment = (tempId: string) => {
    setPayments((prev) => prev.filter((p) => p._tempId !== tempId));
  };

  // ── Step navigation ──
  const goToPayment = () => {
    if (cart.length === 0) return;
    setDirection(1);
    setStep('payment');
    setPaymentAmountStr(String(Math.max(0, remaining)));
  };

  const goToCart = () => {
    setDirection(-1);
    setStep('cart');
  };

  // ── Submit sale ──
  const completeSale = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.serialItemId ? { serialItemId: item.serialItemId } : {}),
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          ...(p.referenceNumber ? { referenceNumber: p.referenceNumber } : {}),
        })),
        discountAmount: Math.round(discountAmount),
      };
      if (customerName.trim()) body.customerName = customerName.trim();
      if (customerPhone.trim()) body.customerPhone = customerPhone.trim();

      const res = await fetch(`/api/businesses/${businessId}/mobile-shop/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to create sale');
      }

      toast({ title: 'Sale Complete!', description: `Sale of ${formatBDT(totalDue)} recorded successfully.` });
      resetForm();
      goBack();
    } catch (err) {
      toast({
        title: 'Sale Failed',
        description: err instanceof Error ? err.message : 'Could not complete the sale.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('cart');
    setCustomerName('');
    setCustomerPhone('');
    setSearchQuery('');
    setSearchResults([]);
    setCart([]);
    setDiscountStr('');
    setSelectedMethod(null);
    setPaymentAmountStr('');
    setPaymentRefStr('');
    setPayments([]);
    setIsSubmitting(false);
  };

  const animVariant = direction === 1 ? slideLeft : slideRight;

  // ── Render: Cart Step ──
  const renderCartStep = () => (
    <div className="space-y-4 pb-28">
      {/* Customer fields */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <label className="text-xs font-semibold text-gray-900 block mb-2.5">Customer</label>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-violet-500" />
            </div>
            <Input
              placeholder="Customer name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-9 rounded-xl bg-gray-50 border-gray-100 text-sm focus:ring-violet-400/40 focus:border-violet-400"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-violet-500" />
            </div>
            <Input
              placeholder="Phone number (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              type="tel"
              className="h-9 rounded-xl bg-gray-50 border-gray-100 text-sm focus:ring-violet-400/40 focus:border-violet-400"
            />
          </div>
        </div>
        {!customerName && !customerPhone && (
          <p className="text-[10px] text-gray-400 mt-2 ml-10.5 flex items-center gap-1">
            <User className="w-3 h-3" /> Walk-in Customer
          </p>
        )}
      </div>

      {/* Product search */}
      <div>
        <span className="text-sm font-semibold text-gray-900 px-0.5 block mb-2">Add Products</span>
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
          <Input
            placeholder="Search products by name or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-white border-gray-200 text-sm placeholder:text-gray-400 focus:ring-violet-400/40 focus:border-violet-400"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results */}
        {(searchQuery || isSearching) && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {isSearching ? (
              <>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </>
            ) : searchResults.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <Package className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                <p className="text-xs text-gray-400">No products found</p>
              </div>
            ) : (
              searchResults.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer hover:border-violet-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {product.brand} {product.serialTracked && '· Serial'}
                        {' · Stock: '}{product.stock}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-gray-900">{formatBDT(product.sellPrice)}</span>
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      <div>
        <span className="text-sm font-semibold text-gray-900 px-0.5 block mb-2">Cart</span>
        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
            <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Cart is empty. Search and add products above.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                  onClick={() => {
                    // Allow re-selecting serial for unresolved items
                    if (item.serialTracked && !item.serialItemId) {
                      setSerialPickerProduct({
                        productId: item.productId,
                        name: item.name,
                        brand: item.brand,
                        sellPrice: item.unitPrice,
                        stock: item.maxStock,
                      });
                      setSerialPickerOpen(true);
                    }
                  }}
                  className={cn(
                    'bg-white rounded-xl border border-gray-100 p-3 shadow-sm',
                    item.serialTracked && !item.serialItemId && 'cursor-pointer border-amber-200 hover:border-amber-300'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {item.brand}
                        {item.serialTracked && (
                          <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0 h-4">Serial</Badge>
                        )}
                      </p>
                      {item.serialTracked && item.serialNumber && (
                        <p className="text-[10px] text-violet-600 font-mono mt-0.5 truncate">
                          {item.serialNumber}
                        </p>
                      )}
                      {item.serialTracked && !item.serialNumber && (
                        <p className="text-[10px] text-amber-500 mt-0.5">
                          Tap to select serial unit
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-900 shrink-0">
                      {formatBDT(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <p className="text-[10px] text-gray-400">{formatBDT(item.unitPrice)} × {item.quantity}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.productId, -1)}
                        disabled={item.quantity <= 1}
                        className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <span className="text-sm font-semibold text-gray-900 w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.productId, 1)}
                        disabled={item.serialTracked || item.quantity >= item.maxStock}
                        className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center active:bg-violet-200 transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5 text-violet-600" />
                      </button>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Discount */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <label className="text-xs font-semibold text-gray-900 block mb-2">Discount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">৳</span>
            <Input
              type="number"
              min="0"
              max={subtotal}
              placeholder="0"
              value={discountStr}
              onChange={(e) => setDiscountStr(e.target.value)}
              className="pl-7 h-9 rounded-xl bg-gray-50 border-gray-100 text-sm focus:ring-violet-400/40 focus:border-violet-400"
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-900">{formatBDT(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="font-medium text-red-500">-{formatBDT(discountAmount)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="text-sm font-bold text-gray-900">Total Due</span>
            <span className="text-lg font-bold text-gray-900">{formatBDT(totalDue)}</span>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render: Payment Step ──
  const renderPaymentStep = () => {
    const progressPercent = totalDue > 0 ? Math.min(100, (totalPaid / totalDue) * 100) : 0;
    const isPaidInFull = Math.abs(remaining) < 0.5;
    const hasPayments = payments.length > 0;

    return (
      <div className="space-y-4 pb-36">
        {/* Total due hero */}
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20">
          <p className="text-xs font-medium text-white/70 mb-1">Total Due</p>
          <p className="text-3xl font-bold">{formatBDT(totalDue)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-white/70 mb-1">
              <span>Paid: {formatBDT(totalPaid)}</span>
              <span>Remaining: {formatBDT(remaining > 0 ? remaining : 0)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Payment method selector */}
        <div>
          <span className="text-sm font-semibold text-gray-900 px-0.5 block mb-2.5">Payment Method</span>
          <div className="grid grid-cols-5 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              const isSelected = selectedMethod === pm.method;
              return (
                <button
                  key={pm.method}
                  onClick={() => {
                    setSelectedMethod(pm.method);
                    setPaymentRefStr('');
                    setPaymentAmountStr(String(Math.max(0, remaining)));
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all active:scale-95',
                    isSelected
                      ? `${pm.bg} ${pm.border} ring-2 ring-offset-1 ring-violet-400`
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isSelected ? pm.iconColor : 'text-gray-400')} />
                  <span className={cn('text-[10px] font-semibold leading-tight text-center', isSelected ? 'text-gray-900' : 'text-gray-500')}>
                    {pm.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment input form */}
        {selectedMethod && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              {(() => {
                const pm = PAYMENT_METHODS.find((m) => m.method === selectedMethod)!;
                const Icon = pm.icon;
                return (
                  <>
                    <Icon className={cn('w-4 h-4', pm.iconColor)} />
                    <span className="text-xs font-semibold text-gray-900">Add {pm.label} Payment</span>
                  </>
                );
              })()}
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Amount (৳)</label>
              <Input
                type="number"
                min="1"
                max={Math.max(0, remaining)}
                placeholder="Enter amount"
                value={paymentAmountStr}
                onChange={(e) => setPaymentAmountStr(e.target.value)}
                className="h-10 rounded-xl bg-gray-50 border-gray-100 text-base font-semibold focus:ring-violet-400/40 focus:border-violet-400"
              />
            </div>
            {(() => {
              const pm = PAYMENT_METHODS.find((m) => m.method === selectedMethod);
              if (pm && pm.needsRef) {
                return (
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 block mb-1">{pm.refLabel}</label>
                    <Input
                      type="text"
                      placeholder={pm.refPlaceholder}
                      value={paymentRefStr}
                      onChange={(e) => setPaymentRefStr(e.target.value)}
                      className="h-10 rounded-xl bg-gray-50 border-gray-100 text-sm focus:ring-violet-400/40 focus:border-violet-400"
                    />
                  </div>
                );
              }
              return null;
            })()}
            <button
              onClick={addPayment}
              className="w-full h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-semibold shadow-md shadow-violet-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Payment
            </button>
          </motion.div>
        )}

        {/* Added payments list */}
        {payments.length > 0 && (
          <div>
            <span className="text-sm font-semibold text-gray-900 px-0.5 block mb-2">Payments</span>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {payments.map((p) => {
                  const pm = PAYMENT_METHODS.find((m) => m.method === p.method);
                  return (
                    <motion.div
                      key={p._tempId}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3"
                    >
                      <Badge className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border-0', METHOD_BADGE_COLORS[p.method])}>
                        {pm?.label ?? p.method}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900">{formatBDT(p.amount)}</p>
                        {p.referenceNumber && (
                          <p className="text-[10px] text-gray-400 truncate">{p.referenceNumber}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removePayment(p._tempId)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Remaining balance indicator */}
        {hasPayments && (
          <div className={cn(
            'rounded-2xl border p-4 text-center',
            isPaidInFull
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          )}>
            {isPaidInFull ? (
              <>
                <Check className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-emerald-700">Paid in Full</p>
              </>
            ) : (
              <>
                <CircleDollarSign className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-amber-700">Remaining: {formatBDT(remaining)}</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ──
  return (
    <div className="relative">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center gap-3 pt-1 mb-4">
        <button
          onClick={step === 'payment' ? goToCart : goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          {step === 'cart' ? 'New Sale' : 'Collect Payment'}
        </h1>
        {step === 'cart' && cartItemCount > 0 && (
          <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-2.5 py-1 rounded-full">
            {cartItemCount} item{cartItemCount !== 1 ? 's' : ''}
          </span>
        )}
      </motion.div>

      {/* Step content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={animVariant}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {step === 'cart' ? renderCartStep() : renderPaymentStep()}
        </motion.div>
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 z-40">
        <div className="max-w-[480px] mx-auto bg-white/95 backdrop-blur-xl border-t border-gray-100 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {step === 'cart' ? (
            <>
              {cart.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-xl font-bold text-gray-900">{formatBDT(totalDue)}</span>
                </div>
              )}
              <button
                disabled={cart.length === 0 || hasUnresolvedSerial}
                onClick={goToPayment}
                className={cn(
                  'w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2',
                  cart.length > 0
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {cart.length === 0 ? 'Add Products to Cart' : hasUnresolvedSerial ? 'Select Serial for Tracked Items' : (
                  <>
                    Proceed to Payment
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              disabled={isSubmitting || payments.length === 0}
              onClick={completeSale}
              className={cn(
                'w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2',
                isSubmitting
                  ? 'bg-gray-300 cursor-wait'
                  : payments.length === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : Math.abs(remaining) < 0.5
                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
                      : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20 active:scale-[0.98]'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : payments.length === 0 ? (
                'Add at least one payment'
              ) : Math.abs(remaining) < 0.5 ? (
                <>
                  <Check className="w-4 h-4" />
                  Complete Sale (Paid in Full)
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Complete Sale (Partial Payment)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Serial Picker Dialog ── */}
      <SerialPickerDialog
        open={serialPickerOpen}
        productId={serialPickerProduct?.productId || ''}
        productName={serialPickerProduct?.name || ''}
        productBrand={serialPickerProduct?.brand || ''}
        onClose={() => {
          setSerialPickerOpen(false);
          setSerialPickerProduct(null);
        }}
        onSelect={handleSerialSelected}
      />
    </div>
  );
}