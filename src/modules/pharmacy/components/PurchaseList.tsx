"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, X, RefreshCw, Package, Truck,
  Calendar, Plus, ChevronRight, TrendingUp, Receipt, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Purchase {
  id: string;
  purchaseNo: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  invoiceNo: string | null;
  createdAt: string;
  supplier: { id: string; name: string; code: string | null } | null;
  items: { id: string; productName: string; quantity: number; unit: string; unitCost: number }[];
}

const statusColors: Record<string, string> = {
  received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  ordered: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const paymentColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
};

// Left border color per status
const statusBorder: Record<string, string> = {
  received: "border-l-emerald-500",
  draft: "border-l-amber-500",
  ordered: "border-l-blue-500",
  cancelled: "border-l-rose-500",
};

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type StatusFilter = "all" | "received" | "ordered" | "cancelled";

export function PurchaseList() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActivePurchaseId } = useNavStore();
  const businessId = session?.business?.id;

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState({ today: { count: 0, total: 0 }, month: { count: 0, total: 0 }, outstanding: { count: 0, dueAmount: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPurchases = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      const res = await fetch(`/api/businesses/${businessId}/purchases?${params}`);
      const data = await res.json();
      if (data.success) {
        setPurchases(data.purchases || []);
        setSummary(data.summary || { today: { count: 0, total: 0 }, month: { count: 0, total: 0 }, outstanding: { count: 0, dueAmount: 0 } });
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (err) {
      console.error("Fetch purchases error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, page]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const filtered = useMemo(() => {
    let list = purchases;
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.purchaseNo.toLowerCase().includes(q) ||
        (p.supplier?.name?.toLowerCase().includes(q) ?? false) ||
        (p.invoiceNo?.toLowerCase().includes(q) ?? false) ||
        p.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [purchases, search, statusFilter]);

  const handlePurchaseClick = (purchaseId: string) => {
    setActivePurchaseId(purchaseId);
    setActiveView("purchase-detail");
  };

  const filterTabs: { value: StatusFilter; label: string; activeClass: string }[] = [
    { value: "all", label: "All", activeClass: "bg-emerald-600 text-white" },
    { value: "received", label: "Received", activeClass: "bg-green-600 text-white" },
    { value: "ordered", label: "Ordered", activeClass: "bg-blue-600 text-white" },
    { value: "cancelled", label: "Cancelled", activeClass: "bg-rose-500 text-white" },
  ];

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Purchases</h1>
        <Button variant="ghost" size="icon" onClick={fetchPurchases} disabled={loading} className="rounded-xl">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
          onClick={() => setActiveView("add-purchase")}
        >
          <Plus className="h-4 w-4" /> New Purchase
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-2.5 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Receipt className="h-3 w-3 text-white" />
              </div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Today</p>
            </div>
            <p className="text-base font-bold text-blue-600">৳{summary.today.total.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.today.count} purchase(s)</p>
          </CardContent>
        </Card>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-2.5 bg-gradient-to-br from-purple-50 to-white">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-white" />
              </div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Month</p>
            </div>
            <p className="text-base font-bold text-purple-600">৳{summary.month.total.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.month.count} purchases</p>
          </CardContent>
        </Card>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-2.5 bg-gradient-to-br from-amber-50 to-white">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <AlertCircle className="h-3 w-3 text-white" />
              </div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">Due</p>
            </div>
            <p className="text-base font-bold text-orange-600">৳{summary.outstanding.dueAmount.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.outstanding.count} unpaid</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="stagger-in relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
        <Input
          placeholder="Search by PO no, supplier, invoice..."
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
              statusFilter === tab.value
                ? tab.activeClass
                : "bg-white text-muted-foreground hover:bg-muted border border-emerald-100"
            )}
            onClick={() => setStatusFilter(tab.value)}
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
              <Package className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">No purchases found</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {search || statusFilter !== "all" ? "Try adjusting your filters or search" : "Record your first purchase to get started"}
              </p>
            </div>
            {!search && statusFilter === "all" && (
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
                onClick={() => setActiveView("add-purchase")}
              >
                <Plus className="h-3.5 w-3.5" /> Create Purchase
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((purchase) => {
            const borderClass = statusBorder[purchase.status] || "border-l-slate-300";
            return (
              <Card
                key={purchase.id}
                className={cn(
                  "card-hover shadow-pharmacy border-0 overflow-hidden cursor-pointer border-l-4",
                  borderClass
                )}
                onClick={() => handlePurchaseClick(purchase.id)}
              >
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold font-mono tracking-tight">{purchase.purchaseNo}</p>
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", statusColors[purchase.status])}>
                          {purchase.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(purchase.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {purchase.supplier && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Truck className="h-2.5 w-2.5" /> {purchase.supplier.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">৳{purchase.totalAmount.toFixed(2)}</p>
                      {purchase.paymentStatus !== "paid" && purchase.status !== "cancelled" && (
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 mt-1", paymentColors[purchase.paymentStatus])}>
                          {purchase.paymentStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dashed text-[10px] text-muted-foreground">
                    <span>{purchase.items.length} item(s)</span>
                    <span className="flex items-center gap-1">
                      {purchase.invoiceNo && <span>Inv: {purchase.invoiceNo}</span>}
                      <ChevronRight className="h-3 w-3 text-emerald-500" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                className="shadow-pharmacy rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg bg-white shadow-pharmacy">
                Page <span className="font-semibold text-emerald-700">{page}</span> / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="shadow-pharmacy rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
