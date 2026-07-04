"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Save, Truck, Plus, X, Search,
  AlertCircle, Check, Loader2, Pill, CreditCard, ScanLine, Link2,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { PurchaseScannerDialog } from "./purchase/PurchaseScannerDialog";
import { LinkProductDialog } from "./purchase/LinkProductDialog";
import type { ScannedItem } from "./purchase/ScannedItemList";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface Product {
  // P3: id is "" for unmatched scanned items (not yet linked to a real product)
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
  // P3: cartItemId is a stable unique key for the cart item.
  // For matched items it's "cart:" + productId. For unmatched items it's "scan:" + a generated id.
  // This allows unmatched items (no productId yet) to coexist in the cart until linked.
  cartItemId: string;
  product: Product;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
  mfgDate: string;
  mrp: string;
  // P3: scan metadata (undefined for manually-added items)
  scanMeta?: {
    matchedMethod: "ai" | "master-catalog" | "unmatched";
    confidenceLevel: "high" | "medium" | "low";
    detectedProductName: string;
  };
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
  const [scannerOpen, setScannerOpen] = useState(false);
  // P3: link dialog state — which cart item is being linked to a product
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; cartItemId: string; detectedName: string }>({
    open: false, cartItemId: "", detectedName: "",
  });
  // P3: remove confirmation dialog
  const [removeConfirm, setRemoveConfirm] = useState<CartItem | null>(null);
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
      if (prev.some((item) => item.product.id === product.id && product.id)) return prev;
      return [...prev, {
        cartItemId: `cart:${product.id}`,
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

  // P2/P3: Add scanned items from the PurchaseScannerDialog into the cart.
  // Matched items (productId set) are added with detected fields pre-filled + scan metadata.
  // Unmatched items (no productId) are ALSO added — with product.id="" + a "Link to product"
  // button shown in the cart. User links them via LinkProductDialog before saving.
  // Duplicate matched items merge quantities; unmatched items always append.
  const addScannedItemsToCart = (scannedItems: ScannedItem[]) => {
    setCart((prev) => {
      const updated = [...prev];
      let unmatchedCounter = Date.now();

      for (const scanned of scannedItems) {
        const scanMeta = {
          matchedMethod: scanned.matchedMethod,
          confidenceLevel: scanned.confidenceLevel,
          detectedProductName: scanned.detectedProductName,
        };

        // Matched item — check if already in cart by productId
        if (scanned.productId) {
          const existingIdx = updated.findIndex(
            (item) => item.product.id === scanned.productId && item.product.id
          );
          if (existingIdx >= 0) {
            const existing = updated[existingIdx];
            const existingQty = parseFloat(existing.quantity) || 0;
            const scannedQty = scanned.detectedQuantity ?? 0;
            updated[existingIdx] = {
              ...existing,
              quantity: String(existingQty + scannedQty),
              batchNo: existing.batchNo || scanned.detectedBatchNo || "",
              expiryDate: existing.expiryDate || scanned.detectedExpiryDate || "",
              mfgDate: existing.mfgDate || scanned.detectedMfgDate || "",
              mrp: existing.mrp || (scanned.detectedMrp?.toString() ?? ""),
              unitCost: existing.unitCost || (scanned.detectedUnitCost?.toString() ?? "0"),
              // Keep the higher confidence level
              scanMeta: existing.scanMeta && existing.scanMeta.confidenceLevel === "high"
                ? existing.scanMeta
                : scanMeta,
            };
            continue;
          }

          // New matched item
          const minimalProduct: Product = {
            id: scanned.productId,
            name: scanned.matchedName || scanned.detectedProductName,
            genericName: scanned.detectedGenericName,
            strength: null,
            unit: scanned.detectedUnit || "box",
            mrp: scanned.detectedMrp,
            category: null,
          };

          updated.push({
            cartItemId: `cart:${scanned.productId}`,
            product: minimalProduct,
            quantity: String(scanned.detectedQuantity ?? 0),
            unitCost: String(scanned.detectedUnitCost ?? 0),
            batchNo: scanned.detectedBatchNo || "",
            expiryDate: scanned.detectedExpiryDate || "",
            mfgDate: scanned.detectedMfgDate || "",
            mrp: scanned.detectedMrp?.toString() ?? "",
            scanMeta,
          });
        } else {
          // Unmatched item — add with empty productId + "Link to product" button
          const unmatchedProduct: Product = {
            id: "",
            name: scanned.detectedProductName,
            genericName: scanned.detectedGenericName,
            strength: null,
            unit: scanned.detectedUnit || "box",
            mrp: scanned.detectedMrp,
            category: null,
          };

          updated.push({
            cartItemId: `scan:unmatched-${unmatchedCounter++}`,
            product: unmatchedProduct,
            quantity: String(scanned.detectedQuantity ?? 0),
            unitCost: String(scanned.detectedUnitCost ?? 0),
            batchNo: scanned.detectedBatchNo || "",
            expiryDate: scanned.detectedExpiryDate || "",
            mfgDate: scanned.detectedMfgDate || "",
            mrp: scanned.detectedMrp?.toString() ?? "",
            scanMeta,
          });
        }
      }

      return updated;
    });
  };

  // P3: Link an unmatched cart item to an existing product (or newly created one)
  const linkCartItemToProduct = (cartItemId: string, product: Product) => {
    setCart((prev) => prev.map((item) => {
      if (item.cartItemId !== cartItemId) return item;
      return {
        ...item,
        cartItemId: `cart:${product.id}`,  // upgrade to matched key
        product,
        // Keep detected scan fields but update the product reference
        mrp: item.mrp || (product.mrp?.toString() ?? ""),
        scanMeta: item.scanMeta
          ? { ...item.scanMeta, matchedMethod: "ai", confidenceLevel: "high" }
          : undefined,
      };
    }));
  };

  // P3: Create a new minimal product + link it to a cart item
  const createNewProductForCartItem = async (cartItemId: string, data: { name: string; genericName?: string; unit?: string }): Promise<Product> => {
    if (!businessId) throw new Error("No business");
    const res = await fetch(`/api/businesses/${businessId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        genericName: data.genericName || null,
        unit: data.unit || "box",
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to create product");
    const newProduct: Product = {
      id: json.product?.id ?? json.id,
      name: json.product?.name ?? data.name,
      genericName: json.product?.genericName ?? data.genericName ?? null,
      strength: null,
      unit: json.product?.unit ?? data.unit ?? "box",
      mrp: json.product?.mrp ?? null,
      category: null,
    };
    linkCartItemToProduct(cartItemId, newProduct);
    return newProduct;
  };

  // P3: updated to use cartItemId (stable for both matched + unmatched items)
  const updateItem = (cartItemId: string, field: keyof CartItem, value: string) => {
    setCart((prev) => prev.map((item) =>
      item.cartItemId === cartItemId ? { ...item, [field]: value } : item
    ));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
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
    // P3: Block save if any unmatched items haven't been linked
    const unlinked = cart.filter((item) => !item.product.id);
    if (unlinked.length > 0) {
      setError(
        unlinked.length === 1
          ? `Link "${unlinked[0].product.name}" to a product before saving`
          : `${unlinked.length} items need to be linked to a product before saving. Tap "Link" on each.`
      );
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
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12 gap-2 border-dashed rounded-2xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" onClick={() => setShowSearch(true)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
          {/* P2: Scan purchase sheet button — opens the PurchaseScannerDialog */}
          <Button
            variant="outline"
            className="h-12 gap-2 rounded-2xl border-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="h-4 w-4" /> Scan Sheet
          </Button>
        </div>
      )}

      {/* P2: Purchase Scanner Dialog */}
      {businessId && (
        <PurchaseScannerDialog
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          businessId={businessId}
          onAddToCart={addScannedItemsToCart}
        />
      )}

      {/* P3: Link Product Dialog — for unmatched scanned items */}
      {businessId && (
        <LinkProductDialog
          open={linkDialog.open}
          onOpenChange={(open) => setLinkDialog((prev) => ({ ...prev, open }))}
          businessId={businessId}
          detectedName={linkDialog.detectedName}
          onLink={(productId, productOption) => {
            const product: Product = {
              id: productOption.id,
              name: productOption.name,
              genericName: productOption.genericName,
              strength: null,
              unit: productOption.unit,
              mrp: productOption.mrp,
              category: null,
            };
            linkCartItemToProduct(linkDialog.cartItemId, product);
          }}
          onCreateNew={async (data) => {
            const newProduct = await createNewProductForCartItem(linkDialog.cartItemId, data);
            return {
              id: newProduct.id,
              name: newProduct.name,
              genericName: newProduct.genericName,
              unit: newProduct.unit,
              mrp: newProduct.mrp,
            };
          }}
        />
      )}

      {/* P3: Remove confirmation dialog */}
      <Dialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              Remove item?
            </DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium text-gray-700">{removeConfirm?.product.name}</span> from the purchase? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setRemoveConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5 bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (removeConfirm) removeFromCart(removeConfirm.cartItemId);
                setRemoveConfirm(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cart Items — P3: confidence dot + link button + amber borders + remove confirmation */}
      {cart.map((item, idx) => {
        const isUnmatched = !item.product.id;
        const confidence = item.scanMeta?.confidenceLevel;
        const isLowConfidence = confidence === "low";
        const isMediumConfidence = confidence === "medium";
        return (
        <Card
          key={item.cartItemId}
          className={cn(
            "card-hover shadow-pharmacy border-0 overflow-hidden",
            idx === 0 && "stagger-in",
            isUnmatched && "ring-2 ring-amber-300",
            isLowConfidence && !isUnmatched && "ring-1 ring-rose-200"
          )}
        >
          <CardContent className="p-3 space-y-2">
            {/* Row 1: product icon + name + confidence dot + remove */}
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                  isUnmatched
                    ? "bg-gradient-to-br from-amber-400 to-orange-500"
                    : "bg-gradient-to-br from-emerald-400 to-emerald-600"
                )}
                style={!isUnmatched && item.product.category?.color ? { background: `linear-gradient(135deg, ${item.product.category.color}, ${item.product.category.color}dd)` } : undefined}
              >
                {isUnmatched ? <Link2 className="h-4 w-4 text-white" /> : <Pill className="h-4 w-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate">{item.product.name}</p>
                  {/* P3: confidence dot */}
                  {confidence === "high" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="High confidence" />}
                  {isMediumConfidence && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Medium confidence — please verify" />}
                  {isLowConfidence && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" title="Low confidence — please verify" />}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-muted-foreground">{item.product.unit}</p>
                  {isUnmatched && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 border-0">
                      Not linked
                    </Badge>
                  )}
                  {item.scanMeta?.matchedMethod === "master-catalog" && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-blue-100 text-blue-700 border-0">
                      Catalog
                    </Badge>
                  )}
                </div>
              </div>
              {/* P3: remove with confirmation */}
              <button
                className="p-1 rounded-lg hover:bg-rose-50"
                onClick={() => setRemoveConfirm(item)}
                aria-label="Remove item"
              >
                <X className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </div>

            {/* P3: "Link to product" button for unmatched items */}
            {isUnmatched && (
              <Button
                size="sm"
                className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 h-8 text-xs"
                onClick={() =>
                  setLinkDialog({
                    open: true,
                    cartItemId: item.cartItemId,
                    detectedName: item.product.name,
                  })
                }
              >
                <Link2 className="h-3 w-3" />
                Link to product
              </Button>
            )}

            {/* P3: detected-name hint for matched items where detected ≠ matched */}
            {item.scanMeta && item.scanMeta.detectedProductName !== item.product.name && !isUnmatched && (
              <p className="text-[10px] text-gray-400 italic">
                Detected as: {item.scanMeta.detectedProductName}
              </p>
            )}

            {/* Fields — P3: amber border on low-confidence items */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Quantity *</label>
                <Input
                  type="number" step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.cartItemId, "quantity", e.target.value)}
                  className={cn("h-9 text-sm rounded-lg", isLowConfidence && "border-amber-300")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Unit Cost (৳) *</label>
                <Input
                  type="number" step="0.01"
                  value={item.unitCost}
                  onChange={(e) => updateItem(item.cartItemId, "unitCost", e.target.value)}
                  className={cn("h-9 text-sm rounded-lg", isLowConfidence && "border-amber-300")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Batch No *</label>
                <Input
                  value={item.batchNo}
                  onChange={(e) => updateItem(item.cartItemId, "batchNo", e.target.value)}
                  className={cn("h-9 text-sm rounded-lg font-mono", (isLowConfidence || isMediumConfidence) && "border-amber-300")}
                  placeholder="SQ240101"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Expiry *</label>
                <Input
                  type="date"
                  value={item.expiryDate}
                  onChange={(e) => updateItem(item.cartItemId, "expiryDate", e.target.value)}
                  className={cn("h-9 text-sm rounded-lg", (isLowConfidence || isMediumConfidence) && "border-amber-300")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Mfg Date</label>
                <Input
                  type="date"
                  value={item.mfgDate}
                  onChange={(e) => updateItem(item.cartItemId, "mfgDate", e.target.value)}
                  className="h-9 text-sm rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">MRP (৳)</label>
                <Input
                  type="number" step="0.01"
                  value={item.mrp}
                  onChange={(e) => updateItem(item.cartItemId, "mrp", e.target.value)}
                  className={cn("h-9 text-sm rounded-lg", isLowConfidence && "border-amber-300")}
                />
              </div>
            </div>
            <div className="text-right text-xs font-medium pt-1 border-t border-dashed">
              Line Total: <span className="text-emerald-600 font-bold">৳{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0)).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
        );
      })}

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
