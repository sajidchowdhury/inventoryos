"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Truck, Phone, User,
  DollarSign, Clock, AlertCircle, Check, Loader2, Package,
  Calendar, Wallet, TrendingDown, BadgeCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface BalanceData {
  supplier: { id: string; name: string; code: string | null; phone: string | null; contactPerson: string | null; address?: string | null };
  summary: {
    totalDue: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingCount: number;
    oldestDueDays: number;
  };
  aging: {
    current: { count: number; amount: number };
    "31-60": { count: number; amount: number };
    "61-90": { count: number; amount: number };
    "90+": { count: number; amount: number };
  };
  outstandingPurchases: Array<{
    id: string;
    purchaseNo: string;
    invoiceNo: string | null;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    createdAt: string;
    ageDays: number;
    bucket: string;
  }>;
  purchaseHistory: Array<{
    id: string;
    purchaseNo: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    status: string;
    createdAt: string;
    _count: { items: number };
  }>;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const bucketColors: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  "31-60": "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  "61-90": "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  "90+": "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const bucketBarColors: Record<string, string> = {
  current: "from-emerald-400 to-emerald-600",
  "31-60": "from-amber-400 to-amber-600",
  "61-90": "from-orange-400 to-orange-600",
  "90+": "from-rose-400 to-rose-600",
};

