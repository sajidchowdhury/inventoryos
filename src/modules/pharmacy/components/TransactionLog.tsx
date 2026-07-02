"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, History, Search, X, Filter,
  TrendingUp, TrendingDown, Trash2, ShoppingCart, Package,
  ShieldAlert, Unlock, RefreshCw, AlertTriangle, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  quantity: number;
  unitPrice: number | null;
  note: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    genericName: string | null;
    strength: string | null;
    unit: string;
    category: { name: string; color: string } | null;
  };
  batch: { id: string; batchNo: string; expiryDate: string } | null;
}

interface Summary {
  [key: string]: { count: number; totalQuantity: number };
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const txTypeConfig: Record<string, {
  icon: typeof TrendingUp;
  color: string;
  bg: string;
  sign: "+" | "-";
  label: string;
}> = {
  PURCHASE: { icon: Package, color: "text-green-600", bg: "bg-green-50", sign: "+", label: "Stock In" },
  STOCK_IN: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", sign: "+", label: "Stock In" },
  SALE: { icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", sign: "-", label: "Sale" },
  DISPENSE: { icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50", sign: "-", label: "Dispense" },
  STOCK_OUT: { icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50", sign: "-", label: "Stock Out" },
  ADJUSTMENT: { icon: RefreshCw, color: "text-blue-600", bg: "bg-blue-50", sign: "±", label: "Adjustment" },
  WASTE: { icon: Trash2, color: "text-red-600", bg: "bg-red-50", sign: "-", label: "Waste/Disposal" },
  RETURN: { icon: RefreshCw, color: "text-purple-600", bg: "bg-purple-50", sign: "+", label: "Return" },
  QUARANTINE: { icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-50", sign: "∓", label: "Quarantine" },
  RELEASE: { icon: Unlock, color: "text-green-600", bg: "bg-green-50", sign: "∓", label: "Release" },
};

const filterTypes = [
  { value: "all", label: "All Activity" },
  { value: "PURCHASE", label: "Stock In" },
  { value: "SALE", label: "Sales" },
  { value: "ADJUSTMENT", label: "Adjustments" },
  { value: "WASTE", label: "Disposals" },
  { value: "QUARANTINE", label: "Quarantine" },
];

export function TransactionLog() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTransactions = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("page", page.toString());
      params.set("limit", "30");

      const res = await fetch(`/api/businesses/${businessId}/transactions?${params}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || {});
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotal(data.pagination?.total ?? 0);
      }
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, typeFilter, page]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Filter by search (client-side, on already fetched page)
  const filtered = transactions.filter((tx) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tx.product.name.toLowerCase().includes(q) ||
      (tx.product.genericName?.toLowerCase().includes(q) ?? false) ||
      tx.type.toLowerCase().includes(q) ||
      (tx.note?.toLowerCase().includes(q) ?? false) ||
      (tx.batch?.batchNo.toLowerCase().includes(q) ?? false)
    );
  });

  const handleProductClick = (productId: string) => {
    setActiveProductId(productId);
    setActiveView("product-detail");
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Activity Log</h1>
        <Button variant="ghost" size="icon" onClick={fetchTransactions} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-2 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-green-600 mb-0.5" />
            <p className="text-base font-bold text-green-600">
              {(summary.STOCK_IN?.count || 0) + (summary.PURCHASE?.count || 0)}
            </p>
            <p className="text-[9px] text-muted-foreground">Stock In</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <ShoppingCart className="h-4 w-4 mx-auto text-blue-600 mb-0.5" />
            <p className="text-base font-bold text-blue-600">{summary.SALE?.count || 0}</p>
            <p className="text-[9px] text-muted-foreground">Sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <Trash2 className="h-4 w-4 mx-auto text-red-600 mb-0.5" />
            <p className="text-base font-bold text-red-600">{summary.WASTE?.count || 0}</p>
            <p className="text-[9px] text-muted-foreground">Disposals</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by product, batch, type, note..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-10"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Type Filter */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {filterTypes.map((ft) => (
          <button
            key={ft.value}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              typeFilter === ft.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            onClick={() => { setTypeFilter(ft.value); setPage(1); }}
          >
            {ft.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {loading ? "Loading..." : `${total} total transaction${total !== 1 ? "s" : ""}`}
      </p>

      {/* Transaction List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3 h-16" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <History className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No transactions found</p>
            <p className="text-sm text-muted-foreground">
              {search || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "Stock movements will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const cfg = txTypeConfig[tx.type] || txTypeConfig.ADJUSTMENT;
            const Icon = cfg.icon;
            const date = new Date(tx.createdAt);
            const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
            const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

            return (
              <Card
                key={tx.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleProductClick(tx.product.id)}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{tx.product.name}</p>
                      <span className={cn("text-sm font-bold shrink-0", cfg.color)}>
                        {cfg.sign}{tx.quantity} {tx.product.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {cfg.label}
                      </Badge>
                      {tx.batch && (
                        <span className="text-[10px] text-muted-foreground">
                          Batch #{tx.batch.batchNo}
                        </span>
                      )}
                    </div>
                    {tx.note && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{tx.note}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {dateStr} · {timeStr}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
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
