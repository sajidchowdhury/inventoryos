"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, Plus, X, Check, AlertCircle, Loader2,
  ShoppingCart, Pill, Calendar, TrendingDown, Receipt, Percent,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  manufacturer: string | null;
  unit: string;
  mrp: number | null;
  category: { id: string; name: string; color: string } | null;
  inventory: { quantity: number } | null;
}

interface CartItem {
  product: Product;
  quantity: string;
}

interface Allocation {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  allocated: number;
}

interface AllocationResult {
  success: boolean;
  product: { id: string; name: string; unit: string };
  allocations: Allocation[];
  requestedQuantity: number;
  allocatedQuantity: number;
  shortFall: number;
  message?: string;
  error?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export function QuickDispense() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveSaleId, saleCustomerId, setSaleCustomerId } = useNavStore();
  const businessId = session?.business?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [preview, setPreview] = useState<AllocationResult[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [dispenseResult, setDispenseResult] = useState<{ success: number; failures: number; totalValue: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInvoiceNo, setLastInvoiceNo] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search products with debounce
  useEffect(() => {
    if (!businessId || !search.trim()) {
      setProducts([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/products?search=${encodeURIComponent(search)}&limit=10`);
        const data = await res.json();
        if (data.success) setProducts(data.products || []);
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, businessId]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.some((item) => item.product.id === product.id)) return prev;
      return [...prev, { product, quantity: "1" }];
    });
    setSearch("");
    setShowSearch(false);
    setProducts([]);
    setError(null);
  };

  const updateQty = (productId: string, qty: string) => {
    setCart((prev) => prev.map((item) =>
      item.product.id === productId ? { ...item, quantity: qty } : item
    ));
    setPreview(null);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!businessId || cart.length === 0) return;
    setPreviewing(true);
    setError(null);
    setPreview(null);

    try {
      const results: AllocationResult[] = [];
      for (const item of cart) {
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) continue;

        const res = await fetch(`/api/businesses/${businessId}/products/${item.product.id}/allocate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: qty, execute: false }),
        });
        const data = await res.json();
        results.push({
          success: data.success,
          product: data.product,
          allocations: data.allocations || [],
          requestedQuantity: data.requestedQuantity,
          allocatedQuantity: data.allocatedQuantity ?? 0,
          shortFall: data.shortFall ?? 0,
          message: data.message,
          error: data.error,
        });
      }
      setPreview(results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleDispense = async () => {
    if (!businessId || cart.length === 0) return;
    setDispensing(true);
    setError(null);

    try {
      // Create a Sale (invoice) instead of just dispensing
      const res = await fetch(`/api/businesses/${businessId}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: saleCustomerId || null,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: parseFloat(item.quantity),
            unitPrice: item.product.mrp,
          })),
          discountPercent: discPercent,
          discountAmount: discAmount,
          paymentMethod: "cash",
          paymentStatus: "paid",
          paidAmount: totalValue,
          notes: "Quick dispense (POS)",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setDispenseResult({
          success: 1,
          failures: 0,
          totalValue: data.sale?.totalAmount || totalValue,
        });
        setLastInvoiceNo(data.sale?.invoiceNo);
        setLastSaleId(data.sale?.id);
        setCart([]);
        setPreview(null);
        setSaleCustomerId(null);
      } else {
        setError(data.error || "Failed to create sale");
        // If we have error details about a specific item, show in preview
        if (data.productId) {
          setPreview((prev) => prev ? prev.map((p) =>
            p.product.id === data.productId
              ? { ...p, success: false, error: data.error }
              : p
          ) : prev);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to dispense");
    } finally {
      setDispensing(false);
    }
  };

  const handleReset = () => {
    setCart([]);
    setPreview(null);
    setDispenseResult(null);
    setError(null);
    setLastInvoiceNo(null);
    setLastSaleId(null);
    setDiscountPercent("0");
    setDiscountAmount("0");
  };

  const totalItems = cart.length;
  const totalQty = cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (item.product.mrp || 0), 0);
  const discPercent = parseFloat(discountPercent) || 0;
  const discAmount = parseFloat(discountAmount) || 0;
  const afterPercent = subtotal * (1 - discPercent / 100);
  const totalValue = Math.max(0, afterPercent - discAmount);

  // Success screen
  if (dispenseResult) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
        <Card className="stagger-in overflow-hidden border-0 shadow-pharmacy-lg">
          {/* Gradient hero header */}
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-600 px-6 py-10 text-center text-white">
            <div className="animate-pulse-soft h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto ring-8 ring-white/10">
              <Check className="h-10 w-10 text-white" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-bold mt-4">Sale Completed!</h2>
            <p className="text-emerald-50 text-sm mt-1">
              {dispenseResult.success} invoice created via FEFO
            </p>
            {lastInvoiceNo && (
              <p className="inline-block mt-3 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-xs font-mono font-semibold tracking-wide">
                {lastInvoiceNo}
              </p>
            )}
          </div>
          {/* Total amount card */}
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Amount</p>
              <div className="flex items-center justify-center gap-1">
                <Receipt className="h-6 w-6 text-emerald-600" />
                <span className="text-4xl font-bold text-emerald-600">৳{dispenseResult.totalValue.toFixed(2)}</span>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Items Sold</p>
                <p className="text-lg font-bold text-emerald-700">{dispenseResult.success}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Failures</p>
                <p className="text-lg font-bold text-emerald-700">{dispenseResult.failures}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="stagger-in grid grid-cols-2 gap-3">
          {lastSaleId && (
            <Button
              variant="outline"
              className="h-12 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-pharmacy"
              onClick={() => {
                setActiveSaleId(lastSaleId);
                setActiveView("sale-detail");
              }}
            >
              <Receipt className="h-4 w-4" /> View Invoice
            </Button>
          )}
          <Button
            className="h-12 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl"
            onClick={handleReset}
          >
            <Plus className="h-4 w-4" /> New Sale
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">New Sale</h1>
        {cart.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleReset} className="text-muted-foreground">
            Clear
          </Button>
        )}
      </div>

      {/* Info Banner — Emerald gradient */}
      <Card className="stagger-in overflow-hidden border-0 shadow-pharmacy">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 flex items-center gap-2.5 text-xs text-white">
            <div className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <TrendingDown className="h-4 w-4" />
            </div>
            <span>Stock is automatically dispensed from batches expiring <strong className="font-semibold">soonest first</strong> (FEFO)</span>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Search */}
      {showSearch ? (
        <Card className="stagger-in shadow-pharmacy border-0">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              <Input
                ref={searchInputRef}
                placeholder="Search product by name, generic, manufacturer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 h-11 rounded-2xl border-emerald-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 bg-emerald-50/30"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg"
                onClick={() => { setShowSearch(false); setSearch(""); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Results */}
            {search.trim() && (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No products found</p>
                ) : (
                  products.map((product) => {
                    const inCart = cart.some((item) => item.product.id === product.id);
                    const stock = product.inventory?.quantity ?? 0;
                    const catColor = product.category?.color || "#10b981";
                    return (
                      <button
                        key={product.id}
                        className={cn(
                          "card-hover w-full text-left p-2.5 rounded-xl flex items-center gap-3 bg-white border border-emerald-100",
                          inCart ? "opacity-60 bg-muted/40" : "hover:border-emerald-300",
                          stock <= 0 && "opacity-50"
                        )}
                        onClick={() => !inCart && stock > 0 && addToCart(product)}
                        disabled={inCart || stock <= 0}
                      >
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}dd)` }}
                        >
                          <Pill className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {product.genericName || product.manufacturer || "—"}
                            {product.strength && ` · ${product.strength}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {inCart ? (
                            <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Added</Badge>
                          ) : stock <= 0 ? (
                            <Badge variant="outline" className="text-[9px] text-rose-600 border-rose-300">Out</Badge>
                          ) : (
                            <>
                              <p className="text-xs font-bold text-emerald-700">{stock}</p>
                              <p className="text-[9px] text-muted-foreground">{product.unit}</p>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="stagger-in w-full h-14 gap-2 border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 rounded-2xl shadow-pharmacy"
          onClick={() => setShowSearch(true)}
        >
          <Plus className="h-5 w-5" /> Add Product to Dispense
        </Button>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <>
          <div className="stagger-in">
            <h2 className="text-sm font-semibold mb-2.5 text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Cart ({totalItems})
              </span>
              <span className="text-xs">{totalQty} units · ৳{totalValue.toFixed(2)}</span>
            </h2>
            <div className="space-y-2.5">
              {cart.map((item) => {
                const stock = item.product.inventory?.quantity ?? 0;
                const qty = parseFloat(item.quantity) || 0;
                const exceeds = qty > stock;
                const catColor = item.product.category?.color || "#10b981";
                return (
                  <Card key={item.product.id} className="card-hover shadow-pharmacy border-0 overflow-hidden">
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${catColor}, ${catColor}dd)` }}
                        >
                          <Pill className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.product.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {item.product.genericName || item.product.manufacturer}
                            {item.product.strength && ` · ${item.product.strength}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className={cn(
                              "text-[9px] px-1.5 py-0",
                              stock <= 0
                                ? "text-rose-600 border-rose-300 bg-rose-50"
                                : stock <= 10
                                  ? "text-amber-600 border-amber-300 bg-amber-50"
                                  : "text-emerald-600 border-emerald-300 bg-emerald-50"
                            )}>
                              Stock: {stock} {item.product.unit}
                            </Badge>
                            {item.product.mrp && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-emerald-700 border-emerald-200">
                                MRP ৳{item.product.mrp}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.product.id, e.target.value)}
                          className="h-9 rounded-xl border-emerald-200 focus-visible:ring-emerald-500"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">{item.product.unit}</span>
                        {exceeds && (
                          <Badge variant="outline" className="text-[9px] text-rose-600 border-rose-300 bg-rose-50 shrink-0">Exceeds stock</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Preview Button */}
          <Button
            variant="outline"
            className="stagger-in w-full h-12 gap-2 border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white rounded-2xl shadow-pharmacy transition-colors"
            onClick={handlePreview}
            disabled={previewing || cart.length === 0}
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {previewing ? "Checking FEFO..." : "Preview FEFO Allocation"}
          </Button>

          {/* Preview Results */}
          {preview && (
            <div className="stagger-in space-y-2.5">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Allocation Plan
              </h3>
              {preview.map((result, idx) => (
                <Card
                  key={idx}
                  className={cn(
                    "card-hover shadow-pharmacy border-0 overflow-hidden border-l-4",
                    result.success ? "border-l-emerald-500" : "border-l-rose-500"
                  )}
                >
                  <CardContent className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate flex-1">{result.product.name}</p>
                      {result.success ? (
                        <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0">OK</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-rose-600 border-rose-300 bg-rose-50 shrink-0">Short</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Requested: <span className="font-medium text-foreground">{result.requestedQuantity} {result.product.unit}</span>
                      {result.shortFall > 0 && (
                        <> · Short by: <span className="font-medium text-rose-600">{result.shortFall} {result.product.unit}</span></>
                      )}
                    </p>
                    {result.success && result.allocations.filter(a => a.allocated > 0).length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-dashed">
                        {result.allocations.filter(a => a.allocated > 0).map((alloc, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] bg-emerald-50/50 rounded-lg px-2 py-1.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3 w-3 text-emerald-600" />
                              Batch #{alloc.batchNo}
                              <span className="text-foreground font-medium">
                                {new Date(alloc.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                              </span>
                            </span>
                            <span className="font-semibold text-emerald-700">−{alloc.allocated} {result.product.unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!result.success && result.error && (
                      <p className="text-[10px] text-rose-600 bg-rose-50 rounded-lg px-2 py-1.5">{result.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {error && (
            <Card className="border-destructive/30 bg-rose-50">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </CardContent>
            </Card>
          )}

          {/* Discount Section */}
          <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <Percent className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-emerald-700">Discount</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Percent (%)</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="h-9 text-sm rounded-xl border-emerald-200 focus-visible:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Flat (৳)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="h-9 text-sm rounded-xl border-emerald-200 focus-visible:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>
              {subtotal > 0 && (discPercent > 0 || discAmount > 0) && (
                <div className="space-y-1.5 pt-2 border-t border-dashed text-xs bg-emerald-50/40 -mx-4 -mb-4 px-4 pb-4 pt-3 rounded-b-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">৳{subtotal.toFixed(2)}</span>
                  </div>
                  {discPercent > 0 && (
                    <div className="flex items-center justify-between text-amber-600">
                      <span>−{discPercent}%</span>
                      <span className="font-medium">−৳{(subtotal * discPercent / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {discAmount > 0 && (
                    <div className="flex items-center justify-between text-amber-600">
                      <span>Flat discount</span>
                      <span className="font-medium">−৳{discAmount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-bold pt-2 border-t border-emerald-200">
                    <span>Total</span>
                    <span className="text-emerald-600 text-base">৳{totalValue.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dispense Button */}
          <Button
            size="lg"
            className="stagger-in w-full h-14 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-2xl text-base font-semibold"
            onClick={handleDispense}
            disabled={dispensing || cart.length === 0}
          >
            {dispensing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
            {dispensing ? "Dispensing..." : `Dispense ${totalItems} Item${totalItems !== 1 ? "s" : ""}`}
          </Button>
        </>
      )}

      {/* Empty State */}
      {cart.length === 0 && !showSearch && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-10 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <ShoppingCart className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">No items in cart</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Tap <span className="font-medium text-emerald-600">&ldquo;Add Product&rdquo;</span> above to start a dispense
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
