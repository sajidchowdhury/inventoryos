"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, RefreshCw, DollarSign,
  CreditCard, Banknote, Smartphone, Receipt, Check, Loader2,
  ArrowDownLeft, ArrowUpRight, AlertCircle,
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
  cash: "from-emerald-400 to-emerald-600",
  card: "from-blue-400 to-blue-600",
  mobile_banking: "from-purple-400 to-purple-600",
  credit: "from-amber-400 to-amber-600",
  cheque: "from-cyan-400 to-cyan-600",
};

type PaymentFilter = "all" | "received" | "paid";

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
  const [filter, setFilter] = useState<PaymentFilter>("all");
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
    // All payments here are "received" (incoming from customer). Filter pills are visual.
    if (filter === "paid" && p.paymentMethod !== "credit" && p.paymentMethod !== "cheque") return false;
    if (filter === "received" && (p.paymentMethod === "credit" || p.paymentMethod === "cheque")) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.sale.invoiceNo.toLowerCase().includes(q) ||
      (p.customer?.name?.toLowerCase().includes(q) ?? false) ||
      p.paymentMethod.toLowerCase().includes(q) ||
      (p.reference?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalReceived = payments
    .filter((p) => p.paymentMethod !== "credit" && p.paymentMethod !== "cheque")
    .reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments
    .filter((p) => p.paymentMethod === "credit" || p.paymentMethod === "cheque")
    .reduce((s, p) => s + p.amount, 0);
  const net = totalReceived - totalPaid;

  const filterTabs: { value: PaymentFilter; label: string; activeClass: string }[] = [
    { value: "all", label: "All", activeClass: "bg-emerald-600 text-white" },
    { value: "received", label: "Received", activeClass: "bg-green-600 text-white" },
    { value: "paid", label: "Paid", activeClass: "bg-rose-500 text-white" },
  ];

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Payments</h1>
        <Button variant="ghost" size="icon" onClick={fetchPayments} disabled={loading} className="rounded-xl">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
          onClick={() => { setForm({ saleId: "", amount: "", paymentMethod: "cash", reference: "", notes: "" }); setError(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      {success && (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden border-l-4 border-l-emerald-500">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50">
            <Check className="h-4 w-4" /> {success}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 bg-gradient-to-br from-emerald-50 to-white">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-2 shadow-md shadow-emerald-500/20">
              <ArrowDownLeft className="h-4 w-4 text-white" />
            </div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Total Received</p>
            <p className="text-base font-bold text-emerald-600">৳{totalReceived.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.today.count} today</p>
          </CardContent>
        </Card>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 bg-gradient-to-br from-rose-50 to-white">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center mb-2 shadow-md shadow-rose-500/20">
              <ArrowUpRight className="h-4 w-4 text-white" />
            </div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Total Paid</p>
            <p className="text-base font-bold text-rose-600">৳{totalPaid.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">credit/cheque</p>
          </CardContent>
        </Card>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-3 bg-gradient-to-br from-blue-50 to-white">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2 shadow-md shadow-blue-500/20">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Net</p>
            <p className="text-base font-bold text-blue-600">৳{net.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.byMethod.length} methods</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="stagger-in relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
        <Input
          placeholder="Search by invoice, customer, method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-10 h-11 rounded-2xl border-emerald-200 bg-white shadow-pharmacy focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
        />
        {search && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg" onClick={() => setSearch("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Pills */}
      <div className="stagger-in flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 shadow-sm",
              filter === tab.value
                ? tab.activeClass
                : "bg-white text-muted-foreground hover:bg-muted border border-emerald-100"
            )}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-pharmacy border-0 overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-8 w-full rounded mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-10 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <DollarSign className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">No payments found</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {search || filter !== "all" ? "Try adjusting your filters or search" : "Record your first payment to get started"}
              </p>
            </div>
            {!search && filter === "all" && (
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Record Payment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((payment) => {
            const Icon = methodIcons[payment.paymentMethod] || DollarSign;
            const gradient = methodColors[payment.paymentMethod] || "from-slate-400 to-slate-600";
            const isPaid = payment.paymentMethod === "credit" || payment.paymentMethod === "cheque";
            return (
              <Card
                key={payment.id}
                className={cn(
                  "card-hover shadow-pharmacy border-0 overflow-hidden cursor-pointer border-l-4",
                  isPaid ? "border-l-rose-500" : "border-l-emerald-500"
                )}
                onClick={() => { setActiveSaleId(payment.sale.id); setActiveView("sale-detail"); }}
              >
                <CardContent className="p-3.5 flex items-start gap-3">
                  <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-md", gradient)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold font-mono truncate">{payment.sale.invoiceNo}</p>
                      <p className={cn("text-sm font-bold", isPaid ? "text-rose-600" : "text-emerald-600")}>
                        {isPaid ? "−" : "+"}৳{payment.amount.toFixed(2)}
                      </p>
                    </div>
                    {payment.customer && (
                      <p className="text-[10px] text-muted-foreground truncate">{payment.customer.name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] capitalize",
                          isPaid
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}
                      >
                        {isPaid ? "Paid" : "Received"} · {payment.paymentMethod.replace("_", " ")}
                      </Badge>
                      {payment.reference && <span className="text-[9px] text-muted-foreground font-mono">Ref: {payment.reference}</span>}
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
                className="h-10 rounded-xl"
              />
            </div>

            {saleInfo && (
              <Card className="shadow-pharmacy border-0 overflow-hidden">
                <CardContent className="p-2.5 space-y-1 text-xs bg-gradient-to-br from-emerald-50/50 to-white">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="font-medium font-mono">{saleInfo.invoiceNo}</span>
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
                    <span className="text-emerald-600">৳{saleInfo.paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-dashed">
                    <span className="font-medium">Due</span>
                    <span className="font-bold text-rose-600">৳{(saleInfo.totalAmount - saleInfo.paidAmount).toFixed(2)}</span>
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
                  className="h-10 rounded-xl"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
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
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[40px] text-sm rounded-xl"
                placeholder="Additional notes"
              />
            </div>

            <Button
              className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
              onClick={handleSave}
              disabled={saving || !form.saleId || !form.amount}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
