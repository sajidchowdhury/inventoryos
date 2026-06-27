"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Printer, X, AlertCircle, Check, Loader2,
  User, Calendar, Receipt, ShoppingBag, TrendingUp, DollarSign, RotateCcw,
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

interface SaleItem {
  id: string;
  productName: string;
  genericName: string | null;
  batchNo: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
}

interface Sale {
  id: string;
  invoiceNo: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  itemCount: number;
  totalQuantity: number;
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  customer: { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null;
  items: SaleItem[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
};

const paymentColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-orange-100 text-orange-700",
  unpaid: "bg-red-100 text-red-700",
  refunded: "bg-blue-100 text-blue-700",
};

export function SaleDetail() {
  const session = useAuthStore((s) => s.session);
  const { activeSaleId, setActiveView, setActiveCustomerId, saleCustomerId, setSaleCustomerId } = useNavStore();
  const businessId = session?.business?.id;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSale = useCallback(async () => {
    if (!businessId || !activeSaleId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/sales/${activeSaleId}`);
      const data = await res.json();
      if (data.success) setSale(data.sale);
    } catch (err) {
      console.error("Fetch sale error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, activeSaleId]);

  useEffect(() => { fetchSale(); }, [fetchSale]);

  const handleCancel = async () => {
    if (!businessId || !activeSaleId || !cancelReason.trim()) {
      setError("Cancel reason is required");
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/sales/${activeSaleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess("Sale cancelled — stock restored");
      setCancelOpen(false);
      setCancelReason("");
      fetchSale();
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
          <Button variant="ghost" size="icon" onClick={() => setActiveView("sales")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  if (!sale) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("sales")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Sale not found</h1>
        </div>
      </motion.div>
    );
  }

  const isCancelled = sale.status === "cancelled";

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("sales")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">{sale.invoiceNo}</h1>
        <Button variant="ghost" size="icon" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
        </Button>
        {!isCancelled && (
          <>
            {sale.paymentStatus !== "paid" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-green-600 border-green-300"
                onClick={() => {
                  setSaleCustomerId(sale.customer?.id || null);
                  setActiveView("payments");
                }}
              >
                <DollarSign className="h-3.5 w-3.5" /> Pay
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-orange-600 border-orange-300"
              onClick={() => setActiveView("returns")}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Return
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setCancelOpen(true)}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
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
        <Card className="border-red-500/50 bg-red-50">
          <CardContent className="p-3 space-y-1">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
              <X className="h-4 w-4" /> Sale Cancelled
            </p>
            {sale.cancelReason && <p className="text-xs text-red-600">Reason: {sale.cancelReason}</p>}
            {sale.cancelledAt && (
              <p className="text-[10px] text-muted-foreground">
                Cancelled on {new Date(sale.cancelledAt).toLocaleString("en-GB")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice Header (printable) */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{session?.business?.name}</h2>
              {session?.business?.address && <p className="text-xs text-muted-foreground">{session.business.address}</p>}
              <p className="text-xs text-muted-foreground">{session?.business?.businessType?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{sale.invoiceNo}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(sale.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <Badge variant="outline" className={cn("text-[9px] mt-1", statusColors[sale.status])}>{sale.status}</Badge>
            </div>
          </div>
          {sale.customer && (
            <div className="pt-2 border-t mt-2">
              <p className="text-[10px] text-muted-foreground">Customer</p>
              <button
                className="text-sm font-medium hover:underline"
                onClick={() => { setActiveCustomerId(sale.customer!.id); setActiveView("customer-detail"); }}
              >
                {sale.customer.name}
              </button>
              {sale.customer.phone && <p className="text-xs text-muted-foreground">{sale.customer.phone}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b bg-muted/50">
            <p className="text-xs font-semibold">Items ({sale.itemCount})</p>
          </div>
          <div className="divide-y">
            {sale.items.map((item) => (
              <div key={item.id} className="p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.productName}</p>
                  {item.genericName && <p className="text-[10px] text-muted-foreground">{item.genericName}</p>}
                  {item.batchNo && <p className="text-[10px] text-muted-foreground">Batch: {item.batchNo}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {item.quantity} {item.unit} × ৳{item.unitPrice.toFixed(2)}
                    {item.discountPercent > 0 && <span className="text-orange-600"> (−{item.discountPercent}%)</span>}
                  </p>
                </div>
                <p className="text-sm font-semibold shrink-0">৳{item.totalPrice.toFixed(2)}</p>
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
            <span>৳{sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discountPercent > 0 && (
            <div className="p-3 flex items-center justify-between text-sm text-orange-600">
              <span>Discount ({sale.discountPercent}%)</span>
              <span>−৳{(sale.subtotal * sale.discountPercent / 100).toFixed(2)}</span>
            </div>
          )}
          {sale.discountAmount > 0 && (
            <div className="p-3 flex items-center justify-between text-sm text-orange-600">
              <span>Additional Discount</span>
              <span>−৳{sale.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {sale.taxAmount > 0 && (
            <div className="p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax/VAT</span>
              <span>+৳{sale.taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="p-3 flex items-center justify-between bg-primary/5">
            <span className="text-sm font-bold">Total</span>
            <span className="text-lg font-bold text-primary">৳{sale.totalAmount.toFixed(2)}</span>
          </div>
          {sale.paidAmount < sale.totalAmount && !isCancelled && (
            <>
              <div className="p-3 flex items-center justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>৳{sale.paidAmount.toFixed(2)}</span>
              </div>
              <div className="p-3 flex items-center justify-between text-sm text-red-600">
                <span>Due</span>
                <span className="font-bold">৳{(sale.totalAmount - sale.paidAmount).toFixed(2)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Info */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Card><CardContent className="p-2">
          <p className="text-muted-foreground text-[10px]">Payment Method</p>
          <p className="font-medium capitalize">{sale.paymentMethod.replace("_", " ")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-2">
          <p className="text-muted-foreground text-[10px]">Payment Status</p>
          <Badge variant="outline" className={cn("text-[9px]", paymentColors[sale.paymentStatus])}>{sale.paymentStatus}</Badge>
        </CardContent></Card>
      </div>

      {sale.notes && (
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Notes</p>
          <p className="text-xs">{sale.notes}</p>
        </CardContent></Card>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground pt-2 print:pt-4">
        <p>Thank you for your business!</p>
        <p>Generated by InventoryOS</p>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Sale {sale.invoiceNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
              <p className="font-semibold">⚠️ This will restore stock to inventory</p>
              <p className="mt-1">All {sale.itemCount} item(s) will be returned to their batches via reverse FEFO.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cancel Reason *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setError(null); }}
                placeholder="e.g., Customer returned items, billing error, etc."
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)} disabled={cancelling}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
