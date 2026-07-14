'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, X, Search, Loader2, Save, ShoppingCart,
  Package, Trash2, Scan, ClipboardPaste, CheckCircle2, AlertCircle,
  Minus, Hash, Volume2, VolumeX, Building2,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store-simple';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuickPartyDialog } from './QuickPartyDialog';
import { PaymentMethodSelector } from './PaymentMethodSelector';

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
  warrantyMonths: number;
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
  sellPrice: number;        // suggested sell price (user input)
  quantity: number;         // TARGET quantity (user-set)
  serialTracked: boolean;
  serialNumbers: string[];  // scanned serials (fills up to quantity)
  unit: string;
  warrantyMonths: number;   // warranty period (defaults from product)
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ── Sound feedback (Web Audio API) ──
let audioCtx: AudioContext | null = null;
function playBeep(type: 'ok' | 'dup' | 'done') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    if (type === 'ok') {
      osc.frequency.value = 880; // high beep — success
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'dup') {
      osc.frequency.value = 220; // low buzz — duplicate
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'done') {
      // Triple beep — target reached
      [659, 784, 988].forEach((freq, i) => {
        const o = audioCtx!.createOscillator();
        const g = audioCtx!.createGain();
        o.connect(g);
        g.connect(audioCtx!.destination);
        o.frequency.value = freq;
        const t = audioCtx!.currentTime + i * 0.08;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(t);
        o.stop(t + 0.1);
      });
    }
  } catch { /* audio not available */ }
}

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
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Supplier dialog state
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);

  // Product search
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Scan state — per cart item
  const [scanInputs, setScanInputs] = useState<Record<number, string>>({});
  const [scanMode, setScanMode] = useState<Record<number, boolean>>({}); // true=scan, false=paste
  const [pasteText, setPasteText] = useState<Record<number, string>>({});
  const [scanFeedback, setScanFeedback] = useState<Record<number, 'ok' | 'dup' | 'full' | null>>({});
  const scanInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [soundOn, setSoundOn] = useState(true);

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

  // ── Add to cart: default quantity = 1 ──
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
      sellPrice: product.sellPrice,
      quantity: 1,
      serialTracked: product.serialTracked,
      serialNumbers: [],
      unit: product.unit,
      warrantyMonths: product.warrantyMonths || 0,
    }]);
    if (product.serialTracked) {
      setScanMode((prev) => ({ ...prev, [newIndex]: true }));
    }
    setSearchQuery('');
    setShowResults(false);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    setScanInputs((prev) => { const n = { ...prev }; delete n[index]; return n; });
    setScanMode((prev) => { const n = { ...prev }; delete n[index]; return n; });
    setPasteText((prev) => { const n = { ...prev }; delete n[index]; return n; });
    setScanFeedback((prev) => { const n = { ...prev }; delete n[index]; return n; });
    delete scanInputRefs.current[index];
  };

  // ── SINGLE setCart update — fixes the stale state bug ──
  const updateCartItem = useCallback((index: number, updates: Partial<CartItem>) => {
    setCart((prev) => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  }, []);

  // ── Quantity change: drives the target for serial scanning ──
  const handleQuantityChange = (index: number, newQty: number) => {
    const item = cart[index];
    if (!item) return;
    newQty = Math.max(1, newQty);

    // If serial-tracked and lowering quantity below scanned count, auto-trim
    let newSerials = item.serialNumbers;
    if (item.serialTracked && newQty < item.serialNumbers.length) {
      newSerials = item.serialNumbers.slice(0, newQty);
    }

    updateCartItem(index, { quantity: newQty, serialNumbers: newSerials });
  };

  // ── Scan: handle Enter key (barcode scanner sends Enter) ──
  const handleScanEnter = (index: number) => {
    const value = (scanInputs[index] || '').trim();
    if (!value) return;

    const item = cart[index];
    if (!item) return;

    // Check for duplicates
    if (item.serialNumbers.includes(value)) {
      setScanFeedback((prev) => ({ ...prev, [index]: 'dup' }));
      setTimeout(() => setScanFeedback((prev) => ({ ...prev, [index]: null })), 600);
      setScanInputs((prev) => ({ ...prev, [index]: '' }));
      scanInputRefs.current[index]?.focus();
      if (soundOn) playBeep('dup');
      return;
    }

    // Add serial — quantity AUTO-INCREASES to match scanned count
    const newSerials = [...item.serialNumbers, value];
    updateCartItem(index, { serialNumbers: newSerials, quantity: newSerials.length });

    // Feedback
    setScanFeedback((prev) => ({ ...prev, [index]: 'ok' }));
    setTimeout(() => setScanFeedback((prev) => ({ ...prev, [index]: null })), 400);
    if (soundOn) playBeep('ok');

    // Clear input and refocus for next scan
    setScanInputs((prev) => ({ ...prev, [index]: '' }));
    requestAnimationFrame(() => {
      scanInputRefs.current[index]?.focus();
    });
  };

  // Remove a scanned serial
  const removeSerial = (index: number, serialIndex: number) => {
    const item = cart[index];
    if (!item) return;
    const newSerials = item.serialNumbers.filter((_, i) => i !== serialIndex);
    // Auto-decrement quantity for serial-tracked items
    if (item.serialTracked) {
      updateCartItem(index, { serialNumbers: newSerials, quantity: Math.max(1, newSerials.length) });
    } else {
      updateCartItem(index, { serialNumbers: newSerials });
    }
  };

  // Paste mode: parse pasted text
  const handlePaste = (index: number) => {
    const text = (pasteText[index] || '').trim();
    if (!text) return;
    const serials = text.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.length > 0);
    const item = cart[index];
    if (!item) return;
    // Merge with existing, remove duplicates
    const merged = [...new Set([...item.serialNumbers, ...serials])];
    // Quantity auto-adjusts to scanned count
    updateCartItem(index, { serialNumbers: merged, quantity: merged.length });
    setPasteText((prev) => ({ ...prev, [index]: '' }));
    toast({ title: `${serials.length} serials added`, description: `${merged.length} total for ${item.productName}` });
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
        if (item.serialNumbers.length === 0) {
          toast({
            title: 'No serials scanned',
            description: `${item.productName}: scan at least 1 serial number`,
            variant: 'destructive',
          });
          return;
        }
        if (item.serialNumbers.length !== item.quantity) {
          toast({
            title: 'Quantity mismatch',
            description: `${item.productName}: quantity is ${item.quantity} but only ${item.serialNumbers.length} serials scanned`,
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
          supplierName: selectedSupplier?.name || null,
          invoiceNo: invoiceNo || null,
          paidAmount: paidAmount ? parseFloat(paidAmount) : totalAmount,
          paymentMethod,
          notes: notes || null,
          items: cart.map((item) => ({
            ...item,
            serialNumbers: item.serialNumbers.join('\n'),
            costPrice: parseFloat(String(item.costPrice)) || 0,
            sellPrice: parseFloat(String(item.sellPrice)) || 0,
            quantity: parseInt(String(item.quantity)) || 1,
            warrantyMonths: item.warrantyMonths,
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
        <button
          onClick={() => setSoundOn(!soundOn)}
          className="ml-auto w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center"
          title={soundOn ? 'Sound on' : 'Sound off'}
        >
          {soundOn ? <Volume2 className="w-4 h-4 text-violet-500" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
        </button>
      </div>

      {/* Supplier + Invoice */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
        <div>
          <Label className="text-xs text-gray-600 mb-2 block">Supplier</Label>
          {selectedSupplier ? (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{selectedSupplier.name}</p>
                <p className="text-xs text-gray-500">{selectedSupplier.phone || 'No phone'}</p>
              </div>
              <button onClick={() => { setSelectedSupplier(null); setSupplierId(''); }}
                className="w-8 h-8 rounded-lg hover:bg-amber-100 flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSupplierDialog(true)}
              className="w-full h-10 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:border-violet-300 hover:text-violet-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <Building2 className="w-4 h-4" /> Select Supplier (optional)
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-600">Invoice No. (optional)</Label>
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="e.g. INV-001" className="h-10 rounded-xl" />
        </div>
      </div>

      {/* Supplier Dialog */}
      <QuickPartyDialog
        type="supplier"
        open={showSupplierDialog}
        onClose={() => setShowSupplierDialog(false)}
        existingParties={suppliers}
        onSelect={(s) => {
          setSelectedSupplier(s);
          setSupplierId(s.id);
          if (businessId) {
            fetch(`/api/businesses/${businessId}/cctv/suppliers`).then(r => r.json()).then(data => {
              setSuppliers(Array.isArray(data) ? data : data.suppliers || []);
            }).catch(() => {});
          }
        }}
      />

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

          {cart.map((item, index) => {
            const scannedCount = item.serialNumbers.length;

            return (
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

                {/* Cost Price + Sell Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">Cost Price (৳)</label>
                    <Input type="number" value={item.costPrice}
                      onChange={(e) => updateCartItem(index, { costPrice: parseFloat(e.target.value) || 0 })}
                      className="h-9 rounded-lg text-sm" min="0" step="0.01" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium">Sell Price (৳)</label>
                    <Input type="number" value={item.sellPrice}
                      onChange={(e) => updateCartItem(index, { sellPrice: parseFloat(e.target.value) || 0 })}
                      className="h-9 rounded-lg text-sm" min="0" step="0.01" />
                    {item.costPrice > 0 && item.sellPrice > 0 && (
                      <p className="text-[9px] text-emerald-600">
                        Margin: ৳{((item.sellPrice - item.costPrice) * item.quantity).toLocaleString()} ({Math.round(((item.sellPrice - item.costPrice) / item.costPrice) * 100)}%)
                      </p>
                    )}
                  </div>
                </div>

                {/* Warranty */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium">Warranty (months)</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      value={item.warrantyMonths}
                      onChange={(e) => updateCartItem(index, { warrantyMonths: parseInt(e.target.value) || 0 })}
                      className="w-16 h-9 rounded-lg border border-gray-200 bg-white text-center text-sm font-bold text-gray-900"
                      min="0"
                    />
                    <div className="flex gap-1">
                      {[0, 6, 12, 24].map(w => (
                        <button
                          key={w}
                          onClick={() => updateCartItem(index, { warrantyMonths: w })}
                          className={cn(
                            'px-2.5 h-9 rounded-lg text-xs font-semibold transition-colors',
                            item.warrantyMonths === w
                              ? 'bg-violet-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-violet-50'
                          )}
                        >
                          {w === 0 ? 'None' : `${w}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quantity — serial items: auto from scan count; non-serial: manual */}
                {item.serialTracked ? (
                  <div className="bg-violet-50 rounded-lg p-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-violet-600 font-medium flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" /> Quantity (auto)
                    </span>
                    <span className="text-sm font-bold text-violet-700">
                      {item.quantity} {item.quantity === 1 ? 'item' : 'items'} scanned
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                      <Hash className="w-2.5 h-2.5" /> Quantity
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleQuantityChange(index, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        className="w-16 h-9 rounded-lg border border-gray-200 bg-white text-center text-sm font-bold text-gray-900"
                        min="1"
                      />
                      <button
                        onClick={() => handleQuantityChange(index, item.quantity + 1)}
                        className="w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center active:scale-95 transition-transform"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <div className="flex gap-1 ml-1">
                        {[5, 10, 20].map(q => (
                          <button
                            key={q}
                            onClick={() => handleQuantityChange(index, q)}
                            className={cn(
                              'px-2.5 h-9 rounded-lg text-xs font-semibold transition-colors',
                              item.quantity === q
                                ? 'bg-violet-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-violet-50'
                            )}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SERIAL SCANNING ── */}
                {item.serialTracked && (
                  <div className="space-y-2.5 pt-1">
                    {/* Count header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Scan className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-semibold text-gray-700">Serial Numbers</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums',
                        scannedCount > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-violet-100 text-violet-700'
                      )}>
                        {scannedCount} scanned
                      </span>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScanMode((prev) => ({ ...prev, [index]: true }))}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                          scanMode[index] !== false ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        <Scan className="w-3 h-3" /> Scan
                      </button>
                      <button
                        onClick={() => setScanMode((prev) => ({ ...prev, [index]: false }))}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                          scanMode[index] === false ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        <ClipboardPaste className="w-3 h-3" /> Paste
                      </button>
                    </div>

                    {/* Scan mode input */}
                    {scanMode[index] !== false ? (
                      <div>
                        <div className={cn(
                          'relative rounded-xl border-2 transition-all',
                          scanFeedback[index] === 'ok' ? 'border-emerald-400 bg-emerald-50' :
                          scanFeedback[index] === 'dup' ? 'border-red-400 bg-red-50' :
                          scanFeedback[index] === 'full' ? 'border-amber-400 bg-amber-50' :
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
                            onChange={(e) => setScanInputs((prev) => ({ ...prev, [index]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanEnter(index); } }}
                            placeholder={`Scan serial #${scannedCount + 1}...`}
                            className="w-full h-11 pl-10 pr-10 rounded-xl bg-transparent text-sm font-mono outline-none"
                            autoComplete="off"
                          />
                          {scanFeedback[index] === 'ok' && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                          )}
                          {scanFeedback[index] === 'dup' && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                          )}
                        </div>
                        {/* Status text */}
                        <p className="text-[10px] text-gray-500 mt-1">
                          Scan each item — quantity auto-updates. {scannedCount > 0 && <span className="font-semibold text-violet-600">{scannedCount} scanned so far</span>}
                        </p>
                      </div>
                    ) : (
                      /* Paste mode */
                      <div className="space-y-1">
                        <Textarea
                          value={pasteText[index] || ''}
                          onChange={(e) => setPasteText((prev) => ({ ...prev, [index]: e.target.value }))}
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
                    {scannedCount > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.serialNumbers.map((serial, si) => (
                          <span
                            key={si}
                            className='inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono bg-violet-50 border-violet-100 text-violet-700'
                          >
                            <span className="text-[8px] opacity-50">#{si + 1}</span>
                            {serial}
                            <button
                              onClick={() => removeSerial(index, si)}
                              className="w-3.5 h-3.5 rounded-full hover:bg-violet-200 flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Line total */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200/50">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    ৳{(item.costPrice * item.quantity).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment + Notes */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Amount Paid (৳)</Label>
            <Input type="number" value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder={String(totalAmount)} className="h-10 rounded-xl" min="0" step="0.01" />
            <p className="text-[10px] text-gray-400">
              Leave empty to pay full · Due: ৳{Math.max(0, totalAmount - (parseFloat(paidAmount) || totalAmount)).toLocaleString()}
            </p>
          </div>

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            label="Payment Method"
          />

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes..." className="h-10 rounded-xl" />
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
