"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Truck, Phone, Mail, MapPin, User,
  DollarSign, Clock, AlertCircle, Check, Loader2, Package,
  TrendingDown, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  supplier: { id: string; name: string; code: string | null; phone: string | null; contactPerson: string | null };
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
  current: "text-green-600 bg-green-50",
  "31-60": "text-yellow-600 bg-yellow-50",
  "61-90": "text-orange-600 bg-orange-50",
  "90+": "text-red-600 bg-red-50",
};

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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("suppliers")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("suppliers")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Not found</h1>
        </div>
      </motion.div>
    );
  }

  const { supplier, summary, aging, outstandingPurchases, purchaseHistory } = data;
  const hasOutstanding = summary.totalDue > 0;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("suppliers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Supplier Details</h1>
        <Button variant="ghost" size="icon" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {paySuccess && (
        <Card className="border-green-500/50 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> {paySuccess}
          </CardContent>
        </Card>
      )}

      {/* Supplier Card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
            <Truck className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold">{supplier.name}</p>
            {supplier.code && <Badge variant="secondary" className="text-[9px]">{supplier.code}</Badge>}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              {supplier.contactPerson && <span className="flex items-center gap-0.5"><User className="h-3 w-3" />{supplier.contactPerson}</span>}
              {supplier.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{supplier.phone}</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance Summary */}
      <Card className={cn("border-l-4", hasOutstanding ? "border-l-red-500 bg-red-50/30" : "border-l-green-500 bg-green-50/30")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className={cn("text-3xl font-bold", hasOutstanding ? "text-red-600" : "text-green-600")}>
                ৳{summary.totalDue.toFixed(2)}
              </p>
            </div>
            {hasOutstanding && summary.oldestDueDays > 0 && (
              <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                Oldest: {summary.oldestDueDays}d
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div>
              <p className="text-[9px] text-muted-foreground">Total Purchased</p>
              <p className="text-sm font-bold">৳{summary.totalInvoiced.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Total Paid</p>
              <p className="text-sm font-bold text-green-600">৳{summary.totalPaid.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Due</p>
              <p className="text-sm font-bold text-red-600">৳{summary.totalDue.toFixed(0)}</p>
            </div>
          </div>
          {hasOutstanding && (
            <Button className="w-full gap-2" size="sm" onClick={() => { setPayAmount(summary.totalDue.toFixed(2)); setPayOpen(true); }}>
              <DollarSign className="h-4 w-4" /> Record Payment
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Aging Buckets */}
      {hasOutstanding && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">Balance Aging</h2>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(aging).map(([bucket, info]) => (
                <div key={bucket} className={cn("rounded-lg p-2 text-center", bucketColors[bucket])}>
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
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
            Outstanding Purchases ({outstandingPurchases.length})
          </h2>
          <div className="space-y-2">
            {outstandingPurchases.map((p) => (
              <Card key={p.id} className="cursor-pointer hover:shadow-md"
                onClick={() => { setActivePurchaseId(p.id); setActiveView("purchase-detail"); }}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{p.purchaseNo}</p>
                    <p className="text-sm font-bold text-red-600">৳{p.dueAmount.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {p.ageDays}d ago
                    </span>
                    <Badge variant="outline" className={cn("text-[9px]", bucketColors[p.bucket])}>
                      {p.bucket === "current" ? "0-30d" : p.bucket}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t">
                    <span className="text-muted-foreground">Total: ৳{p.totalAmount.toFixed(0)}</span>
                    <span className="text-green-600">Paid: ৳{p.paidAmount.toFixed(0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Purchase History */}
      {purchaseHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent Purchases</h2>
          <div className="space-y-1">
            {purchaseHistory.map((p) => (
              <Card key={p.id} className="cursor-pointer hover:shadow-md"
                onClick={() => { setActivePurchaseId(p.id); setActiveView("purchase-detail"); }}>
                <CardContent className="p-2.5 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{p.purchaseNo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p._count.items} items · {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">৳{p.totalAmount.toFixed(0)}</p>
                    <Badge variant="outline" className={cn(
                      "text-[9px]",
                      p.paymentStatus === "paid" ? "text-green-600" : "text-orange-600"
                    )}>
                      {p.paymentStatus}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment to {supplier.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {payError && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {payError}</p>}

            <Card className="bg-muted/30">
              <CardContent className="p-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-bold text-red-600">৳{summary.totalDue.toFixed(2)}</span>
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
                className="h-10"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
                className="h-10"
                placeholder="Txn ID, cheque no..."
              />
            </div>

            <Button className="w-full h-10 gap-2" onClick={handlePay} disabled={paying || !payAmount}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {paying ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
