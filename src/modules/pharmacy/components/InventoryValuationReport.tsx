"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, Printer, Boxes, DollarSign,
  TrendingUp, Percent,
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
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("business-dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  const { summary, categories, products } = report;
  const maxCostValue = Math.max(...categories.map((c) => c.costValue), 1);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("business-dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Inventory Valuation</h1>
        <Button variant="outline" size="icon" onClick={handleDownload}><Download className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Cost Value</p>
            <p className="text-2xl font-bold text-blue-600">৳{summary.totalCostValue.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">{summary.totalProducts} products · {summary.totalBatches} batches</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total MRP Value</p>
            <p className="text-2xl font-bold text-green-600">৳{summary.totalMRPValue.toFixed(0)}</p>
            <p className="text-[9px] text-muted-foreground">{summary.totalQuantity} units in stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Potential Profit */}
      <Card className="border-l-4 border-l-emerald-500 bg-green-50/30">
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Potential Profit (if all sold at MRP)</p>
            <p className="text-2xl font-bold text-emerald-600">৳{summary.totalPotentialProfit.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Avg Margin</p>
            <p className="text-xl font-bold text-emerald-600">{summary.averageMargin.toFixed(1)}%</p>
          </div>
        </CardContent>
      </Card>

      {/* By Category */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">By Category</h2>
          <div className="space-y-2">
            {categories.slice(0, 8).map((cat) => {
              const pct = (cat.costValue / maxCostValue) * 100;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                      <span className="text-muted-foreground">({cat.productCount} products)</span>
                    </span>
                    <span className="text-muted-foreground">
                      Cost: ৳{cat.costValue.toFixed(0)} · MRP: ৳{cat.mrpValue.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2 border-b bg-muted/50">
            <p className="text-xs font-semibold">Products ({products.length})</p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div key={product.productId}>
                <button
                  className="w-full p-3 flex items-center gap-2 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedProduct(expandedProduct === product.productId ? null : product.productId)}
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
                  >
                    <Boxes className="h-4 w-4" style={{ color: product.category?.color || "#6b7280" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{product.productName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {product.totalQuantity} {product.unit} · {product.batchCount} batch(es)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold">৳{product.costValue.toFixed(0)}</p>
                    <p className="text-[10px] text-green-600">+৳{product.potentialProfit.toFixed(0)}</p>
                  </div>
                </button>
                {expandedProduct === product.productId && (
                  <div className="bg-muted/20 p-3 space-y-1">
                    {product.batches.map((batch, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] py-1 border-b last:border-0">
                        <div>
                          <span className="font-medium">{batch.batchNo}</span>
                          <span className="text-muted-foreground ml-2">
                            {batch.quantity} units · Exp: {new Date(batch.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                          </span>
                          <Badge variant="outline" className={cn(
                            "ml-1 text-[8px]",
                            batch.status === "active" && "text-green-600",
                            batch.status === "near_expiry" && "text-orange-600",
                            batch.status === "expired" && "text-red-600"
                          )}>
                            {batch.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <span>Cost: ৳{batch.costValue.toFixed(0)}</span>
                          <span className="text-green-600 ml-2">MRP: ৳{batch.mrpValue.toFixed(0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
