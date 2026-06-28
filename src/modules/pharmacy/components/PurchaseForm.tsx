"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Truck, Plus, X, Search,
  AlertCircle, Check, Loader2, Pill, CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  unit: string;
  mrp: number | null;
  category: { name: string; color: string } | null;
}

interface Supplier {
  id: string;
  name: string;
  code: string | null;
}

interface CartItem {
  product: Product;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
  mfgDate: string;
  mrp: string;
}

export function PurchaseForm() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch suppliers
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/businesses/${businessId}/suppliers?limit=50`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setSuppliers(d.suppliers || []); })
      .catch(console.error);
  }, [businessId]);

  // Search products
  useEffect(() => {
    if (!businessId || !search.trim()) { setProducts([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/products?search=${encodeURIComponent(search)}&limit=10`);
        const data = await res.json();
        if (data.success) setProducts(data.products || []);
      } catch (err) { console.error(err); }
    }, 250);
    return () => clearTimeout(t);
  }, [search, businessId]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.some((item) => item.product.id === product.id)) return prev;
      return [...prev, {
        product,
        quantity: "10",
        unitCost: "5",
        batchNo: "",
        expiryDate: "",
        mfgDate: "",
        mrp: product.mrp?.toString() || "",
      }];
    });
    setSearch("");
    setShowSearch(false);
    setProducts([]);
  };

  const updateItem = (productId: string, field: keyof CartItem, value: string) => {
    setCart((prev) => prev.map((item) =>
      item.product.id === productId ? { ...item, [field]: value } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
  }, 0);
  const total = Math.max(0, subtotal - (parseFloat(discountAmount) || 0)) + (parseFloat(taxAmount) || 0);

  const handleSave = async () => {
    if (!businessId || cart.length === 0) {
      setError("Add at least one item");
      return;
    }
    // Validate each item
    for (const item of cart) {
      if (!item.expiryDate) {
        setError(`Expiry date required for ${item.product.name}`);
        return;
      }
      if (!item.batchNo.trim()) {
        setError(`Batch number required for ${item.product.name}`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/businesses/${businessId}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId || null,
          invoiceNo: invoiceNo || null,
          invoiceDate: invoiceDate || null,
          items: cart.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: parseFloat(item.quantity),
            unitCost: parseFloat(item.unitCost),
            unit: item.product.unit,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            mfgDate: item.mfgDate || null,
            mrp: item.mrp ? parseFloat(item.mrp) : null,
          })),
          discountAmount: parseFloat(discountAmount) || 0,
          taxAmount: parseFloat(taxAmount) || 0,
          paidAmount: parseFloat(paidAmount) || 0,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setSuccess(true);
      setTimeout(() => setActiveView("purchases"), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2 stagger-in">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("purchases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">New Purchase</h1>
        </div>
        <Card className="stagger-in shadow-pharmacy-lg border-0 overflow-hidden">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-scale-in">
              <Check className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Purchase Recorded!</h2>
              <p className="text-sm text-muted-foreground">
                Stock received and batches created successfully.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("purchases")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">New Purchase</h1>
      </div>

      {error && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden border-l-4 border-l-rose-500">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-rose-700 bg-rose-50">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {/* Supplier Section */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
              <Truck className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold">Supplier</h2>
          </div>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger className="h-10 rounded-xl shadow-pharmacy border-blue-200 focus-visible:ring-blue-500">
              <SelectValue placeholder="Select supplier (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Walk-in / No supplier</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Supplier Invoice No</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-10 rounded-xl" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-10 rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Section */}
      <div className="stagger-in flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
          <Pill className="h-3.5 w-3.5 text-white" />
        </div>
        <h2 className="text-sm font-semibold">Items {cart.length > 0 && <span className="text-muted-foreground font-normal">({cart.length})</span>}</h2>
      </div>

      {/* Add Product */}
      {showSearch ? (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              <Input
                ref={searchInputRef}
                placeholder="Search product to add..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 h-11 rounded-2xl border-emerald-200 bg-white shadow-pharmacy focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg"
                onClick={() => { setShowSearch(false); setSearch(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {search.trim() && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No products found</p>
                ) : (
                  products.map((product) => {
                    const inCart = cart.some((item) => item.product.id === product.id);
                    return (
                      <button
                        key={product.id}
                        className="w-full text-left p-2 rounded-xl flex items-center gap-2 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                        onClick={() => !inCart && addToCart(product)}
                        disabled={inCart}
                      >
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600"
                          style={product.category?.color ? { background: `linear-gradient(135deg, ${product.category.color}, ${product.category.color}dd)` } : undefined}>
                          <Pill className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {product.genericName || "—"} · {product.unit}
                          </p>
                        </div>
                        {inCart && <Badge variant="secondary" className="text-[9px]">Added</Badge>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full h-12 gap-2 border-dashed rounded-2xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" onClick={() => setShowSearch(true)}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      )}

      {/* Cart Items */}
      {cart.map((item, idx) => (
        <Card key={item.product.id} className={`card-hover shadow-pharmacy border-0 overflow-hidden ${idx === 0 ? "stagger-in" : ""}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-emerald-400 to-emerald-600"
                style={item.product.category?.color ? { background: `linear-gradient(135deg, ${item.product.category.color}, ${item.product.category.color}dd)` } : undefined}>
                <Pill className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.product.name}</p>
                <p className="text-[10px] text-muted-foreground">{item.product.unit}</p>
              </div>
              <button className="p-1 rounded-lg hover:bg-rose-50" onClick={() => removeFromCart(item.product.id)}>
                <X className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Quantity *</label>
                <Input type="number" step="0.01" value={item.quantity} onChange={(e) => updateItem(item.product.id, "quantity", e.target.value)} className="h-9 text-sm rounded-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Unit Cost (৳) *</label>
                <Input type="number" step="0.01" value={item.unitCost} onChange={(e) => updateItem(item.product.id, "unitCost", e.target.value)} className="h-9 text-sm rounded-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Batch No *</label>
                <Input value={item.batchNo} onChange={(e) => updateItem(item.product.id, "batchNo", e.target.value)} className="h-9 text-sm rounded-lg font-mono" placeholder="SQ240101" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Expiry *</label>
                <Input type="date" value={item.expiryDate} onChange={(e) => updateItem(item.product.id, "expiryDate", e.target.value)} className="h-9 text-sm rounded-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mfg Date</label>
                <Input type="date" value={item.mfgDate} onChange={(e) => updateItem(item.product.id, "mfgDate", e.target.value)} className="h-9 text-sm rounded-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">MRP (৳)</label>
                <Input type="number" step="0.01" value={item.mrp} onChange={(e) => updateItem(item.product.id, "mrp", e.target.value)} className="h-9 text-sm rounded-lg" />
              </div>
            </div>
            <div className="text-right text-xs font-medium pt-1 border-t border-dashed">
              Line Total: <span className="text-emerald-600 font-bold">৳{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0)).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Payment Section */}
      {cart.length > 0 && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-white" />
              </div>
              <h2 className="text-sm font-semibold">Payment Summary</h2>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">৳{subtotal.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Discount (৳)</label>
                  <Input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="h-9 text-sm rounded-lg" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Tax/VAT (৳)</label>
                  <Input type="number" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} className="h-9 text-sm rounded-lg" />
                </div>
              </div>
              <div className="flex items-center justify-between font-bold text-base pt-2 border-t border-dashed">
                <span>Total</span>
                <span className="text-emerald-600 text-lg">৳{total.toFixed(2)}</span>
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[10px] text-muted-foreground">Paid Amount (৳)</label>
                <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-9 text-sm rounded-lg" placeholder="0 (unpaid)" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {cart.length > 0 && (
        <div className="stagger-in space-y-1.5">
          <Label className="text-xs font-medium">Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[50px] text-sm rounded-xl" placeholder="Optional notes" />
        </div>
      )}

      {/* Save */}
      <Button
        size="lg"
        className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/30 rounded-2xl"
        onClick={handleSave}
        disabled={saving || cart.length === 0}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Record Purchase & Receive Stock"}
      </Button>
    </motion.div>
  );
}
