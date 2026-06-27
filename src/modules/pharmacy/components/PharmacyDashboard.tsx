"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Package, AlertTriangle, TrendingUp, Clock, Plus,
  ChevronRight, Pill, ShoppingBag, BarChart3, Boxes, ShoppingCart, History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { ExpiryAlertsWidget } from "./ExpiryAlertsWidget";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  expiringSoonCount: number;
  totalCategories: number;
}

interface RecentProduct {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  category: { name: string; color: string } | null;
  inventory: { quantity: number } | null;
  batches: { id: string; expiryDate: string }[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export function PharmacyDashboard() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0, lowStockCount: 0, expiringSoonCount: 0, totalCategories: 0,
  });
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const businessId = session?.business?.id;

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
        const products = prodData.products;
        const totalProducts = prodData.pagination?.total ?? products.length;

        // Count low stock items
        const lowStock = products.filter(
          (p: RecentProduct) => (p.inventory?.quantity ?? 0) <= 5
        ).length;

        // Count items expiring in 90 days
        const now = new Date();
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        let expiringSoon = 0;
        products.forEach((p: RecentProduct) => {
          p.batches?.forEach((b: { expiryDate: string }) => {
            if (new Date(b.expiryDate) <= ninetyDays) expiringSoon++;
          });
        });

        setStats({
          totalProducts,
          lowStockCount: lowStock,
          expiringSoonCount: expiringSoon,
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

  const statCards = [
    {
      label: "Products",
      value: stats.totalProducts,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
      onClick: () => setActiveView("products"),
    },
    {
      label: "Low Stock",
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
      onClick: () => setActiveView("products"),
    },
    {
      label: "Expiring Soon",
      value: stats.expiringSoonCount,
      icon: Clock,
      color: "text-red-600",
      bg: "bg-red-50",
      onClick: () => setActiveView("batches"),
    },
    {
      label: "Categories",
      value: stats.totalCategories,
      icon: ShoppingBag,
      color: "text-purple-600",
      bg: "bg-purple-50",
      onClick: () => setActiveView("categories"),
    },
  ];

  return (
    <motion.div {...fadeIn} className="space-y-5 pb-4">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{session?.business?.name || "Pharmacy"}</h1>
          <p className="text-sm text-muted-foreground">Welcome back! Here is your inventory overview.</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setActiveView("add-product")}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Primary Dispense CTA */}
      <Button
        size="lg"
        className="w-full h-14 gap-2 text-base shadow-md"
        onClick={() => setActiveView("dispense")}
      >
        <ShoppingCart className="h-5 w-5" />
        Quick Dispense
        <span className="ml-1 text-xs opacity-80">FEFO</span>
      </Button>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            onClick={card.onClick}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", card.color)}>
                  {loading ? "—" : card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-2">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
            onClick={() => setActiveView("add-product")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
              <div className="h-9 w-9 rounded-full bg-green-50 flex items-center justify-center">
                <Plus className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Add Product</span>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
            onClick={() => setActiveView("products")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
              <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center">
                <Pill className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Products</span>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
            onClick={() => setActiveView("batches")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
              <div className="h-9 w-9 rounded-full bg-orange-50 flex items-center justify-center">
                <Boxes className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Stock</span>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
            onClick={() => setActiveView("categories")}
          >
            <CardContent className="p-3 flex flex-col items-center gap-1.5 text-center">
              <div className="h-9 w-9 rounded-full bg-purple-50 flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-[11px] font-medium leading-tight">Categories</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Products */}
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
                <Plus className="h-3.5 w-3.5" /> Add your first product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="p-3 flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
                  >
                    <Pill
                      className="h-4 w-4"
                      style={{ color: product.category?.color || "#6b7280" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.genericName || product.manufacturer || "No details"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">
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

      {/* Expiry Alerts Widget */}
      <ExpiryAlertsWidget />

      {/* Activity Log Link */}
      <Button
        variant="outline"
        className="w-full gap-2 h-11"
        onClick={() => setActiveView("transactions")}
      >
        <History className="h-4 w-4" /> View Activity Log
        <ChevronRight className="h-4 w-4 ml-auto" />
      </Button>
    </motion.div>
  );
}
