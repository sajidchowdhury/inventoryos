"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Pill, Edit2, Plus, Clock, AlertTriangle,
  Package, TrendingUp, TrendingDown, Trash2, Calendar,
  Boxes, ChevronRight, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { StockAdjust } from "./StockAdjust";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batchNo: string;
  mfgDate: string | null;
  expiryDate: string;
  quantity: number;
  purchasePrice: number | null;
  mrp: number | null;
  status: string;
  notes: string | null;
}

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  stripSize: number | null;
  boxSize: number | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  scheduleType: string | null;
  mrp: number | null;
  isPrescription: boolean;
  storageCondition: string | null;
  rackNo: string | null;
  minStock: number;
  maxStock: number;
  reorderLevel: number;
  category: { id: string; name: string; color: string } | null;
  inventory: { quantity: number; minStock: number; unitCost: number | null } | null;
  batches: Batch[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const scheduleColors: Record<string, string> = {
  OTC: "bg-green-100 text-green-700",
  Schedule_H: "bg-blue-100 text-blue-700",
  Schedule_H1: "bg-orange-100 text-orange-700",
  Schedule_X: "bg-red-100 text-red-700",
  Narcotic: "bg-purple-100 text-purple-700",
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatExpiry(dateStr: string): { label: string; severity: "ok" | "warning" | "critical" | "expired" } {
  const days = daysUntil(dateStr);
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, severity: "expired" };
  if (days <= 30) return { label: `${days}d left`, severity: "critical" };
  if (days <= 90) return { label: `${days}d left`, severity: "warning" };
  return { label: `${days}d left`, severity: "ok" };
}

const severityColors = {
  ok: "text-green-600 bg-green-50",
  warning: "text-orange-600 bg-orange-50",
  critical: "text-red-600 bg-red-50",
  expired: "text-red-700 bg-red-100",
};

export function ProductDetail() {
  const session = useAuthStore((s) => s.session);
  const { activeProductId, setActiveView, setEditingProductId, setEditingBatchId, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchProduct = useCallback(async () => {
    if (!businessId || !activeProductId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${activeProductId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setProduct(data.product);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [businessId, activeProductId, refreshKey]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleDeleteBatch = async (batchId: string, batchNo: string) => {
    if (!businessId) return;
    if (!confirm(`Delete batch "${batchNo}"? This will reduce stock by the batch quantity.`)) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/batches/${batchId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete batch");
    }
  };

  const handleEditProduct = () => {
    if (activeProductId) {
      setEditingProductId(activeProductId);
      setActiveView("edit-product");
    }
  };

  const handleAddBatch = () => {
    if (activeProductId) {
      setActiveProductId(activeProductId);
      setActiveView("add-batch");
    }
  };

  const handleEditBatch = (batchId: string) => {
    setEditingBatchId(batchId);
    setActiveView("edit-batch");
  };

  const handleAdjustComplete = () => {
    setAdjustBatch(null);
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  if (error || !product) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Error</h1>
        </div>
        <Card><CardContent className="p-6 text-center text-sm text-destructive">{error || "Product not found"}</CardContent></Card>
      </motion.div>
    );
  }

  const totalStock = product.inventory?.quantity ?? 0;
  const stockLevel = totalStock <= 0 ? "out" : totalStock <= (product.inventory?.minStock || product.minStock) ? "low" : "ok";
  const activeBatches = product.batches.filter((b) => b.status !== "expired" && b.quantity > 0);
  const expiredBatches = product.batches.filter((b) => b.status === "expired");

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("products")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 truncate">Product Detail</h1>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleEditProduct}>
          <Edit2 className="h-3.5 w-3.5" /> Edit
        </Button>
      </div>

      {/* Product Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
            >
              <Pill className="h-6 w-6" style={{ color: product.category?.color || "#6b7280" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold">{product.name}</h2>
              {product.genericName && (
                <p className="text-sm text-muted-foreground">{product.genericName}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {product.strength && (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{product.strength}</span>
                )}
                {product.dosageForm && (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">{product.dosageForm}</span>
                )}
                {product.scheduleType && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", scheduleColors[product.scheduleType] || "bg-gray-100 text-gray-700")}>
                    {product.scheduleType.replace("_", " ")}
                  </span>
                )}
                {product.isPrescription && (
                  <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">Rx</span>
                )}
              </div>
            </div>
          </div>

          {product.manufacturer && (
            <div className="text-xs text-muted-foreground">
              by <span className="font-medium text-foreground">{product.manufacturer}</span>
              {product.rackNo && <> · Rack <span className="font-medium text-foreground">{product.rackNo}</span></>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <Boxes className={cn(
              "h-5 w-5 mx-auto mb-1",
              stockLevel === "out" && "text-red-600",
              stockLevel === "low" && "text-orange-600",
              stockLevel === "ok" && "text-green-600"
            )} />
            <p className={cn(
              "text-lg font-bold",
              stockLevel === "out" && "text-red-600",
              stockLevel === "low" && "text-orange-600",
              stockLevel === "ok" && "text-green-600"
            )}>{totalStock}</p>
            <p className="text-[10px] text-muted-foreground">Total Stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-lg font-bold text-blue-600">{product.batches.length}</p>
            <p className="text-[10px] text-muted-foreground">Batches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-600" />
            <p className="text-lg font-bold text-red-600">{expiredBatches.length}</p>
            <p className="text-[10px] text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {stockLevel !== "ok" && (
        <Card className={cn(
          "border-l-4",
          stockLevel === "out" ? "border-l-red-500 bg-red-50" : "border-l-orange-500 bg-orange-50"
        )}>
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className={cn("h-4 w-4 shrink-0", stockLevel === "out" ? "text-red-600" : "text-orange-600")} />
            <p className={cn("text-xs font-medium", stockLevel === "out" ? "text-red-700" : "text-orange-700")}>
              {stockLevel === "out" ? "OUT OF STOCK" : `LOW STOCK — below minimum (${product.inventory?.minStock || product.minStock} ${product.unit})`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Storage & Pricing Info */}
      <Card>
        <CardContent className="p-0 divide-y">
          {product.storageCondition && (
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Storage</span>
              <span className="text-xs font-medium">{product.storageCondition}</span>
            </div>
          )}
          {product.mrp && (
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">MRP</span>
              <span className="text-xs font-bold">৳{product.mrp}</span>
            </div>
          )}
          {product.sku && (
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">SKU</span>
              <span className="text-xs font-medium">{product.sku}</span>
            </div>
          )}
          {product.stripSize && (
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Strip / Box</span>
              <span className="text-xs font-medium">{product.stripSize} / {product.boxSize || "—"}</span>
            </div>
          )}
          {product.reorderLevel > 0 && (
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Reorder At</span>
              <span className="text-xs font-medium">{product.reorderLevel} {product.unit}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batches Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <Boxes className="h-4 w-4" /> Batches ({product.batches.length})
          </h2>
          <Button size="sm" className="gap-1.5" onClick={handleAddBatch}>
            <Plus className="h-3.5 w-3.5" /> Add Batch
          </Button>
        </div>

        {product.batches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium">No batches yet</p>
              <p className="text-xs text-muted-foreground">Add a batch to start tracking stock &amp; expiry</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {product.batches.map((batch) => {
              const expiry = formatExpiry(batch.expiryDate);
              return (
                <Card key={batch.id} className="overflow-hidden">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">Batch #{batch.batchNo}</p>
                          <Badge
                            variant="outline"
                            className={cn("text-[9px] px-1.5 py-0", severityColors[expiry.severity])}
                          >
                            {expiry.label}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Qty: <span className="font-medium text-foreground">{batch.quantity} {product.unit}</span>
                          {batch.purchasePrice && <> · Cost: ৳{batch.purchasePrice}</>}
                          {batch.mrp && <> · MRP: ৳{batch.mrp}</>}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          Exp: {new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          {batch.mfgDate && <> · Mfg: {new Date(batch.mfgDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</>}
                        </p>
                        {batch.notes && (
                          <p className="text-[10px] text-muted-foreground italic mt-0.5">{batch.notes}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-4 gap-1 pt-1 border-t">
                      <button
                        className="py-1.5 text-[11px] font-medium text-green-700 hover:bg-green-50 rounded flex items-center justify-center gap-1"
                        onClick={() => setAdjustBatch({ ...batch, status: "STOCK_IN" } as Batch)}
                      >
                        <TrendingUp className="h-3 w-3" /> In
                      </button>
                      <button
                        className="py-1.5 text-[11px] font-medium text-orange-700 hover:bg-orange-50 rounded flex items-center justify-center gap-1"
                        onClick={() => setAdjustBatch({ ...batch, status: "STOCK_OUT" } as Batch)}
                      >
                        <TrendingDown className="h-3 w-3" /> Out
                      </button>
                      <button
                        className="py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted rounded flex items-center justify-center gap-1"
                        onClick={() => handleEditBatch(batch.id)}
                      >
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        className="py-1.5 text-[11px] font-medium text-destructive hover:bg-red-50 rounded flex items-center justify-center gap-1"
                        onClick={() => handleDeleteBatch(batch.id, batch.batchNo)}
                      >
                        <Trash2 className="h-3 w-3" /> Del
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Stock Adjust Dialog */}
      <Dialog open={!!adjustBatch} onOpenChange={(open) => !open && setAdjustBatch(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {adjustBatch?.status === "STOCK_IN" ? "Stock In" : "Stock Out"} — Batch #{adjustBatch?.batchNo}
            </DialogTitle>
          </DialogHeader>
          {adjustBatch && (
            <StockAdjust
              batch={adjustBatch}
              productName={product.name}
              unit={product.unit}
              onComplete={handleAdjustComplete}
              onCancel={() => setAdjustBatch(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
