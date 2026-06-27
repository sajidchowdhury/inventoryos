"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Package, AlertTriangle, TrendingUp,
  Sparkles, ChevronRight, Clock, DollarSign,
  Boxes, Receipt,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { ExpiryAlertsWidget } from "./ExpiryAlertsWidget";
import { NotificationCenter } from "./NotificationCenter";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  expiringSoonCount: number;
  totalCategories: number;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export function PharmacyDashboard() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView } = useNavStore();
  const businessId = session?.business?.id;

  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0, lowStockCount: 0, expiringSoonCount: 0, totalCategories: 0,
  });
  const [todaySales, setTodaySales] = useState({ total: 0, count: 0 });
  const [recentProducts, setRecentProducts] = useState<Array<{ id: string; name: string; genericName: string | null; manufacturer: string | null; inventory: { quantity: number } | null; category: { name: string; color: string } | null }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!businessId) return;
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/products?limit=5`),
        fetch(`/api/businesses/${businessId}/categories`),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();

      if (prodData.success) {
        const products = prodData.products || [];
        const totalProducts = prodData.pagination?.total ?? products.length;
        const lowStock = products.filter((p: { inventory: { quantity: number } | null }) => (p.inventory?.quantity ?? 0) <= 5).length;

        setStats({
          totalProducts,
          lowStockCount: lowStock,
          expiringSoonCount: 0,
          totalCategories: catData.allCategories?.length ?? 0,
        });
        setRecentProducts(products);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{session?.business?.name || "Pharmacy"}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <NotificationCenter />
      </div>

      {/* ── PRIMARY CTA ── */}
      <Button
        size="lg"
        className="w-full h-14 gap-2 text-base shadow-md"
        onClick={() => setActiveView("dispense")}
      >
        <ShoppingCart className="h-5 w-5" />
        New Sale
      </Button>

      {/* ── TODAY'S SNAPSHOT ── */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-2.5">
            <p className="text-[9px] text-muted-foreground">Products</p>
            <p className="text-lg font-bold text-green-600">
              {loading ? "—" : stats.totalProducts}
            </p>
          </CardContent>
        </Card>
        <Card className={cn("border-l-4", stats.lowStockCount > 0 ? "border-l-orange-500" : "border-l-blue-500")}>
          <CardContent className="p-2.5">
            <p className="text-[9px] text-muted-foreground">Low Stock</p>
            <p className={cn("text-lg font-bold", stats.lowStockCount > 0 ? "text-orange-600" : "text-blue-600")}>
              {loading ? "—" : stats.lowStockCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-2.5">
            <p className="text-[9px] text-muted-foreground">Categories</p>
            <p className="text-lg font-bold text-purple-600">
              {loading ? "—" : stats.totalCategories}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── QUICK ACTIONS (max 4) ── */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]" onClick={() => setActiveView("products")}>
          <CardContent className="p-2.5 flex flex-col items-center gap-1 text-center">
            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-[9px] font-medium">Products</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]" onClick={() => setActiveView("add-purchase")}>
          <CardContent className="p-2.5 flex flex-col items-center gap-1 text-center">
            <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
              <Boxes className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-[9px] font-medium">Restock</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]" onClick={() => setActiveView("sales")}>
          <CardContent className="p-2.5 flex flex-col items-center gap-1 text-center">
            <div className="h-9 w-9 rounded-full bg-purple-50 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-[9px] font-medium">Invoices</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97] border-2 border-primary/20" onClick={() => setActiveView("ai-insights")}>
          <CardContent className="p-2.5 flex flex-col items-center gap-1 text-center">
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-[9px] font-bold text-primary">AI</span>
          </CardContent>
        </Card>
      </div>

      {/* ── ALERTS ── */}
      <ExpiryAlertsWidget />

      {/* ── RECENT PRODUCTS ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent Products</h2>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setActiveView("products")}>
            View All <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        {loading ? (
          <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">Loading...</CardContent></Card>
        ) : recentProducts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No products yet</p>
              <Button size="sm" className="gap-1.5" onClick={() => setActiveView("add-product")}>
                Add your first product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentProducts.map((product) => (
              <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { useNavStore.getState().setActiveProductId(product.id); setActiveView("product-detail"); }}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}>
                    <Package className="h-4 w-4" style={{ color: product.category?.color || "#6b7280" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.genericName || product.manufacturer || "No details"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-sm font-semibold",
                      (product.inventory?.quantity ?? 0) <= 0 ? "text-red-600" :
                      (product.inventory?.quantity ?? 0) <= 5 ? "text-orange-600" : "text-green-600"
                    )}>
                      {product.inventory?.quantity ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">in stock</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
