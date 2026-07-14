'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, X, Search, Loader2, Save, ShoppingCart,
  Trash2, Scan, User,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuickPartyDialog } from './QuickPartyDialog';
import { PaymentMethodSelector } from './PaymentMethodSelector';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  model?: string | null;
  sellPrice: number;
  costPrice: number;
  stock: number;
  serialTracked: boolean;
  warrantyMonths: number;
  unit: string;
}

interface CartItem {
  productId: string;
  productName: string;
  brand: string;
  sellPrice: number;
  costPrice: number;
  quantity: number;
  serialNumber?: string;
  warrantyMonths: number;
  serialTracked: boolean;
}

interface SerialSearchResult {
  id: string;
  serialNumber: string;
  status: string;
  product: {
    id: string;
    name: string;
    brand: string;
    sellPrice: number;
    costPrice: number;
    warrantyMonths: number;
  };
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CCTVSales() {
  const { goBack } = useCCTVNavStore();
  const businessId = useAuthStore((s) => s.session?.business?.id);
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Search state — the key innovation: search by serial number OR product name
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<{ type: 'serial' | 'product'; serialResult?: SerialSearchResult; product?: Product }[]>([]);
  const [searchingSerials, setSearchingSerials] = useState(false);

  // Customer dialog state
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Load customers and products
  useEffect(() => {
    if (!businessId) return;
    Promise.all([
      fetch(`/api/businesses/${businessId}/cctv/customers`).then((r) => r.json()),
      fetch(`/api/businesses/${businessId}/cctv/products?limit=100`).then((r) => r.json()),
    ]).then(([custData, prodData]) => {
      setCustomers(Array.isArray(custData) ? custData : []);
      setProducts(prodData.products || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [businessId]);

  // Smart search: if query looks like a serial number, search serials first
  // Otherwise search products
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeout = setTimeout(async () => {
      const query = searchQuery.trim();
      const results: { type: 'serial' | 'product'; serialResult?: SerialSearchResult; product?: Product }[] = [];

      // Always search serial items (the key innovation)
      if (query.length >= 2) {
        setSearchingSerials(true);
        try {
          const res = await fetch(`/api/businesses/${businessId}/cctv/serial-items?search=${encodeURIComponent(query)}&status=IN_STOCK`);
          if (res.ok) {
            const data = await res.json();
            const serialItems = (data.items || []).slice(0, 5);
            for (const item of serialItems) {
              results.push({ type: 'serial', serialResult: item });
            }
          }
        } catch {}
        setSearchingSerials(false);
      }

      // Also search products by name/brand
      const productMatches = products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.brand.toLowerCase().includes(query.toLowerCase()) ||
        (p.model || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      for (const p of productMatches) {
        results.push({ type: 'product', product: p });
      }

      setSearchResults(results);
      setShowResults(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, businessId, products]);

  const addToCart = (item: { type: 'serial' | 'product'; serialResult?: SerialSearchResult; product?: Product }) => {
    // Check if already in cart (by serial or productId)
    if (item.type === 'serial' && item.serialResult) {
      const exists = cart.find((c) => c.serialNumber === item.serialResult!.serialNumber);
      if (exists) {
        toast({ title: 'Already in cart', description: `Serial ${item.serialResult.serialNumber} already added` });
        return;
      }
      // Add serial item to cart
      setCart([...cart, {
        productId: item.serialResult.product.id,
        productName: item.serialResult.product.name,
        brand: item.serialResult.product.brand,
        sellPrice: item.serialResult.product.sellPrice,
        costPrice: item.serialResult.product.costPrice,
        quantity: 1,
        serialNumber: item.serialResult.serialNumber,
        warrantyMonths: item.serialResult.product.warrantyMonths,
        serialTracked: true,
      }]);
    } else if (item.type === 'product' && item.product) {
      // Check if already in cart (by productId, for non-serial)
      if (!item.product.serialTracked) {
        const exists = cart.find((c) => c.productId === item.product!.id && !c.serialNumber);
        if (exists) {
          toast({ title: 'Already in cart', description: `${item.product.name} already added` });
          return;
        }
      }
      // Check stock for non-serial items
      if (!item.product.serialTracked && item.product.stock <= 0) {
        toast({ title: 'Out of stock', description: `${item.product.name} has no stock`, variant: 'destructive' });
        return;
      }
      setCart([...cart, {
        productId: item.product.id,
        productName: item.product.name,
        brand: item.product.brand,
        sellPrice: item.product.sellPrice,
        costPrice: item.product.costPrice,
        quantity: 1,
        warrantyMonths: item.product.warrantyMonths,
        serialTracked: item.product.serialTracked,
      }]);
    }

    setSearchQuery('');
    setShowResults(false);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartItem = (index: number, field: keyof CartItem, value: string | number) => {
    setCart(cart.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);

  const handleSave = async () => {
    if (cart.length === 0) {
      toast({ title: 'Error', description: 'Add at least one product', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/cctv/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || null,
          customerName: selectedCustomer?.name || null,
          paidAmount: paidAmount ? parseFloat(paidAmount) : totalAmount,
          paymentMethod,
          notes: notes || null,
          items: cart.map((item) => ({
            ...item,
            sellPrice: parseFloat(String(item.sellPrice)) || 0,
            quantity: parseInt(String(item.quantity)) || 1,
          })),
        }),
      });

      if (res.ok) {
        toast({ title: 'Sale completed', description: `${cart.length} item(s) sold` });
        goBack();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed', variant: 'destructive' });
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
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Sell Products</h1>
      </div>

      {/* Customer */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <Label className="text-xs text-gray-600 mb-2 block">Customer</Label>
        {selectedCustomer ? (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{selectedCustomer.name}</p>
              <p className="text-xs text-gray-500">{selectedCustomer.phone || 'No phone'}</p>
            </div>
            <button onClick={() => { setSelectedCustomer(null); setCustomerId(''); }}
              className="w-8 h-8 rounded-lg hover:bg-blue-100 flex items-center justify-center shrink-0">
              <X className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomerDialog(true)}
              className="flex-1 h-10 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:border-violet-300 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <User className="w-4 h-4" /> Select Customer (optional)
            </button>
          </div>
        )}
      </div>

      {/* Customer Dialog */}
      <QuickPartyDialog
        type="customer"
        open={showCustomerDialog}
        onClose={() => setShowCustomerDialog(false)}
        existingParties={customers}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setCustomerId(c.id);
          // Refresh customers list to include newly created ones
          if (businessId) {
            fetch(`/api/businesses/${businessId}/cctv/customers`).then(r => r.json()).then(data => {
              setCustomers(Array.isArray(data) ? data : []);
            }).catch(() => {});
          }
        }}
      />

      {/* Smart Search — type serial OR product name */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <Label className="text-xs text-gray-600 mb-2 block">Add Products (type serial number or product name)</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {searchingSerials ? (
              <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            ) : (
              <Scan className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type or scan serial number... or product name"
            className="h-10 rounded-xl pl-10"
            autoFocus
          />

          {/* Search results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => addToCart(result)}
                  className="w-full text-left p-3 hover:bg-violet-50 border-b border-gray-50 last:border-0"
                >
                  {result.type === 'serial' && result.serialResult ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">SERIAL</span>
                        <span className="text-sm font-mono font-semibold text-gray-900">{result.serialResult.serialNumber}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {result.serialResult.product.name} · {result.serialResult.product.brand}
                      </p>
                      <p className="text-xs text-violet-600 font-semibold mt-0.5">
                        ৳{result.serialResult.product.sellPrice.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">PRODUCT</span>
                        <span className="text-sm font-semibold text-gray-900">{result.product!.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {result.product!.brand}{result.product!.stock > 0 ? ` · ${result.product!.stock} in stock` : ' · OUT OF STOCK'}
                      </p>
                      <p className="text-xs text-violet-600 font-semibold mt-0.5">
                        ৳{result.product!.sellPrice.toLocaleString()}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {showResults && searchResults.length === 0 && !searchingSerials && searchQuery.trim().length >= 2 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-center text-xs text-gray-400">
              No matching serial or product found
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Cart ({cart.length})</h2>
          </div>

          {cart.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500">{item.brand}</p>
                  {item.serialNumber && (
                    <p className="text-[10px] font-mono text-blue-600 mt-0.5">SN: {item.serialNumber}</p>
                  )}
                </div>
                <button onClick={() => removeFromCart(index)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>

              {/* Price + Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Sell Price (৳)</label>
                  <Input type="number" value={item.sellPrice}
                    onChange={(e) => updateCartItem(index, 'sellPrice', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-lg text-sm" min="0" step="0.01" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Quantity</label>
                  <Input type="number" value={item.quantity}
                    onChange={(e) => updateCartItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    className="h-9 rounded-lg text-sm" min="1"
                    disabled={item.serialTracked} />
                </div>
              </div>

              {/* Line total */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {item.warrantyMonths > 0 ? `${item.warrantyMonths}mo warranty` : 'No warranty'}
                </span>
                <span className="font-semibold text-gray-900">
                  ৳{(item.sellPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Amount Paid (৳)</Label>
            <Input type="number" value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder={String(totalAmount)}
              className="h-10 rounded-xl" min="0" step="0.01" />
            <p className="text-[10px] text-gray-400">
              Leave empty for full payment · Due: ৳{Math.max(0, totalAmount - (parseFloat(paidAmount) || totalAmount)).toLocaleString()}
            </p>
          </div>

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            label="Payment Method"
          />
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
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {cart.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
          <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">Cart is empty</p>
          <p className="text-xs text-gray-400 mt-1">
            Type or scan a serial number above to instantly find and add a product
          </p>
        </div>
      )}
    </motion.div>
  );
}
