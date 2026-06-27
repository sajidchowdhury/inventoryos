"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, DollarSign, AlertCircle, Clock,
  Receipt, CreditCard, TrendingDown, Phone, User,
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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("customers")}><ArrowLeft className="h-5 w-5" /></Button>
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
          <Button variant="ghost" size="icon" onClick={() => setActiveView("customers")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Customer not found</h1>
        </div>
      </motion.div>
    );
  }

  const { customer, credit, outstandingSales, paymentHistory, returnsHistory } = data;
  const hasOutstanding = credit.totalDue > 0;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("customers")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Credit &amp; History</h1>
        <Button variant="ghost" size="icon" onClick={fetchCredit}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Customer Card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold">{customer.name}</p>
            {customer.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {customer.phone}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {customer.visitCount} visit(s) · ৳{customer.totalSpent.toFixed(0)} lifetime
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Credit Summary */}
      <Card className={cn("border-l-4", hasOutstanding ? "border-l-red-500 bg-red-50/30" : "border-l-green-500 bg-green-50/30")}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className={cn("text-3xl font-bold", hasOutstanding ? "text-red-600" : "text-green-600")}>
                ৳{credit.totalDue.toFixed(2)}
              </p>
            </div>
            {hasOutstanding && credit.oldestDueDays > 0 && (
              <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                Oldest: {credit.oldestDueDays}d
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div>
              <p className="text-[9px] text-muted-foreground">Invoiced</p>
              <p className="text-sm font-bold">৳{credit.totalInvoiced.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Paid</p>
              <p className="text-sm font-bold text-green-600">৳{credit.totalPaid.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Due</p>
              <p className="text-sm font-bold text-red-600">৳{credit.totalDue.toFixed(0)}</p>
            </div>
          </div>
          {hasOutstanding && (
            <Button className="w-full gap-2" size="sm" onClick={() => setActiveView("payments")}>
              <DollarSign className="h-4 w-4" /> Record Payment
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Sales */}
      {outstandingSales.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
            Outstanding Invoices ({outstandingSales.length})
          </h2>
          <div className="space-y-2">
            {outstandingSales.map((sale) => (
              <Card key={sale.id} className="cursor-pointer hover:shadow-md"
                onClick={() => { setActiveSaleId(sale.id); setActiveView("sale-detail"); }}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">{sale.invoiceNo}</p>
                    <p className="text-sm font-bold text-red-600">৳{sale.dueAmount.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{sale.itemCount} item(s)</span>
                    <span>{new Date(sale.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {sale.age}d ago</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t">
                    <span className="text-muted-foreground">Total: ৳{sale.totalAmount.toFixed(0)}</span>
                    <span className="text-green-600">Paid: ৳{sale.paidAmount.toFixed(0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent Payments</h2>
          <div className="space-y-1">
            {paymentHistory.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-2.5 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                    <CreditCard className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{p.invoiceNo}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {p.method.replace("_", " ")} · {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-green-600">+৳{p.amount.toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Returns History */}
      {returnsHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent Returns</h2>
          <div className="space-y-1">
            {returnsHistory.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-2.5 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                    <TrendingDown className="h-3.5 w-3.5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{r.returnNo}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {r.reason.replace("_", " ")} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600">−৳{r.refundAmount.toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasOutstanding && paymentHistory.length === 0 && returnsHistory.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No transactions yet</p>
            <p className="text-sm text-muted-foreground">This customer has no payment or return history</p>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
