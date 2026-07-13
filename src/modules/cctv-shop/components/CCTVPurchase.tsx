'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, X, Search, Loader2, Save, ShoppingCart,
  Package, Trash2, ChevronDown,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Product {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  serialTracked: boolean;
  costPrice: number;
  sellPrice: number;
  stock: number;
  unit: string;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
}

interface CartItem {
  productId: string;
  productName: string;
  brand: string;
  costPrice: number;
  quantity: number;
  serialTracked: boolean;
  serialNumbers: string;
  unit: string;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVPurchase() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Load suppliers and products
  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      fetch(`/api/businesses/${businessId}/cctv/suppliers`).then((r) => r.json()),
      fetch(`/api/businesses/${businessId}/cctv/products?limit=100`).then((r) => r.json()),
    ]).then(([supData, prodData]) => {
      setSuppliers(Array.isArray(supData) ? supData : supData.suppliers || []);
      setProducts(prodData.products || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [businessId]);

  // Debounced product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const timeout = setTimeout(() => {
      const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.model || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 8));
      setShowResults(true);
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery, products]);

  const addToCart = (product: Product) => {
    // Check if already in cart
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      toast({ title: 'Already in cart', description: `${product.name} is already added` });
      return;
    }
    setCart([...cart, {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      costPrice: product.costPrice,
      quantity: 1,
      serialTracked: product.serialTracked,
      serialNumbers: '',
      unit: product.unit,
    }]);
    setSearchQuery('');
    setShowResults(false);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartItem = (index: number, field: keyof CartItem, value: string | number) => {
    setCart(cart.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

  const handleSave = async () => {
    if (cart.length === 0) {
      toast({ title: 'Error', description: 'Add at least one product', variant: 'destructive' });
      return;
    }

    // Validate serial-tracked items
    for (const item of cart) {
      if (item.serialTracked) {
        const serials = item.serialNumbers.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0);
        if (serials.length !== item.quantity) {
          toast({
            title: 'Serial count mismatch',
            description: `${item.productName}: expected ${item.quantity} serials, got ${serials.length}`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierId || null,
          supplierName: suppliers.find((s) => s.id === supplierId)?.name || null,
          invoiceNo: invoiceNo || null,
          paidAmount: paidAmount ? parseFloat(paidAmount) : totalAmount,
          notes: notes || null,
          items: cart.map((item) => ({
            ...item,
            costPrice: parseFloat(String(item.costPrice)) || 0,
            quantity: parseInt(String(item.quantity)) || 1,
          })),
        }),
      });

      if (res.ok) {
        toast({ title: 'Purchase saved', description: `${cart.length} items added to stock` });
        goBack();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Buy Products</h1>
      </div>

      {/* Supplier + Invoice */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Supplier</Label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white"
            >
              <option value="">Select supplier (optional)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.phone}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Invoice No. (optional)</Label>
            <Input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-001"
              className="h-10 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Product Search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <Label className="text-xs text-gray-600 mb-2 block">Add Products</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type product name, brand, or model..."
            className="h-10 rounded-xl pl-10"
          />
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full text-left p-3 hover:bg-violet-50 border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.brand}{p.model ? ` · ${p.model}` : ''}</p>
                </button>
              ))}
            </div>
          )}
          {showResults && searchResults.length === 0 && searchQuery.trim() && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-center text-xs text-gray-400">
              No products found. Add products first from the Products page.
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Purchase Items ({cart.length})</h2>
          </div>

          {cart.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-3 space-y-3">
              {/* Product name + remove */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500">{item.brand}</p>
                </div>
                <button
                  onClick={() => removeFromCart(index)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>

              {/* Price + Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Cost Price (৳)</label>
                  <Input
                    type="number"
                    value={item.costPrice}
                    onChange={(e) => updateCartItem(index, 'costPrice', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-lg text-sm"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Quantity</label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateCartItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="h-9 rounded-lg text-sm"
                    min="1"
                    disabled={item.serialTracked}
                  />
                  {item.serialTracked && (
                    <p className="text-[9px] text-violet-500">Set by serial count</p>
                  )}
                </div>
              </div>

              {/* Serial numbers (only for serial-tracked) */}
              {item.serialTracked && (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">
                    Serial Numbers (one per line) — {item.quantity} needed
                  </label>
                  <Textarea
                    value={item.serialNumbers}
                    onChange={(e) => {
                      const serials = e.target.value.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0);
                      updateCartItem(index, 'quantity', serials.length || 1);
                      updateCartItem(index, 'serialNumbers', e.target.value);
                    }}
                    placeholder={`SN-001\nSN-002\nSN-003`}
                    className="rounded-lg text-xs font-mono resize-none"
                    rows={3}
                  />
                  <p className="text-[9px] text-gray-400">
                    Type or paste serial numbers. Quantity auto-updates.
                  </p>
                </div>
              )}

              {/* Line total */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  ৳{(item.costPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment + Notes */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Amount Paid (৳)</Label>
              <Input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={String(totalAmount)}
                className="h-10 rounded-xl"
                min="0"
                step="0.01"
              />
              <p className="text-[10px] text-gray-400">Leave empty to pay full amount</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes..."
                className="h-10 rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Total + Save */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-800">Total Amount</span>
            <span className="text-xl font-bold text-violet-600">
              ৳{totalAmount.toLocaleString()}
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {cart.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No products added yet</p>
          <p className="text-xs text-gray-400 mt-1">Search and add products above to start a purchase</p>
        </div>
      )}
    </motion.div>
  );
}
