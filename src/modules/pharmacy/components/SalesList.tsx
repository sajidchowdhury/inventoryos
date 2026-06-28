"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, X, RefreshCw, Receipt, TrendingUp,
  Calendar, User, ShoppingCart, ChevronRight, Filter, Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Sale {
  id: string;
  invoiceNo: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  paidAmount: number;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  customer: { id: string; name: string; phone: string | null } | null;
  items: { id: string; productName: string; quantity: number; unit: string; unitPrice: number; totalPrice: number }[];
}

interface Summary {
  today: { count: number; total: number };
  allTime: { count: number; total: number };
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
  refunded: "bg-sky-100 text-sky-700 border-sky-200",
};

const paymentColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  unpaid: "bg-rose-100 text-rose-700 border-rose-200",
  refunded: "bg-sky-100 text-sky-700 border-sky-200",
};

// Left border color per payment status (for invoice cards)
const paymentBorder: Record<string, string> = {
  paid: "border-l-emerald-500",
  partial: "border-l-amber-500",
  unpaid: "border-l-rose-500",
  refunded: "border-l-sky-500",
};

type FilterTab = "all" | "completed" | "cancelled" | "partial" | "unpaid";

export function SalesList() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveSaleId } = useNavStore();
  const businessId = session?.business?.id;

  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary>({ today: { count: 0, total: 0 }, allTime: { count: 0, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSales = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter === "completed") params.set("status", "completed");
      else if (activeFilter === "cancelled") params.set("status", "cancelled");
      else if (activeFilter === "partial") params.set("paymentStatus", "partial");
      else if (activeFilter === "unpaid") params.set("paymentStatus", "unpaid");
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/businesses/${businessId}/sales?${params}`);
      const data = await res.json();
      if (data.success) {
        setSales(data.sales || []);
        setSummary(data.summary || { today: { count: 0, total: 0 }, allTime: { count: 0, total: 0 } });
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (err) {
      console.error("Fetch sales error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, activeFilter, page]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const filtered = sales.filter((sale) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      sale.invoiceNo.toLowerCase().includes(q) ||
      (sale.customer?.name?.toLowerCase().includes(q) ?? false) ||
      (sale.customer?.phone?.toLowerCase().includes(q) ?? false) ||
      sale.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  });

  const handleSaleClick = (saleId: string) => {
    setActiveSaleId(saleId);
    setActiveView("sale-detail");
  };

  const filterTabs: { value: FilterTab; label: string; activeClass: string }[] = [
    { value: "all", label: "All", activeClass: "bg-emerald-600 text-white" },
    { value: "completed", label: "Paid", activeClass: "bg-green-600 text-white" },
    { value: "partial", label: "Partial", activeClass: "bg-amber-500 text-white" },
    { value: "unpaid", label: "Unpaid", activeClass: "bg-rose-500 text-white" },
    { value: "cancelled", label: "Cancelled", activeClass: "bg-slate-500 text-white" },
  ];

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Sales</h1>
        <Button variant="ghost" size="icon" onClick={fetchSales} disabled={loading} className="rounded-xl">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
          onClick={() => setActiveView("dispense")}
        >
          <ShoppingCart className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Today&apos;s Sales</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">৳{summary.today.total.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.today.count} invoice(s)</p>
          </CardContent>
        </Card>
        <Card className="stagger-in shadow-pharmacy border-0 overflow-hidden">
          <CardContent className="p-4 bg-gradient-to-br from-teal-50 to-white">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <Receipt className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">All-Time Total</p>
            </div>
            <p className="text-xl font-bold text-teal-600">৳{summary.allTime.total.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.allTime.count} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="stagger-in relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
        <Input
          placeholder="Search by invoice, customer, product..."
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

      {/* Filter Tabs */}
      <div className="stagger-in flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 shadow-sm",
              activeFilter === tab.value
                ? tab.activeClass
                : "bg-white text-muted-foreground hover:bg-muted border border-emerald-100"
            )}
            onClick={() => { setActiveFilter(tab.value); setPage(1); }}
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
              <ShoppingCart className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">No sales found</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {search || activeFilter !== "all" ? "Try adjusting your filters or search" : "Create your first sale to get started"}
              </p>
            </div>
            {!search && activeFilter === "all" && (
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20 rounded-xl"
                onClick={() => setActiveView("dispense")}
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Create your first sale
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((sale) => {
            const borderClass = sale.status === "cancelled"
              ? "border-l-slate-400"
              : paymentBorder[sale.paymentStatus] || "border-l-emerald-500";
            return (
              <Card
                key={sale.id}
                className={cn(
                  "card-hover shadow-pharmacy border-0 overflow-hidden cursor-pointer border-l-4",
                  borderClass
                )}
                onClick={() => handleSaleClick(sale.id)}
              >
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold font-mono tracking-tight">{sale.invoiceNo}</p>
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", statusColors[sale.status])}>
                          {sale.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(sale.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {sale.customer && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-2.5 w-2.5" /> {sale.customer.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">৳{sale.totalAmount.toFixed(2)}</p>
                      {sale.paymentStatus !== "paid" && sale.status === "completed" && (
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 mt-1", paymentColors[sale.paymentStatus])}>
                          {sale.paymentStatus} (৳{(sale.totalAmount - sale.paidAmount).toFixed(0)} due)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dashed text-[10px] text-muted-foreground">
                    <span>{sale.itemCount} item(s) · {sale.totalQuantity} units</span>
                    <span className="flex items-center gap-1">
                      <span className="capitalize">{sale.paymentMethod.replace("_", " ")}</span>
                      <ChevronRight className="h-3 w-3 text-emerald-500" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
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
