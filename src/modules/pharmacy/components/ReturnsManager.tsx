"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, RefreshCw, RotateCcw,
  AlertCircle, Check, Loader2, Receipt, Calendar, User,
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface ReturnItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  product: { name: string; unit: string };
}

interface ReturnRecord {
  id: string;
  returnNo: string;
  status: string;
  refundAmount: number;
  refundMethod: string;
  restockItems: boolean;
  reason: string;
  notes: string | null;
  createdAt: string;
  sale: { id: string; invoiceNo: string };
  customer: { id: string; name: string } | null;
  items: ReturnItem[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const reasonLabels: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong Item",
  expired: "Expired",
  customer_changed_mind: "Changed Mind",
  other: "Other",
};

export function ReturnsManager() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveSaleId, activeSaleId } = useNavStore();
  const businessId = session?.business?.id;

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [summary, setSummary] = useState({ today: { count: 0, refund: 0 }, month: { count: 0, refund: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    saleId: activeSaleId || "",
    reason: "",
    refundMethod: "cash",
    restockItems: true,
    notes: "",
  });
  const [saleItems, setSaleItems] = useState<Array<{ id: string; productName: string; quantity: number; unit: string; unitPrice: number }>>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});

  const fetchReturns = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/returns?limit=50`);
      const data = await res.json();
      if (data.success) {
        setReturns(data.returns || []);
        setSummary(data.summary || { today: { count: 0, refund: 0 }, month: { count: 0, refund: 0 } });
      }
    } catch (err) {
      console.error("Fetch returns error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  // Fetch sale items when saleId changes
  useEffect(() => {
    if (!businessId || !form.saleId) {
      setSaleItems([]);
      setReturnQtys({});
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/sales/${form.saleId}`);
        const data = await res.json();
        if (data.success) {
          setSaleItems(data.sale.items.map((item: { id: string; productName: string; quantity: number; unit: string; unitPrice: number }) => ({
            id: item.id,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
          })));
        } else {
          setSaleItems([]);
        }
      } catch {
        setSaleItems([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [businessId, form.saleId]);

  const totalRefund = saleItems.reduce((sum, item) => {
    const qty = parseFloat(returnQtys[item.id] || "0") || 0;
    return sum + qty * item.unitPrice;
  }, 0);

  const handleSave = async () => {
    if (!businessId || !form.saleId || !form.reason) {
      setError("Sale ID and reason are required");
      return;
    }
    const items = saleItems
      .map((item) => ({
        saleItemId: item.id,
        quantity: parseFloat(returnQtys[item.id] || "0") || 0,
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setError("Select at least one item to return with quantity > 0");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: form.saleId,
          items,
          reason: form.reason,
          refundMethod: form.refundMethod,
          restockItems: form.restockItems,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`Return ${data.return?.returnNo} processed — Refund: ৳${data.return?.refundAmount.toFixed(2)}`);
      setDialogOpen(false);
      setForm({ saleId: "", reason: "", refundMethod: "cash", restockItems: true, notes: "" });
      setReturnQtys({});
      setSaleItems([]);
      fetchReturns();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process return");
    } finally {
      setSaving(false);
    }
  };

  const filtered = returns.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.returnNo.toLowerCase().includes(q) ||
      r.sale.invoiceNo.toLowerCase().includes(q) ||
      (r.customer?.name?.toLowerCase().includes(q) ?? false) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Returns &amp; Refunds</h1>
        <Button variant="ghost" size="icon" onClick={fetchReturns} disabled={loading} className="rounded-xl">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
          onClick={() => { setForm({ saleId: activeSaleId || "", reason: "", refundMethod: "cash", restockItems: true, notes: "" }); setError(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4" /> Process Return
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
      <div className="grid grid-cols-2 gap-3">
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 bg-gradient-to-br from-amber-50 to-white">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                <RotateCcw className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Today&apos;s Returns</p>
            </div>
            <p className="text-xl font-bold text-amber-600">৳{summary.today.refund.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.today.count} return(s)</p>
          </CardContent>
        </Card>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 bg-gradient-to-br from-rose-50 to-white">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-md shadow-rose-500/20">
                <Receipt className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">This Month</p>
            </div>
            <p className="text-xl font-bold text-rose-600">৳{summary.month.refund.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.month.count} return(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="stagger-in relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
        <Input
          placeholder="Search by return no, invoice, customer..."
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
              <RotateCcw className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">No returns found</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {search ? "Try adjusting your search" : "Process your first return to get started"}
              </p>
            </div>
            {!search && (
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Process Return
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((ret) => {
            const isCompleted = ret.status === "completed";
            return (
              <Card
                key={ret.id}
                className={cn(
                  "card-hover shadow-pharmacy border-0 overflow-hidden cursor-pointer border-l-4",
                  isCompleted ? "border-l-emerald-500" : "border-l-amber-500"
                )}
                onClick={() => { setActiveSaleId(ret.sale.id); setActiveView("sale-detail"); }}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold font-mono tracking-tight">{ret.returnNo}</p>
                        <Badge variant="outline" className={cn("text-[9px]", isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                          {isCompleted ? "Completed" : "Pending"}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                          {reasonLabels[ret.reason] || ret.reason}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Receipt className="h-2.5 w-2.5" /> For {ret.sale.invoiceNo}
                      </p>
                      {ret.customer && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="h-2.5 w-2.5" /> {ret.customer.name}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-rose-600 shrink-0">−৳{ret.refundAmount.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground pt-2 border-t border-dashed">
                    <Badge variant="secondary" className="text-[9px] capitalize">{ret.refundMethod.replace("_", " ")}</Badge>
                    {ret.restockItems && <span className="text-emerald-600 flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> Restocked</span>}
                    <span className="ml-auto flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(ret.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {ret.items.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {ret.items.map((item, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          {item.productName} ({item.quantity})
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Process Return Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Process Return</DialogTitle></DialogHeader>
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

            {saleItems.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Items to Return</Label>
                {saleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Sold: {item.quantity} · ৳{item.unitPrice.toFixed(2)}/unit
                      </p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={returnQtys[item.id] || ""}
                      onChange={(e) => setReturnQtys({ ...returnQtys, [item.id]: e.target.value })}
                      className="h-8 w-16 text-xs rounded-lg"
                      max={item.quantity}
                    />
                  </div>
                ))}
                {totalRefund > 0 && (
                  <div className="bg-gradient-to-r from-rose-50 to-rose-100/50 rounded-xl p-2.5 flex items-center justify-between">
                    <span className="text-xs text-rose-700 font-medium">Total Refund</span>
                    <span className="font-bold text-rose-600">৳{totalRefund.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Refund Method</Label>
              <Select value={form.refundMethod} onValueChange={(v) => setForm({ ...form, refundMethod: v })}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Store Credit</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-1 px-2 rounded-xl bg-emerald-50/50">
              <Label className="text-xs font-medium">Restock items to inventory</Label>
              <Switch
                checked={form.restockItems}
                onCheckedChange={(v) => setForm({ ...form, restockItems: v })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[40px] text-sm rounded-xl"
                placeholder="Additional details"
              />
            </div>

            <Button
              className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
              onClick={handleSave}
              disabled={saving || !form.saleId || !form.reason || totalRefund <= 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {saving ? "Processing..." : `Process Return (৳${totalRefund.toFixed(2)})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
