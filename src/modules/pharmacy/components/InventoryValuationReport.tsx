"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, Boxes, DollarSign,
  TrendingUp, Percent, Wallet, Tag, ChevronDown, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface ValuationReport {
  generatedAt: string;
  summary: {
    totalProducts: number;
    totalBatches: number;
    totalQuantity: number;
    totalCostValue: number;
    totalMRPValue: number;
    totalPotentialProfit: number;
    averageMargin: number;
  };
  categories: Array<{ name: string; color: string; totalQuantity: number; costValue: number; mrpValue: number; productCount: number }>;
  products: Array<{
    productId: string;
    productName: string;
    genericName: string | null;
    strength: string | null;
    unit: string;
    manufacturer: string | null;
    category: { id: string; name: string; color: string } | null;
    totalQuantity: number;
    batchCount: number;
    costValue: number;
    mrpValue: number;
    potentialProfit: number;
    batches: Array<{ batchNo: string; quantity: number; expiryDate: string; status: string; purchasePrice: number | null; mrp: number | null; costValue: number; mrpValue: number }>;
  }>;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function InventoryValuationReport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [report, setReport] = useState<ValuationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/reports/inventory-valuation`);
      const data = await res.json();
      if (data.success) setReport(data.report);
    } catch (err) {
      console.error("Valuation fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleDownload = () => {
    if (businessId) window.open(`/api/businesses/${businessId}/reports/inventory-valuation?format=csv`, "_blank");
  };

  if (loading || !report) {
    return (
      <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SkeletonCard className="h-7 w-48" />
          <div className="flex-1" />
          <SkeletonCard className="h-9 w-9 rounded-lg" />
          <SkeletonCard className="h-9 w-9 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-64" />
      </motion.div>
    );
  }

  const { summary, categories, products } = report;
  const maxCostValue = Math.max(...categories.map((c) => c.costValue), 1);

  return (
    <motion.div {...fadeIn} className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Inventory Valuation</h1>
          <p className="text-[11px] text-muted-foreground">Cost &amp; MRP value of stock</p>
        </div>
        <Button variant="outline" size="icon" className="shadow-pharmacy" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="shadow-pharmacy" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards - 4 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="card-hover shadow-pharmacy border-l-4 border-l-blue-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Cost Value</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">৳{summary.totalCostValue.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{summary.totalProducts} products</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-emerald-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">MRP Value</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">৳{summary.totalMRPValue.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{summary.totalQuantity} units</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                <Tag className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-purple-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Potential Profit</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">৳{summary.totalPotentialProfit.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{summary.totalBatches} batches</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover shadow-pharmacy border-l-4 border-l-amber-500 stagger-in">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Avg Margin</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{summary.averageMargin.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Avg profit ratio</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                <Percent className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="card-hover shadow-pharmacy stagger-in">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold">By Category</h2>
          </div>
          <div className="space-y-3">
            {categories.slice(0, 8).map((cat) => {
              const pct = (cat.costValue / maxCostValue) * 100;
              return (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-0.5">{cat.productCount}</Badge>
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      Cost: <span className="font-semibold text-foreground">৳{cat.costValue.toFixed(0)}</span>
                      <span className="mx-1 opacity-40">·</span>
                      MRP: <span className="font-semibold text-emerald-600">৳{cat.mrpValue.toFixed(0)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Products List with expandable batches */}
      <Card className="card-hover shadow-pharmacy stagger-in overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-fuchsia-50 flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-600" />
            <p className="text-sm font-semibold text-purple-700">Products ({products.length})</p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto scrollbar-thin">
            {products.map((product) => {
              const expanded = expandedProduct === product.productId;
              return (
                <div key={product.productId}>
                  <button
                    className="card-hover w-full p-3.5 flex items-center gap-3 text-left transition-colors hover:bg-muted/30"
                    onClick={() => setExpandedProduct(expanded ? null : product.productId)}
                  >
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
                    >
                      <Boxes className="h-4 w-4" style={{ color: product.category?.color || "#6b7280" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{product.productName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {product.totalQuantity} {product.unit} · {product.batchCount} batch(es)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold">৳{product.costValue.toFixed(0)}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">+৳{product.potentialProfit.toFixed(0)}</p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <div className="bg-muted/30 p-3 space-y-1.5">
                      {product.batches.map((batch, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] py-1.5 px-2 bg-background rounded-lg border">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-foreground">{batch.batchNo}</span>
                            <span className="text-muted-foreground">
                              {batch.quantity} units · Exp: {new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                            </span>
                            <Badge variant="outline" className={cn(
                              "text-[8px] h-4 px-1.5",
                              batch.status === "active" && "text-emerald-600 border-emerald-200 bg-emerald-50",
                              batch.status === "near_expiry" && "text-amber-600 border-amber-200 bg-amber-50",
                              batch.status === "expired" && "text-rose-600 border-rose-200 bg-rose-50"
                            )}>
                              {batch.status}
                            </Badge>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <span className="text-blue-600">Cost: ৳{batch.costValue.toFixed(0)}</span>
                            <span className="text-emerald-600 font-semibold">MRP: ৳{batch.mrpValue.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons - gradient emerald */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <Button
          className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-pharmacy font-semibold gap-2"
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" /> Download CSV
        </Button>
        <Button
          className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-pharmacy font-semibold gap-2"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" /> Print Report
        </Button>
      </div>
    </motion.div>
  );
}
