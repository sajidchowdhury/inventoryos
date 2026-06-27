"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, Plus, X, Check, AlertCircle, Loader2,
  ShoppingCart, Pill, Calendar, TrendingDown, Receipt,
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
  const setActiveView = useNavStore((s) => s.setActiveView);
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
      const res = await fetch(`/api/businesses/${businessId}/dispense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: parseFloat(item.quantity),
          })),
          note: "Quick dispense",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setDispenseResult({
          success: data.summary.success,
          failures: data.summary.failures,
          totalValue: data.summary.totalValue,
        });
        setCart([]);
        setPreview(null);
      } else {
        setError(data.error || "Some items failed to dispense");
        if (data.results) {
          setPreview(data.results.map((r: AllocationResult) => ({
            ...r,
            success: r.success,
            product: r.product || { id: r.productId, name: r.productName, unit: r.unit },
            allocations: r.allocations || [],
            requestedQuantity: r.requested,
            allocatedQuantity: r.allocated,
            shortFall: r.shortFall,
          })));
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
  };

  const totalItems = cart.length;
  const totalQty = cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalValue = cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (item.product.mrp || 0), 0);

  // Success screen
  if (dispenseResult) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6 text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold">Dispensed Successfully!</h2>
            <p className="text-sm text-muted-foreground">
              {dispenseResult.success} item(s) dispensed via FEFO
            </p>
            <div className="flex items-center justify-center gap-1 pt-1">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-bold">৳{dispenseResult.totalValue.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
        <Button className="w-full h-11 gap-2" onClick={handleReset}>
          <Plus className="h-4 w-4" /> New Dispense
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Quick Dispense</h1>
        {cart.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleReset}>
            Clear
          </Button>
        )}
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 flex items-center gap-2 text-xs text-blue-700">
          <TrendingDown className="h-4 w-4 shrink-0" />
          <span>Stock is automatically dispensed from batches expiring <strong>soonest first</strong> (FEFO)</span>
        </CardContent>
      </Card>

      {/* Add Product Search */}
      {showSearch ? (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search product by name, generic, manufacturer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 h-10"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => { setShowSearch(false); setSearch(""); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Results */}
            {search.trim() && (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No products found</p>
                ) : (
                  products.map((product) => {
                    const inCart = cart.some((item) => item.product.id === product.id);
                    const stock = product.inventory?.quantity ?? 0;
                    return (
                      <button
                        key={product.id}
                        className={cn(
                          "w-full text-left p-2 rounded-lg flex items-center gap-2 transition-colors",
                          inCart ? "opacity-50 bg-muted/50" : "hover:bg-muted",
                          stock <= 0 && "opacity-40"
                        )}
                        onClick={() => !inCart && stock > 0 && addToCart(product)}
                        disabled={inCart || stock <= 0}
                      >
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
                        >
                          <Pill className="h-4 w-4" style={{ color: product.category?.color || "#6b7280" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {product.genericName || product.manufacturer || "—"}
                            {product.strength && ` · ${product.strength}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {inCart ? (
                            <Badge variant="secondary" className="text-[9px]">Added</Badge>
                          ) : stock <= 0 ? (
                            <Badge variant="outline" className="text-[9px] text-red-600">Out</Badge>
                          ) : (
                            <>
                              <p className="text-xs font-semibold">{stock}</p>
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
          className="w-full h-12 gap-2 border-dashed"
          onClick={() => setShowSearch(true)}
        >
          <Plus className="h-4 w-4" /> Add Product to Dispense
        </Button>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <>
          <div>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center justify-between">
              <span>Cart ({totalItems})</span>
              <span className="text-xs">{totalQty} units · ৳{totalValue.toFixed(2)}</span>
            </h2>
            <div className="space-y-2">
              {cart.map((item) => {
                const stock = item.product.inventory?.quantity ?? 0;
                const qty = parseFloat(item.quantity) || 0;
                const exceeds = qty > stock;
                return (
                  <Card key={item.product.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div
                          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: item.product.category?.color ? `${item.product.category.color}20` : "#f3f4f6" }}
                        >
                          <Pill className="h-4 w-4" style={{ color: item.product.category?.color || "#6b7280" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.product.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {item.product.genericName || item.product.manufacturer}
                            {item.product.strength && ` · ${item.product.strength}`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Stock: {stock} {item.product.unit}
                            {item.product.mrp && <> · MRP: ৳{item.product.mrp}</>}
                          </p>
                        </div>
                        <button
                          className="p-1 rounded hover:bg-muted"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.product.id, e.target.value)}
                          className="h-9"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">{item.product.unit}</span>
                        {exceeds && (
                          <Badge variant="outline" className="text-[9px] text-red-600 shrink-0">Exceeds stock</Badge>
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
            className="w-full h-11 gap-2"
            onClick={handlePreview}
            disabled={previewing || cart.length === 0}
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {previewing ? "Checking FEFO..." : "Preview FEFO Allocation"}
          </Button>

          {/* Preview Results */}
          {preview && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Allocation Plan</h3>
              {preview.map((result, idx) => (
                <Card key={idx} className={cn(
                  "border-l-4",
                  result.success ? "border-l-green-500" : "border-l-red-500"
                )}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate flex-1">{result.product.name}</p>
                      {result.success ? (
                        <Badge variant="outline" className="text-[9px] text-green-600">OK</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-red-600">Short</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Requested: <span className="font-medium text-foreground">{result.requestedQuantity} {result.product.unit}</span>
                      {result.shortFall > 0 && (
                        <> · Short by: <span className="font-medium text-red-600">{result.shortFall} {result.product.unit}</span></>
                      )}
                    </p>
                    {result.success && result.allocations.filter(a => a.allocated > 0).length > 0 && (
                      <div className="space-y-1 pt-1 border-t">
                        {result.allocations.filter(a => a.allocated > 0).map((alloc, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              Batch #{alloc.batchNo}
                              <span className="text-foreground">
                                {new Date(alloc.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                              </span>
                            </span>
                            <span className="font-medium">−{alloc.allocated} {result.product.unit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!result.success && result.error && (
                      <p className="text-[10px] text-red-600">{result.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </CardContent>
            </Card>
          )}

          {/* Dispense Button */}
          <Button
            size="lg"
            className="w-full h-12 gap-2"
            onClick={handleDispense}
            disabled={dispensing || cart.length === 0}
          >
            {dispensing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
            {dispensing ? "Dispensing..." : `Dispense ${totalItems} Item${totalItems !== 1 ? "s" : ""}`}
          </Button>
        </>
      )}

      {/* Empty State */}
      {cart.length === 0 && !showSearch && (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No items in cart</p>
            <p className="text-sm text-muted-foreground">
              Tap &ldquo;Add Product&rdquo; above to start a dispense
            </p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
