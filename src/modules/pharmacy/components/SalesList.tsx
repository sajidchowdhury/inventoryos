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
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-blue-100 text-blue-700",
};

const paymentColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-orange-100 text-orange-700",
  unpaid: "bg-red-100 text-red-700",
  refunded: "bg-blue-100 text-blue-700",
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

  const filterTabs: { value: FilterTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "completed", label: "Completed" },
    { value: "partial", label: "Partial Pay" },
    { value: "unpaid", label: "Unpaid" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Sales</h1>
        <Button variant="ghost" size="icon" onClick={fetchSales} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setActiveView("dispense")}>
          <ShoppingCart className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Today&apos;s Sales</p>
            <p className="text-xl font-bold text-green-600">৳{summary.today.total.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.today.count} invoice(s)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">All-Time Total</p>
            <p className="text-xl font-bold text-blue-600">৳{summary.allTime.total.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.allTime.count} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice, customer, product..."
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

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              activeFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            onClick={() => { setActiveFilter(tab.value); setPage(1); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No sales found</p>
            <p className="text-sm text-muted-foreground">
              {search || activeFilter !== "all" ? "Try adjusting filters" : "Create your first sale to get started"}
            </p>
            {!search && activeFilter === "all" && (
              <Button size="sm" className="gap-1.5" onClick={() => setActiveView("dispense")}>
                <ShoppingCart className="h-3.5 w-3.5" /> New Sale
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((sale) => (
            <Card
              key={sale.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleSaleClick(sale.id)}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{sale.invoiceNo}</p>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", statusColors[sale.status])}>
                        {sale.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
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
                    <p className="text-sm font-bold">৳{sale.totalAmount.toFixed(2)}</p>
                    {sale.paymentStatus !== "paid" && sale.status === "completed" && (
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", paymentColors[sale.paymentStatus])}>
                        {sale.paymentStatus} (৳{(sale.totalAmount - sale.paidAmount).toFixed(0)} due)
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                  <span>{sale.itemCount} item(s) · {sale.totalQuantity} units</span>
                  <span className="capitalize">{sale.paymentMethod.replace("_", " ")}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
