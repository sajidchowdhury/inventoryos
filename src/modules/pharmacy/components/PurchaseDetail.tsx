"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Printer, X, AlertCircle, Check, Loader2,
  Truck, Calendar, Package, RotateCcw, CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { PurchaseReturnDialog } from "./PurchaseReturnDialog";
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
  received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  ordered: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const paymentColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
};

export function PurchaseDetail() {
  const session = useAuthStore((s) => s.session);
  const { activePurchaseId, setActiveView } = useNavStore();
  const businessId = session?.business?.id;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
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
      <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2 stagger-in">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setActiveView("purchases")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-4 w-48 rounded" />
            <div className="skeleton h-32 w-full rounded mt-2" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!purchase) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2 stagger-in">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setActiveView("purchases")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Not found</h1>
        </div>
      </motion.div>
    );
  }

  const isCancelled = purchase.status === "cancelled";
  const balanceDue = Math.max(0, purchase.totalAmount - purchase.paidAmount);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("purchases")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 font-mono">{purchase.purchaseNo}</h1>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
        </Button>
        {!isCancelled && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 rounded-xl"
              onClick={() => setReturnOpen(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Return
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-rose-600 border-rose-300 hover:bg-rose-50 rounded-xl" onClick={() => setCancelOpen(true)}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        )}
      </div>

      {success && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden border-l-4 border-l-emerald-500 print:hidden">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50">
            <Check className="h-4 w-4" /> {success}
          </CardContent>
        </Card>
      )}

      {isCancelled && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden border-l-4 border-l-rose-500 print:hidden">
          <CardContent className="p-3 space-y-1 bg-rose-50">
            <p className="text-sm font-semibold text-rose-700 flex items-center gap-1.5">
              <X className="h-4 w-4" /> Purchase Cancelled
            </p>
            {purchase.notes?.includes("CANCELLED:") && (
              <p className="text-xs text-rose-600">{purchase.notes.split("CANCELLED:")[1]?.split("|")[0]?.trim()}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Header - gradient blue card */}
      <Card className="stagger-in shadow-pharmacy-lg border-0 overflow-hidden print:border-0 print:shadow-none">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide opacity-80">Purchase Order</p>
              <h2 className="text-xl font-bold font-mono truncate">{purchase.purchaseNo}</h2>
              <p className="text-xs opacity-90 mt-1 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {new Date(purchase.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <div className="mt-2">
                <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20 text-[10px]">{purchase.status}</Badge>
              </div>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>
        </div>
        <CardContent className="p-5 space-y-3">
          {purchase.supplier && (
            <div className="flex items-start gap-3 pb-3 border-b border-dashed">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Supplier</p>
                <p className="text-sm font-semibold">{purchase.supplier.name}</p>
                {purchase.supplier.phone && <p className="text-xs text-muted-foreground">{purchase.supplier.phone}</p>}
                {purchase.supplier.address && <p className="text-xs text-muted-foreground">{purchase.supplier.address}</p>}
              </div>
            </div>
          )}
          {purchase.invoiceNo && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Supplier Invoice</span>
              <span className="font-medium font-mono">
                {purchase.invoiceNo}
                {purchase.invoiceDate && ` · ${new Date(purchase.invoiceDate).toLocaleDateString("en-GB")}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-transparent">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" /> Items ({purchase.items.length})
            </p>
          </div>
          <div className="divide-y">
            {purchase.items.map((item, idx) => (
              <div key={item.id} className={cn("p-3.5 space-y-1", idx % 2 === 1 && "bg-muted/30")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{item.productName}</p>
                    {item.product.genericName && <p className="text-[10px] text-muted-foreground">{item.product.genericName}</p>}
                    {item.batchNo && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Batch: {item.batchNo}
                        {item.expiryDate && ` · Exp: ${new Date(item.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}`}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-emerald-600 shrink-0">৳{item.totalPrice.toFixed(2)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {item.quantity} {item.unit} × ৳{item.unitCost.toFixed(2)}
                  {item.mrp && ` · MRP: ৳${item.mrp}`}
                </p>
                {item.batch && (
                  <Badge variant="outline" className={cn("text-[9px]", item.batch.status === "active" ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200")}>
                    Batch: {item.batch.status} ({item.batch.quantity} {item.unit} left)
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-0 divide-y">
          <div className="p-3.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">৳{purchase.subtotal.toFixed(2)}</span>
          </div>
          {purchase.discountAmount > 0 && (
            <div className="p-3.5 flex items-center justify-between text-sm text-amber-600">
              <span>Discount</span>
              <span className="font-medium">−৳{purchase.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {purchase.taxAmount > 0 && (
            <div className="p-3.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax/VAT</span>
              <span className="font-medium">+৳{purchase.taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="p-3.5 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-transparent">
            <span className="text-sm font-bold">Total</span>
            <span className="text-lg font-bold text-emerald-600">৳{purchase.totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Section */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold">Payment</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Paid Amount</p>
              <p className="text-base font-bold text-emerald-600">৳{purchase.paidAmount.toFixed(2)}</p>
              <Badge variant="outline" className={cn("text-[9px] mt-1", paymentColors[purchase.paymentStatus])}>{purchase.paymentStatus}</Badge>
            </div>
            <div className="bg-rose-50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Balance Due</p>
              <p className="text-base font-bold text-rose-600">৳{balanceDue.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Recd: {purchase.receivedDate ? new Date(purchase.receivedDate).toLocaleDateString("en-GB") : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {purchase.notes && !isCancelled && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Notes</p>
          <p className="text-xs mt-1">{purchase.notes}</p>
        </CardContent></Card>
      )}

      {/* Action Buttons */}
      <div className="stagger-in flex gap-2 print:hidden">
        <Button
          variant="outline"
          className="flex-1 h-11 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => setActiveView("purchases")}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        {balanceDue > 0 && !isCancelled && (
          <Button
            className="flex-1 h-11 gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
            onClick={() => { setActiveView("payments"); }}
          >
            <CreditCard className="h-4 w-4" /> Record Payment
          </Button>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Purchase {purchase.purchaseNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              <p className="font-semibold flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> This will reverse all stock movements</p>
              <p className="mt-1">All {purchase.items.length} batch(es) will be deleted and inventory reduced.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cancel Reason *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setError(null); }}
                placeholder="e.g., Wrong items received, duplicate order..."
                className="min-h-[60px] text-sm rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelOpen(false)} disabled={cancelling}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5 rounded-xl" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {cancelling ? "Cancelling..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return to Supplier Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Return to Supplier — {purchase.purchaseNo}</DialogTitle></DialogHeader>
          <PurchaseReturnDialog
            purchaseId={purchase.id}
            purchaseNo={purchase.purchaseNo}
            onComplete={() => { setReturnOpen(false); fetchPurchase(); }}
            onCancel={() => setReturnOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
