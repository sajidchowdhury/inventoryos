"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Search, X, RefreshCw, RotateCcw,
  AlertCircle, Check, Loader2, Package, Receipt,
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
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Returns &amp; Refunds</h1>
        <Button variant="ghost" size="icon" onClick={fetchReturns} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => { setForm({ saleId: activeSaleId || "", reason: "", refundMethod: "cash", restockItems: true, notes: "" }); setError(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Process
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
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Today&apos;s Returns</p>
            <p className="text-xl font-bold text-orange-600">৳{summary.today.refund.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.today.count} return(s)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">This Month</p>
            <p className="text-xl font-bold text-red-600">৳{summary.month.refund.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.month.count} return(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by return no, invoice, customer..."
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
            <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No returns found</p>
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Process Return
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ret) => (
            <Card key={ret.id} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setActiveSaleId(ret.sale.id); setActiveView("sale-detail"); }}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{ret.returnNo}</p>
                      <Badge variant="outline" className="text-[9px]">{reasonLabels[ret.reason] || ret.reason}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      For {ret.sale.invoiceNo} · {ret.customer?.name || "Walk-in"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600">−৳{ret.refundAmount.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[9px] capitalize">{ret.refundMethod.replace("_", " ")}</Badge>
                  {ret.restockItems && <span className="text-green-600">✓ Restocked</span>}
                  <span className="ml-auto">
                    {new Date(ret.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {ret.items.length > 0 && (
                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
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
          ))}
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
                className="h-10"
              />
            </div>

            {saleItems.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Items to Return</Label>
                {saleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border">
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
                      className="h-8 w-16 text-xs"
                      max={item.quantity}
                    />
                  </div>
                ))}
                {totalRefund > 0 && (
                  <div className="bg-red-50 rounded-lg p-2 flex items-center justify-between text-xs">
                    <span className="text-red-700">Total Refund</span>
                    <span className="font-bold text-red-700">৳{totalRefund.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
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
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Store Credit</SelectItem>
                  <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-1">
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
                className="min-h-[40px] text-sm"
                placeholder="Additional details"
              />
            </div>

            <Button className="w-full h-10 gap-2" onClick={handleSave} disabled={saving || !form.saleId || !form.reason || totalRefund <= 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {saving ? "Processing..." : `Process Return (৳${totalRefund.toFixed(2)})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
