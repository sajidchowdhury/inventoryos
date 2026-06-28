"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, DollarSign, Clock,
  Receipt, CreditCard, TrendingDown, Phone, Wallet,
  Calendar, ShoppingBag, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface OutstandingSale {
  id: string;
  invoiceNo: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  itemCount: number;
  age: number;
  lastPayment: { amount: number; createdAt: string } | null;
}

interface CreditData {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    totalSpent: number;
    visitCount: number;
  };
  credit: {
    totalDue: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingSaleCount: number;
    oldestDueDays: number;
  };
  outstandingSales: OutstandingSale[];
  paymentHistory: { id: string; amount: number; method: string; invoiceNo: string; reference: string | null; createdAt: string }[];
  returnsHistory: { id: string; returnNo: string; refundAmount: number; refundMethod: string; reason: string; createdAt: string }[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

/** Build initials from a customer name (e.g., "Rahim Uddin" → "RU"). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CustomerCreditView() {
  const session = useAuthStore((s) => s.session);
  const { activeCustomerId, setActiveView, setActiveSaleId } = useNavStore();
  const businessId = session?.business?.id;

  const [data, setData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredit = useCallback(async () => {
    if (!businessId || !activeCustomerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/customers/${activeCustomerId}/credit`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Credit fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, activeCustomerId]);

  useEffect(() => { fetchCredit(); }, [fetchCredit]);

  if (loading) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen space-y-4 p-4 pb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50" onClick={() => setActiveView("customers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="overflow-hidden border-slate-200/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton h-14 w-14 rounded-full" />
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
              <CardContent className="p-3"><div className="skeleton h-12 rounded" /></CardContent>
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
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50" onClick={() => setActiveView("customers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Customer not found</h1>
        </div>
      </motion.div>
    );
  }

  const { customer, credit, outstandingSales, paymentHistory, returnsHistory } = data;
  const hasOutstanding = credit.totalDue > 0;

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen space-y-4 p-4 pb-6">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl hover:bg-emerald-50"
          onClick={() => setActiveView("customers")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Credit &amp; History</h1>
          <p className="text-[11px] text-muted-foreground">Customer payment &amp; transaction history</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50" onClick={fetchCredit}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Customer gradient header card */}
      <Card className="card-hover stagger-in overflow-hidden border-0 shadow-pharmacy-lg">
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
          <div className="relative flex items-center gap-3.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white backdrop-blur-sm ring-2 ring-white/30">
              {getInitials(customer.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white truncate">{customer.name}</p>
              {customer.phone && (
                <p className="text-xs text-emerald-50/90 flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </p>
              )}
              <p className="text-[11px] text-emerald-50/80 mt-0.5">
                {customer.visitCount} visit(s) · ৳{customer.totalSpent.toFixed(0)} lifetime
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Credit Summary — 3-card grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">Total Spent</p>
            <p className="text-sm font-bold text-emerald-700">৳{credit.totalInvoiced.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">Outstanding</p>
            <p className={cn("text-sm font-bold", hasOutstanding ? "text-rose-700" : "text-emerald-700")}>
              ৳{credit.totalDue.toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-3">
            <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 shadow-sm">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">Visit Count</p>
            <p className="text-sm font-bold text-sky-700">{customer.visitCount}</p>
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
                <p className="text-3xl font-bold text-rose-600">৳{credit.totalDue.toFixed(2)}</p>
              </div>
              {credit.oldestDueDays > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <Clock className="h-2.5 w-2.5" /> Oldest: {credit.oldestDueDays}d
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-[9px] text-muted-foreground">Invoiced</p>
                <p className="text-xs font-bold text-slate-700">৳{credit.totalInvoiced.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Paid</p>
                <p className="text-xs font-bold text-emerald-600">৳{credit.totalPaid.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Due</p>
                <p className="text-xs font-bold text-rose-600">৳{credit.totalDue.toFixed(0)}</p>
              </div>
            </div>
            <Button
              className="w-full gap-2 mt-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-pharmacy hover:from-emerald-600 hover:to-teal-700 border-0"
              size="sm"
              onClick={() => setActiveView("payments")}
            >
              <DollarSign className="h-4 w-4" /> Record Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Sales */}
      {outstandingSales.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-rose-500" />
              Outstanding Invoices
            </h2>
            <Badge className="bg-rose-50 text-rose-700 ring-1 ring-rose-200">{outstandingSales.length}</Badge>
          </div>
          {outstandingSales.map((sale) => (
            <Card
              key={sale.id}
              className="card-hover stagger-in cursor-pointer border-slate-200/70 shadow-pharmacy"
              onClick={() => { setActiveSaleId(sale.id); setActiveView("sale-detail"); }}
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 shrink-0">
                      <Receipt className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{sale.invoiceNo}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(sale.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {sale.age}d ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-rose-600">৳{sale.dueAmount.toFixed(2)}</p>
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700 ring-1 ring-rose-200">
                      Due
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Total</p>
                    <p className="text-[11px] font-bold text-slate-700">৳{sale.totalAmount.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Paid</p>
                    <p className="text-[11px] font-bold text-emerald-600">৳{sale.paidAmount.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Items</p>
                    <p className="text-[11px] font-bold text-slate-700">{sale.itemCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 px-1">
            <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Recent Payments
          </h2>
          {paymentHistory.map((p) => (
            <Card key={p.id} className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{p.invoiceNo}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {p.method.replace("_", " ")} · {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-600">+৳{p.amount.toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Returns History */}
      {returnsHistory.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 px-1">
            <TrendingDown className="h-3.5 w-3.5 text-amber-500" /> Recent Returns
          </h2>
          {returnsHistory.map((r) => (
            <Card key={r.id} className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                  <TrendingDown className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{r.returnNo}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {r.reason.replace("_", " ")} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <p className="text-sm font-bold text-rose-600">−৳{r.refundAmount.toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!hasOutstanding && paymentHistory.length === 0 && returnsHistory.length === 0 && (
        <Card className="card-hover stagger-in border-slate-200/70 shadow-pharmacy">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">No transactions yet</p>
              <p className="text-sm text-muted-foreground">This customer has no payment or return history</p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
