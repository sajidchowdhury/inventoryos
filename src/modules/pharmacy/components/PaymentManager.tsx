"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, RefreshCw, DollarSign,
  CreditCard, Banknote, Smartphone, Receipt, Clock,
  AlertCircle, Check, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  sale: { id: string; invoiceNo: string; totalAmount: number; paidAmount: number };
  customer: { id: string; name: string; phone: string | null } | null;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const methodIcons: Record<string, typeof DollarSign> = {
  cash: Banknote,
  card: CreditCard,
  mobile_banking: Smartphone,
  credit: Receipt,
  cheque: Receipt,
};

const methodColors: Record<string, string> = {
  cash: "text-green-600 bg-green-50",
  card: "text-blue-600 bg-blue-50",
  mobile_banking: "text-purple-600 bg-purple-50",
  credit: "text-orange-600 bg-orange-50",
  cheque: "text-cyan-600 bg-cyan-50",
};

export function PaymentManager() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveSaleId, saleCustomerId } = useNavStore();
  const businessId = session?.business?.id;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<{ today: { count: number; total: number }; byMethod: { method: string; total: number; count: number }[] }>({
    today: { count: 0, total: 0 },
    byMethod: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    saleId: "",
    amount: "",
    paymentMethod: "cash",
    reference: "",
    notes: "",
  });
  const [saleInfo, setSaleInfo] = useState<{ invoiceNo: string; totalAmount: number; paidAmount: number; customerName: string | null } | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (saleCustomerId) params.set("customerId", saleCustomerId);
      params.set("limit", "50");
      const res = await fetch(`/api/businesses/${businessId}/payments?${params}`);
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments || []);
        setSummary(data.summary || { today: { count: 0, total: 0 }, byMethod: [] });
      }
    } catch (err) {
      console.error("Fetch payments error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, saleCustomerId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // When saleId changes in form, fetch sale info
  useEffect(() => {
    if (!businessId || !form.saleId) {
      setSaleInfo(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/sales/${form.saleId}`);
        const data = await res.json();
        if (data.success) {
          const sale = data.sale;
          setSaleInfo({
            invoiceNo: sale.invoiceNo,
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount,
            customerName: sale.customer?.name || null,
          });
          // Auto-fill amount with due
          const due = sale.totalAmount - sale.paidAmount;
          if (due > 0) setForm((p) => ({ ...p, amount: due.toFixed(2) }));
        } else {
          setSaleInfo(null);
        }
      } catch {
        setSaleInfo(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [businessId, form.saleId]);

  const handleSave = async () => {
    if (!businessId || !form.saleId || !form.amount) {
      setError("Sale ID and amount are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: form.saleId,
          amount: parseFloat(form.amount),
          paymentMethod: form.paymentMethod,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`Payment of ৳${parseFloat(form.amount).toFixed(2)} recorded for ${data.sale?.paymentStatus === "paid" ? "PAID IN FULL" : "partial"}`);
      setDialogOpen(false);
      setForm({ saleId: "", amount: "", paymentMethod: "cash", reference: "", notes: "" });
      setSaleInfo(null);
      fetchPayments();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.sale.invoiceNo.toLowerCase().includes(q) ||
      (p.customer?.name?.toLowerCase().includes(q) ?? false) ||
      p.paymentMethod.toLowerCase().includes(q) ||
      (p.reference?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Payments</h1>
        <Button variant="ghost" size="icon" onClick={fetchPayments} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => { setForm({ saleId: "", amount: "", paymentMethod: "cash", reference: "", notes: "" }); setError(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Record
        </Button>
      </div>

      {success && (
        <Card className="border-green-500/50 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> {success}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Today&apos;s Payments</p>
            <p className="text-xl font-bold text-green-600">৳{summary.today.total.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.today.count} payment(s)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground">By Method (30d)</p>
            {summary.byMethod.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data</p>
            ) : (
              summary.byMethod.slice(0, 3).map((m) => (
                <div key={m.method} className="flex items-center justify-between text-[10px]">
                  <span className="capitalize">{m.method.replace("_", " ")}</span>
                  <span className="font-medium">৳{m.total.toFixed(0)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice, customer, method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {search && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No payments found</p>
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Record Payment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((payment) => {
            const Icon = methodIcons[payment.paymentMethod] || DollarSign;
            const color = methodColors[payment.paymentMethod] || "bg-muted text-muted-foreground";
            return (
              <Card key={payment.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { setActiveSaleId(payment.sale.id); setActiveView("sale-detail"); }}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{payment.sale.invoiceNo}</p>
                      <p className="text-sm font-bold text-green-600">+৳{payment.amount.toFixed(2)}</p>
                    </div>
                    {payment.customer && (
                      <p className="text-[10px] text-muted-foreground">{payment.customer.name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] capitalize">{payment.paymentMethod.replace("_", " ")}</Badge>
                      {payment.reference && <span className="text-[9px] text-muted-foreground">Ref: {payment.reference}</span>}
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {new Date(payment.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {error && <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sale Invoice No or ID *</Label>
              <Input
                value={form.saleId}
                onChange={(e) => setForm({ ...form, saleId: e.target.value })}
                placeholder="INV-2026-0001 or sale ID"
                className="h-10"
              />
            </div>

            {saleInfo && (
              <Card className="bg-muted/30">
                <CardContent className="p-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="font-medium">{saleInfo.invoiceNo}</span>
                  </div>
                  {saleInfo.customerName && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{saleInfo.customerName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span>৳{saleInfo.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-green-600">৳{saleInfo.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="font-medium">Due</span>
                    <span className="font-bold text-red-600">৳{(saleInfo.totalAmount - saleInfo.paidAmount).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="h-10"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reference (optional)</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="Txn ID, card last 4, cheque no"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[40px] text-sm"
                placeholder="Additional notes"
              />
            </div>

            <Button className="w-full h-10 gap-2" onClick={handleSave} disabled={saving || !form.saleId || !form.amount}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
