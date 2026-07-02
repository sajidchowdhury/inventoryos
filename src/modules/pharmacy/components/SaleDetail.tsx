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
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
};

const paymentColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
  refunded: "bg-sky-100 text-sky-700 border-sky-200",
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
      <motion.div {...fadeIn} className="space-y-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("sales")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-6 space-y-3">
            <div className="skeleton h-8 w-48 rounded-lg" />
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-4 w-40 rounded" />
          </CardContent>
        </Card>
        <Card className="shadow-pharmacy border-0">
          <CardContent className="p-4 space-y-2">
            <div className="skeleton h-12 w-full rounded-lg" />
            <div className="skeleton h-12 w-full rounded-lg" />
            <div className="skeleton h-12 w-full rounded-lg" />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!sale) {
    return (
      <motion.div {...fadeIn} className="space-y-4 pharmacy-bg min-h-screen">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("sales")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Sale not found</h1>
        </div>
      </motion.div>
    );
  }

  const isCancelled = sale.status === "cancelled";

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header — Gradient emerald card */}
      <Card className="stagger-in overflow-hidden border-0 shadow-pharmacy-lg print:border-0 print:shadow-none">
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-600 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-emerald-100" />
                <p className="text-xs text-emerald-100 uppercase tracking-wider font-medium">Invoice</p>
              </div>
              <h2 className="text-xl font-bold font-mono tracking-tight">{sale.invoiceNo}</h2>
              <p className="text-[11px] text-emerald-50 mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(sale.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <Badge variant="outline" className={cn("text-[9px] mt-2 bg-white/15 text-white border-white/30 backdrop-blur-sm")}>
                {sale.status}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-emerald-100 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold">৳{sale.totalAmount.toFixed(2)}</p>
            </div>
          </div>
          {sale.customer && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-[10px] text-emerald-100 uppercase tracking-wider mb-0.5">Customer</p>
              <button
                className="text-sm font-semibold hover:underline flex items-center gap-1.5"
                onClick={() => { setActiveCustomerId(sale.customer!.id); setActiveView("customer-detail"); }}
              >
                <User className="h-3.5 w-3.5" />
                {sale.customer.name}
              </button>
              {sale.customer.phone && <p className="text-[11px] text-emerald-50 mt-0.5">{sale.customer.phone}</p>}
            </div>
          )}
        </div>
        {/* Action buttons row */}
        <CardContent className="p-3 bg-white flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl shadow-pharmacy"
            onClick={() => setActiveView("sales")}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sales
          </Button>
          <div className="flex-1" />
          <Button
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          {!isCancelled && (
            <>
              {sale.paymentStatus !== "paid" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded-xl"
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
                className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 rounded-xl"
                onClick={() => setActiveView("returns")}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Return
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-rose-300 hover:bg-rose-50 rounded-xl"
                onClick={() => setCancelOpen(true)}
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {success && (
        <Card className="border-emerald-500/30 bg-emerald-50 print:hidden shadow-pharmacy">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700">
            <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Check className="h-3.5 w-3.5" />
            </div>
            {success}
          </CardContent>
        </Card>
      )}

      {isCancelled && (
        <Card className="border-rose-500/30 bg-rose-50 print:hidden shadow-pharmacy">
          <CardContent className="p-3.5 space-y-1">
            <p className="text-sm font-semibold text-rose-700 flex items-center gap-1.5">
              <X className="h-4 w-4" /> Sale Cancelled
            </p>
            {sale.cancelReason && <p className="text-xs text-rose-600">Reason: {sale.cancelReason}</p>}
            {sale.cancelledAt && (
              <p className="text-[10px] text-muted-foreground">
                Cancelled on {new Date(sale.cancelledAt).toLocaleString("en-GB")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Business header (printable) */}
      <Card className="stagger-in shadow-pharmacy border-0 print:border-0 print:shadow-none hidden print:block">
        <CardContent className="p-5">
          <h2 className="text-xl font-bold">{session?.business?.name}</h2>
          {session?.business?.address && <p className="text-xs text-muted-foreground">{session.business.address}</p>}
          <p className="text-xs text-muted-foreground">{session?.business?.businessType?.name}</p>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-white flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <ShoppingBag className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">Items ({sale.itemCount})</p>
          </div>
          <div className="divide-y divide-dashed">
            {sale.items.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  "p-3.5 flex items-start justify-between gap-2 transition-colors",
                  idx % 2 === 0 ? "bg-white" : "bg-emerald-50/30"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.productName}</p>
                  {item.genericName && <p className="text-[10px] text-muted-foreground">{item.genericName}</p>}
                  {item.batchNo && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Batch: <span className="font-medium">{item.batchNo}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {item.quantity} {item.unit} × ৳{item.unitPrice.toFixed(2)}
                    {item.discountPercent > 0 && <span className="text-amber-600 font-medium"> (−{item.discountPercent}%)</span>}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-600 shrink-0">৳{item.totalPrice.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary section */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-0 divide-y divide-dashed">
          <div className="p-3.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">৳{sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discountPercent > 0 && (
            <div className="p-3.5 flex items-center justify-between text-sm text-amber-600">
              <span>Discount ({sale.discountPercent}%)</span>
              <span className="font-medium">−৳{(sale.subtotal * sale.discountPercent / 100).toFixed(2)}</span>
            </div>
          )}
          {sale.discountAmount > 0 && (
            <div className="p-3.5 flex items-center justify-between text-sm text-amber-600">
              <span>Additional Discount</span>
              <span className="font-medium">−৳{sale.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {sale.taxAmount > 0 && (
            <div className="p-3.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax/VAT</span>
              <span className="font-medium">+৳{sale.taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="p-4 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-emerald-50/50">
            <span className="text-sm font-bold text-emerald-700">Total</span>
            <span className="text-2xl font-bold text-emerald-600">৳{sale.totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Section */}
      <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <DollarSign className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">Payment</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50/50 p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Method</p>
              <p className="text-sm font-semibold capitalize">{sale.paymentMethod.replace("_", " ")}</p>
            </div>
            <div className="rounded-xl bg-emerald-50/50 p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant="outline" className={cn("text-[9px]", paymentColors[sale.paymentStatus])}>{sale.paymentStatus}</Badge>
            </div>
          </div>
          {sale.paidAmount < sale.totalAmount && !isCancelled && (
            <div className="space-y-1.5 pt-2 border-t border-dashed">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-semibold text-emerald-600">৳{sale.paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance Due</span>
                <span className="font-bold text-rose-600">৳{(sale.totalAmount - sale.paidAmount).toFixed(2)}</span>
              </div>
            </div>
          )}
          {sale.paidAmount >= sale.totalAmount && !isCancelled && (
            <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-dashed text-emerald-600">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Fully Paid</span>
            </div>
          )}
        </CardContent>
      </Card>

      {sale.notes && (
        <Card className="stagger-in shadow-pharmacy border-0">
          <CardContent className="p-3.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-xs text-foreground">{sale.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="stagger-in text-center text-[10px] text-muted-foreground pt-2 print:pt-4 space-y-0.5">
        <p className="font-medium">Thank you for your business!</p>
        <p>Generated by InventoryOS</p>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Sale {sale.invoiceNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> This will restore stock to inventory
              </p>
              <p className="mt-1">All {sale.itemCount} item(s) will be returned to their batches via reverse FEFO.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cancel Reason *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setError(null); }}
                placeholder="e.g., Customer returned items, billing error, etc."
                className="min-h-[60px] text-sm rounded-xl border-amber-200 focus-visible:ring-amber-500"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setCancelOpen(false)} disabled={cancelling}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5 rounded-xl" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
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
