"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Printer, X, AlertCircle, Check, Loader2,
  Truck, Calendar, Package, Receipt,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface PurchaseItem {
  id: string;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  unit: string;
  unitCost: number;
  totalPrice: number;
  batchNo: string | null;
  expiryDate: string | null;
  mfgDate: string | null;
  mrp: number | null;
  batch: { id: string; batchNo: string; expiryDate: string; status: string; quantity: number } | null;
  product: { id: string; name: string; genericName: string | null; strength: string | null; category: { name: string; color: string } | null };
}

interface Purchase {
  id: string;
  purchaseNo: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; code: string | null; phone: string | null; email: string | null; address: string | null } | null;
  items: PurchaseItem[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const statusColors: Record<string, string> = {
  received: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  ordered: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-orange-100 text-orange-700",
  unpaid: "bg-red-100 text-red-700",
};

export function PurchaseDetail() {
  const session = useAuthStore((s) => s.session);
  const { activePurchaseId, setActiveView } = useNavStore();
  const businessId = session?.business?.id;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPurchase = useCallback(async () => {
    if (!businessId || !activePurchaseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/purchases/${activePurchaseId}`);
      const data = await res.json();
      if (data.success) setPurchase(data.purchase);
    } catch (err) {
      console.error("Fetch purchase error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, activePurchaseId]);

  useEffect(() => { fetchPurchase(); }, [fetchPurchase]);

  const handleCancel = async () => {
    if (!businessId || !activePurchaseId || !cancelReason.trim()) {
      setError("Cancel reason is required");
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/purchases/${activePurchaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess("Purchase cancelled — stock removed, batches deleted");
      setCancelOpen(false);
      setCancelReason("");
      fetchPurchase();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("purchases")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  if (!purchase) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("purchases")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Not found</h1>
        </div>
      </motion.div>
    );
  }

  const isCancelled = purchase.status === "cancelled";

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("purchases")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">{purchase.purchaseNo}</h1>
        <Button variant="ghost" size="icon" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
        </Button>
        {!isCancelled && (
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setCancelOpen(true)}>
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </div>

      {success && (
        <Card className="border-green-500/50 bg-green-50 print:hidden">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> {success}
          </CardContent>
        </Card>
      )}

      {isCancelled && (
        <Card className="border-red-500/50 bg-red-50 print:hidden">
          <CardContent className="p-3 space-y-1">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
              <X className="h-4 w-4" /> Purchase Cancelled
            </p>
            {purchase.notes?.includes("CANCELLED:") && (
              <p className="text-xs text-red-600">{purchase.notes.split("CANCELLED:")[1]?.split("|")[0]?.trim()}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Header */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{session?.business?.name}</h2>
              <p className="text-sm text-muted-foreground">{session?.business?.businessType?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{purchase.purchaseNo}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(purchase.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <Badge variant="outline" className={cn("text-[9px] mt-1", statusColors[purchase.status])}>{purchase.status}</Badge>
            </div>
          </div>
          {purchase.supplier && (
            <div className="pt-2 border-t mt-2">
              <p className="text-[10px] text-muted-foreground">Supplier</p>
              <p className="text-sm font-medium">{purchase.supplier.name}</p>
              {purchase.supplier.phone && <p className="text-xs text-muted-foreground">{purchase.supplier.phone}</p>}
              {purchase.supplier.address && <p className="text-xs text-muted-foreground">{purchase.supplier.address}</p>}
            </div>
          )}
          {purchase.invoiceNo && (
            <div className="text-[10px] text-muted-foreground">
              Supplier Invoice: <span className="font-medium">{purchase.invoiceNo}</span>
              {purchase.invoiceDate && ` · ${new Date(purchase.invoiceDate).toLocaleDateString("en-GB")}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b bg-muted/50">
            <p className="text-xs font-semibold">Items ({purchase.items.length})</p>
          </div>
          <div className="divide-y">
            {purchase.items.map((item) => (
              <div key={item.id} className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.productName}</p>
                    {item.product.genericName && <p className="text-[10px] text-muted-foreground">{item.product.genericName}</p>}
                    {item.batchNo && (
                      <p className="text-[10px] text-muted-foreground">
                        Batch: {item.batchNo}
                        {item.expiryDate && ` · Exp: ${new Date(item.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}`}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold shrink-0">৳{item.totalPrice.toFixed(2)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {item.quantity} {item.unit} × ৳{item.unitCost.toFixed(2)}
                  {item.mrp && ` · MRP: ৳${item.mrp}`}
                </p>
                {item.batch && (
                  <Badge variant="outline" className={cn("text-[9px]", item.batch.status === "active" ? "text-green-600" : "text-orange-600")}>
                    Batch status: {item.batch.status} ({item.batch.quantity} {item.unit} left)
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="p-0 divide-y">
          <div className="p-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>৳{purchase.subtotal.toFixed(2)}</span>
          </div>
          {purchase.discountAmount > 0 && (
            <div className="p-3 flex items-center justify-between text-sm text-orange-600">
              <span>Discount</span>
              <span>−৳{purchase.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {purchase.taxAmount > 0 && (
            <div className="p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax/VAT</span>
              <span>+৳{purchase.taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="p-3 flex items-center justify-between bg-primary/5">
            <span className="text-sm font-bold">Total</span>
            <span className="text-lg font-bold text-primary">৳{purchase.totalAmount.toFixed(2)}</span>
          </div>
          {purchase.paidAmount < purchase.totalAmount && !isCancelled && (
            <>
              <div className="p-3 flex items-center justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>৳{purchase.paidAmount.toFixed(2)}</span>
              </div>
              <div className="p-3 flex items-center justify-between text-sm text-red-600">
                <span>Due</span>
                <span className="font-bold">৳{(purchase.totalAmount - purchase.paidAmount).toFixed(2)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Status */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Card><CardContent className="p-2">
          <p className="text-muted-foreground text-[10px]">Payment Status</p>
          <Badge variant="outline" className={cn("text-[9px]", paymentColors[purchase.paymentStatus])}>{purchase.paymentStatus}</Badge>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-muted-foreground text-[10px]">Received Date</p>
          <p className="font-medium text-xs">
            {purchase.receivedDate ? new Date(purchase.receivedDate).toLocaleDateString("en-GB") : "—"}
          </p>
        </CardContent></Card>
      </div>

      {purchase.notes && !isCancelled && (
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Notes</p>
          <p className="text-xs">{purchase.notes}</p>
        </CardContent></Card>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Purchase {purchase.purchaseNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
              <p className="font-semibold">⚠️ This will reverse all stock movements</p>
              <p className="mt-1">All {purchase.items.length} batch(es) will be deleted and inventory reduced.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cancel Reason *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setError(null); }}
                placeholder="e.g., Wrong items received, duplicate order..."
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)} disabled={cancelling}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {cancelling ? "Cancelling..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
