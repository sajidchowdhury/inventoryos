"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, X, RefreshCw, Package, Truck,
  Calendar, TrendingUp, Plus, ChevronRight,
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
  received: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  ordered: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentColors: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-orange-100 text-orange-700",
  unpaid: "bg-red-100 text-red-700",
};

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export function PurchaseList() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActivePurchaseId } = useNavStore();
  const businessId = session?.business?.id;

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState({ today: { count: 0, total: 0 }, month: { count: 0, total: 0 }, outstanding: { count: 0, dueAmount: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const filtered = purchases.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.purchaseNo.toLowerCase().includes(q) ||
      (p.supplier?.name?.toLowerCase().includes(q) ?? false) ||
      (p.invoiceNo?.toLowerCase().includes(q) ?? false) ||
      p.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  });

  const handlePurchaseClick = (purchaseId: string) => {
    setActivePurchaseId(purchaseId);
    setActiveView("purchase-detail");
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Purchases</h1>
        <Button variant="ghost" size="icon" onClick={fetchPurchases} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setActiveView("add-purchase")}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-2.5">
            <p className="text-[9px] text-muted-foreground">Today</p>
            <p className="text-base font-bold text-blue-600">৳{summary.today.total.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.today.count} purchase(s)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-2.5">
            <p className="text-[9px] text-muted-foreground">This Month</p>
            <p className="text-base font-bold text-purple-600">৳{summary.month.total.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.month.count} purchases</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-2.5">
            <p className="text-[9px] text-muted-foreground">Outstanding</p>
            <p className="text-base font-bold text-orange-600">৳{summary.outstanding.dueAmount.toFixed(0)}</p>
            <p className="text-[8px] text-muted-foreground">{summary.outstanding.count} unpaid</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO no, supplier, invoice..."
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
        <div className="space-y-2">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No purchases found</p>
            <Button size="sm" className="gap-1.5" onClick={() => setActiveView("add-purchase")}>
              <Plus className="h-3.5 w-3.5" /> Create Purchase
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((purchase) => (
            <Card key={purchase.id} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePurchaseClick(purchase.id)}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{purchase.purchaseNo}</p>
                      <Badge variant="outline" className={cn("text-[9px]", statusColors[purchase.status])}>
                        {purchase.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(purchase.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {purchase.supplier && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Truck className="h-2.5 w-2.5" /> {purchase.supplier.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">৳{purchase.totalAmount.toFixed(2)}</p>
                    {purchase.paymentStatus !== "paid" && purchase.status !== "cancelled" && (
                      <Badge variant="outline" className={cn("text-[9px]", paymentColors[purchase.paymentStatus])}>
                        {purchase.paymentStatus}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                  <span>{purchase.items.length} item(s)</span>
                  {purchase.invoiceNo && <span>Inv: {purchase.invoiceNo}</span>}
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
