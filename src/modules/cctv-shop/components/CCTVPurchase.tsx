'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Plus, X, Search, Loader2, Save, ShoppingCart,
  Package, Trash2, Scan, ClipboardPaste, CheckCircle2, AlertCircle,
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
  serialNumbers: string[]; // Changed to array for scan mode
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

  // Scan state — per cart item
  const [scanInputs, setScanInputs] = useState<Record<number, string>>({});
  const [scanMode, setScanMode] = useState<Record<number, boolean>>({}); // true=scan, false=paste
  const [pasteText, setPasteText] = useState<Record<number, string>>({});
  const [scanFeedback, setScanFeedback] = useState<Record<number, 'ok' | 'dup' | null>>({});
  const scanInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

  // Auto-focus scan input when a serial-tracked item is added
  useEffect(() => {
    cart.forEach((item, index) => {
      if (item.serialTracked && scanMode[index] !== false && scanInputRefs.current[index]) {
        scanInputRefs.current[index]?.focus();
      }
    });
  }, [cart, scanMode]);

  const addToCart = (product: Product) => {
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      toast({ title: 'Already in cart', description: `${product.name} is already added` });
      return;
    }
    const newIndex = cart.length;
    setCart([...cart, {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      costPrice: product.costPrice,
      quantity: 1,
      serialTracked: product.serialTracked,
      serialNumbers: [],
      unit: product.unit,
    }]);
    // Default to scan mode for serial-tracked
    if (product.serialTracked) {
      setScanMode({ ...scanMode, [newIndex]: true });
    }
    setSearchQuery('');
    setShowResults(false);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    // Clean up scan state
    const newScanInputs = { ...scanInputs }; delete newScanInputs[index]; setScanInputs(newScanInputs);
    const newScanMode = { ...scanMode }; delete newScanMode[index]; setScanMode(newScanMode);
    const newPasteText = { ...pasteText }; delete newPasteText[index]; setPasteText(newPasteText);
  };

  const updateCartItem = (index: number, field: keyof CartItem, value: string | number) => {
    setCart(cart.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // ── Scan mode: handle Enter key (barcode scanner sends Enter) ──
  const handleScanEnter = (index: number) => {
    const value = (scanInputs[index] || '').trim();
    if (!value) return;

    const item = cart[index];
    if (!item) return;

    // Check for duplicates within this cart item
    if (item.serialNumbers.includes(value)) {
      // Duplicate — flash red
      setScanFeedback({ ...scanFeedback, [index]: 'dup' });
      setTimeout(() => setScanFeedback({ ...scanFeedback, [index]: null }), 600);
      setScanInputs({ ...scanInputs, [index]: '' });
      scanInputRefs.current[index]?.focus();
      return;
    }

    // Add serial
    const newSerials = [...item.serialNumbers, value];
    updateCartItem(index, 'serialNumbers', newSerials as any);
    updateCartItem(index, 'quantity', newSerials.length);

    // Flash green
    setScanFeedback({ ...scanFeedback, [index]: 'ok' });
    setTimeout(() => setScanFeedback({ ...scanFeedback, [index]: null }), 400);

    // Clear input and refocus
    setScanInputs({ ...scanInputs, [index]: '' });
    scanInputRefs.current[index]?.focus();
  };

  // Remove a scanned serial
  const removeSerial = (index: number, serialIndex: number) => {
    const item = cart[index];
    const newSerials = item.serialNumbers.filter((_, i) => i !== serialIndex);
    updateCartItem(index, 'serialNumbers', newSerials as any);
    updateCartItem(index, 'quantity', newSerials.length || 1);
  };

  // Paste mode: parse pasted text
  const handlePaste = (index: number) => {
    const text = (pasteText[index] || '').trim();
    if (!text) return;
    const serials = text.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0);
    const item = cart[index];
    // Merge with existing, remove duplicates
    const merged = [...new Set([...item.serialNumbers, ...serials])];
    updateCartItem(index, 'serialNumbers', merged as any);
    updateCartItem(index, 'quantity', merged.length);
    setPasteText({ ...pasteText, [index]: '' });
    toast({ title: `${serials.length} serials added`, description: `${merged.length} total for ${item.productName}` });
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);

  const handleSave = async () => {
    if (cart.length === 0) {
      toast({ title: 'Error', description: 'Add at least one product', variant: 'destructive' });
      return;
    }

    // Validate serial-tracked items have at least 1 serial
    for (const item of cart) {
      if (item.serialTracked && item.serialNumbers.length === 0) {
        toast({
          title: 'No serials scanned',
          description: `${item.productName}: scan at least 1 serial number`,
          variant: 'destructive',
        });
        return;
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
            serialNumbers: item.serialNumbers.join('\n'), // Convert array back to string for API
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
        <button onClick={goBack} className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Buy Products</h1>
      </div>

      {/* Supplier + Invoice */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Supplier</Label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white">
              <option value="">Select supplier (optional)</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.phone}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Invoice No. (optional)</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-001" className="h-10 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Product Search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <Label className="text-xs text-gray-600 mb-2 block">Add Products</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type product name, brand, or model..." className="h-10 rounded-xl pl-10" />
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="w-full text-left p-3 hover:bg-violet-50 border-b border-gray-50 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.brand}{p.model ? ` · ${p.model}` : ''}</p>
                  {p.serialTracked && <span className="text-[9px] text-blue-500 font-medium">Serial tracked</span>}
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
          <h2 className="text-sm font-bold text-gray-800">Purchase Items ({cart.length})</h2>

          {cart.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-xl p-3 space-y-3">
              {/* Product name + remove */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500">{item.brand}</p>
                </div>
                <button onClick={() => removeFromCart(index)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>

              {/* Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Cost Price (৳)</label>
                  <Input type="number" value={item.costPrice}
                    onChange={(e) => updateCartItem(index, 'costPrice', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-lg text-sm" min="0" step="0.01" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Quantity</label>
                  <div className="h-9 rounded-lg bg-white border border-gray-200 px-3 flex items-center text-sm font-bold text-gray-900">
                    {item.quantity}
                    {item.serialTracked && <span className="text-[9px] text-violet-500 ml-1">auto</span>}
                  </div>
                </div>
              </div>

              {/* ── SERIAL ENTRY ── */}
              {item.serialTracked && (
                <div className="space-y-2">
                  {/* Mode toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScanMode({ ...scanMode, [index]: true })}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                        scanMode[index] !== false ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      <Scan className="w-3 h-3" /> Scan
                    </button>
                    <button
                      onClick={() => setScanMode({ ...scanMode, [index]: false })}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                        scanMode[index] === false ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      <ClipboardPaste className="w-3 h-3" /> Paste
                    </button>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {item.serialNumbers.length} scanned
                    </span>
                  </div>

                  {/* Scan mode */}
                  {scanMode[index] !== false ? (
                    <div>
                      <div className={cn(
                        'relative rounded-xl border-2 transition-all',
                        scanFeedback[index] === 'ok' ? 'border-emerald-400 bg-emerald-50' :
                        scanFeedback[index] === 'dup' ? 'border-red-400 bg-red-50' :
                        'border-violet-200 bg-white'
                      )}>
                        <Scan className={cn(
                          'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors',
                          scanFeedback[index] === 'ok' ? 'text-emerald-500' :
                          scanFeedback[index] === 'dup' ? 'text-red-500' :
                          'text-violet-400'
                        )} />
                        <input
                          ref={(el) => { scanInputRefs.current[index] = el; }}
                          type="text"
                          value={scanInputs[index] || ''}
                          onChange={(e) => setScanInputs({ ...scanInputs, [index]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanEnter(index); } }}
                          placeholder="Scan barcode or type serial + Enter..."
                          className="w-full h-11 pl-10 pr-3 rounded-xl bg-transparent text-sm font-mono outline-none"
                          autoComplete="off"
                        />
                        {scanFeedback[index] === 'ok' && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                        )}
                        {scanFeedback[index] === 'dup' && (
                          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1">
                        Scan each item — auto-adds on Enter. Stay focused for fast scanning.
                      </p>
                    </div>
                  ) : (
                    /* Paste mode */
                    <div className="space-y-1">
                      <Textarea
                        value={pasteText[index] || ''}
                        onChange={(e) => setPasteText({ ...pasteText, [index]: e.target.value })}
                        placeholder="Paste serials here (one per line or comma-separated)..."
                        className="rounded-lg text-xs font-mono resize-none" rows={3}
                      />
                      <button
                        onClick={() => handlePaste(index)}
                        disabled={!(pasteText[index] || '').trim()}
                        className="text-[10px] px-2 py-1 rounded-lg bg-violet-100 text-violet-600 font-semibold disabled:opacity-50"
                      >
                        Add Serials
                      </button>
                    </div>
                  )}

                  {/* Scanned serials list */}
                  {item.serialNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.serialNumbers.map((serial, si) => (
                        <span key={si} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 border border-violet-100 text-[10px] font-mono text-violet-700">
                          {serial}
                          <button onClick={() => removeSerial(index, si)}
                            className="w-3.5 h-3.5 rounded-full hover:bg-violet-200 flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
              <Input type="number" value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={String(totalAmount)} className="h-10 rounded-xl" min="0" step="0.01" />
              <p className="text-[10px] text-gray-400">Leave empty to pay full amount</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes..." className="h-10 rounded-xl" />
            </div>
          </div>
        </div>
      )}

      {/* Total + Save */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-800">Total Amount</span>
            <span className="text-xl font-bold text-violet-600">৳{totalAmount.toLocaleString()}</span>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
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