function getPaymentStatusBadge(status: string) {
  if (status === "paid") {
    return {
      label: "Paid",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    };
  }
  if (status === "partial") {
    return {
      label: "Partial",
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    };
  }
  return {
    label: status === "unpaid" ? "Unpaid" : status,
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
}

export function SupplierDetailView() {
  const session = useAuthStore((s) => s.session);
  const { activeSupplierId, setActiveView, setActivePurchaseId } = useNavStore();
  const businessId = session?.business?.id;

  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payReference, setPayReference] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!businessId || !activeSupplierId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${activeSupplierId}/balance`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Fetch balance error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, activeSupplierId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePay = async () => {
    if (!businessId || !activeSupplierId || !payAmount) {
      setPayError("Amount is required");
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${activeSupplierId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          method: payMethod,
          reference: payReference || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setPaySuccess(`Payment of ৳${parseFloat(payAmount).toFixed(2)} recorded. New balance: ৳${json.supplier?.balance?.toFixed(2)}`);
      setPayOpen(false);
      setPayAmount("");
      setPayReference("");
      setTimeout(() => setPaySuccess(null), 4000);
      fetchData();
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen space-y-4 p-4 pb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50" onClick={() => setActiveView("suppliers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="overflow-hidden border-slate-200/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-slate-200/70">
              <CardContent className="p-3"><div className="skeleton h-14 rounded" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-slate-200/70">
              <CardContent className="p-3.5"><div className="skeleton h-16 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen space-y-4 p-4 pb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50" onClick={() => setActiveView("suppliers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Not found</h1>
        </div>
      </motion.div>
    );
  }

  const { supplier, summary, aging, outstandingPurchases, purchaseHistory } = data;
  const hasOutstanding = summary.totalDue > 0;

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen space-y-4 p-4 pb-6">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl hover:bg-emerald-50"
          onClick={() => setActiveView("suppliers")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Supplier Details</h1>
          <p className="text-[11px] text-muted-foreground">Outstanding balance &amp; purchase history</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Success banner */}
      {paySuccess && (
        <Card className="card-hover stagger-in border-emerald-200 bg-emerald-50/60 shadow-pharmacy">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700">
            <BadgeCheck className="h-4 w-4 shrink-0" /> {paySuccess}
          </CardContent>
        </Card>
      )}

      {/* Supplier gradient header card */}
      <Card className="card-hover stagger-in overflow-hidden border-0 shadow-pharmacy-lg">
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
          <div className="relative flex items-start gap-3.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/30 shrink-0">
              <Truck className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-white truncate">{supplier.name}</p>
                {supplier.code && (
                  <span className="inline-flex items-center rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white backdrop-blur-sm">
                    {supplier.code}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-emerald-50/90">
                {supplier.contactPerson && (
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{supplier.contactPerson}</span>
                )}
                {supplier.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</span>
                )}
                {supplier.address && (
                  <span className="flex items-center gap-1 truncate">{supplier.address}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Balance Summary — 3-card grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 shadow-sm">
              <Package className="h-4 w-4 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">Total Purchased</p>
            <p className="text-sm font-bold text-sky-700">৳{summary.totalInvoiced.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">Total Paid</p>
            <p className="text-sm font-bold text-emerald-700">৳{summary.totalPaid.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">Balance</p>
            <p className={cn("text-sm font-bold", hasOutstanding ? "text-rose-700" : "text-emerald-700")}>
              ৳{summary.totalDue.toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding balance highlight + record payment */}
      {hasOutstanding && (
        <Card className="card-hover stagger-in overflow-hidden border-rose-200 shadow-pharmacy">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                <p className="text-3xl font-bold text-rose-600">৳{summary.totalDue.toFixed(2)}</p>
              </div>
              {summary.oldestDueDays > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <Clock className="h-2.5 w-2.5" /> Oldest: {summary.oldestDueDays}d
                </span>
              )}
            </div>
            <Button
              className="w-full gap-2 mt-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
              size="sm"
              onClick={() => { setPayAmount(summary.totalDue.toFixed(2)); setPayOpen(true); }}
            >
              <DollarSign className="h-4 w-4" /> Record Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Aging Buckets */}
      {hasOutstanding && (
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Balance Aging
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(aging).map(([bucket, info]) => (
                <div key={bucket} className={cn("rounded-xl p-2 text-center", bucketColors[bucket])}>
                  <div className={cn("mx-auto mb-1 h-1 w-6 rounded-full bg-gradient-to-r", bucketBarColors[bucket])} />
                  <p className="text-[9px] font-medium">{bucket === "current" ? "0-30d" : bucket}</p>
                  <p className="text-sm font-bold">৳{info.amount.toFixed(0)}</p>
                  <p className="text-[8px] opacity-70">{info.count} inv</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Purchases */}
      {outstandingPurchases.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Outstanding Purchases
            </h2>
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
              {outstandingPurchases.length}
            </span>
          </div>
          {outstandingPurchases.map((p) => (
            <Card
              key={p.id}
              className="card-hover stagger-in cursor-pointer border-slate-200/70 shadow-pharmacy"
              onClick={() => { setActivePurchaseId(p.id); setActiveView("purchase-detail"); }}
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 shrink-0">
                      <Package className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{p.purchaseNo}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {p.ageDays}d ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-rose-600">৳{p.dueAmount.toFixed(2)}</p>
                    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold", bucketColors[p.bucket])}>
                      {p.bucket === "current" ? "0-30d" : p.bucket}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Total</p>
                    <p className="text-[11px] font-bold text-slate-700">৳{p.totalAmount.toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-muted-foreground">Paid</p>
                    <p className="text-[11px] font-bold text-emerald-600">৳{p.paidAmount.toFixed(0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Purchase History */}
      {purchaseHistory.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 px-1">
            <Package className="h-3.5 w-3.5 text-emerald-500" /> Recent Purchases
          </h2>
          {purchaseHistory.map((p) => {
            const status = getPaymentStatusBadge(p.paymentStatus);
            return (
              <Card
                key={p.id}
                className="card-hover stagger-in cursor-pointer border-slate-200/70 shadow-pharmacy"
                onClick={() => { setActivePurchaseId(p.id); setActiveView("purchase-detail"); }}
              >
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{p.purchaseNo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p._count.items} items · {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-900">৳{p.totalAmount.toFixed(0)}</p>
                    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold", status.className)}>
                      {status.label}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment to {supplier.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {payError && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {payError}</p>}

            <Card className="bg-muted/30 border-slate-200/70">
              <CardContent className="p-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-bold text-rose-600">৳{summary.totalDue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Allocation</span>
                  <span className="font-medium">FIFO (oldest first)</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount (৳) *</Label>
              <Input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => { setPayAmount(e.target.value); setPayError(null); }}
                className="h-10 rounded-xl"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reference</Label>
              <Input
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                className="h-10 rounded-xl"
                placeholder="Txn ID, cheque no..."
              />
            </div>

            <Button
              className="w-full h-10 gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
              onClick={handlePay}
              disabled={paying || !payAmount}
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {paying ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
