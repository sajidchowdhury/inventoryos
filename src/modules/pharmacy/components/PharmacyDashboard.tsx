"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Package, AlertTriangle, TrendingUp,
  Sparkles, ChevronRight, Check, Plus, Boxes, Receipt,
  Bell, Pill, Clock,
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
  const [recentProducts, setRecentProducts] = useState<Array<{
    id: string; name: string; genericName: string | null; manufacturer: string | null;
    inventory: { quantity: number } | null;
    category: { name: string; color: string } | null;
  }>>([]);
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
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HEADER — Pharmacy name + date + notification bell        */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between stagger-in">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{session?.business?.name || "Pharmacy"}</h1>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <NotificationCenter />
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* WELCOME BANNER — Gradient with status badges             */}
      {/* NO financial data — only system status                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 p-5 shadow-lg shadow-emerald-500/20 stagger-in"
        style={{ animationDelay: "0.05s" }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
          <svg viewBox="0 0 100 100" fill="white">
            <circle cx="70" cy="30" r="40" />
            <circle cx="30" cy="70" r="25" />
          </svg>
        </div>
        <div className="relative z-10">
          <p className="text-white/80 text-sm mb-1">Welcome back,</p>
          <h2 className="text-white text-xl font-bold mb-3">Your Pharmacy Inventory</h2>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium">
              <Check className="h-3.5 w-3.5" />
              All systems running
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium">
              <Clock className="h-3.5 w-3.5" />
              Last updated: {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 3-CARD STATS GRID — Products, Low Stock, Expiring Soon   */}
      {/* Colored left borders, card-hover effect, NO financials   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total Products — blue accent */}
        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden stagger-in"
          style={{ animationDelay: "0.10s" }}
          onClick={() => setActiveView("products")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Products</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? "—" : stats.totalProducts}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{stats.totalCategories} categories</p>
        </div>

        {/* Low Stock — amber accent */}
        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden stagger-in"
          style={{ animationDelay: "0.15s" }}
          onClick={() => setActiveView("products")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Low Stock</span>
          </div>
          <p className={cn("text-2xl font-bold", stats.lowStockCount > 0 ? "text-amber-600" : "text-gray-900")}>
            {loading ? "—" : stats.lowStockCount}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Need restock</p>
        </div>

        {/* Expiring Soon — rose accent */}
        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden stagger-in"
          style={{ animationDelay: "0.20s" }}
          onClick={() => setActiveView("expiry")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Expiring</span>
          </div>
          <p className={cn("text-2xl font-bold", stats.expiringSoonCount > 0 ? "text-rose-600" : "text-gray-900")}>
            {loading ? "—" : stats.expiringSoonCount}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Within 30 days</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PRIMARY CTA — New Sale button                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Button
        size="lg"
        className="w-full h-14 gap-2 text-base shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-2xl stagger-in"
        style={{ animationDelay: "0.25s" }}
        onClick={() => setActiveView("dispense")}
      >
        <ShoppingCart className="h-5 w-5" />
        New Sale
      </Button>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* QUICK ACTIONS — 4-grid with colorful icons               */}
      {/* AI button gets special purple gradient                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-3 stagger-in" style={{ animationDelay: "0.30s" }}>
        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("add-product")}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Plus className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Add Product</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("add-purchase")}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
            <Boxes className="h-5 w-5 text-amber-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Restock</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("sales")}
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-emerald-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Invoices</span>
        </button>

        {/* AI button — special purple gradient */}
        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 shadow-pharmacy border-2 border-purple-200 relative overflow-hidden"
          onClick={() => setActiveView("ai-hub")}
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xs font-bold text-purple-700">AI Hub</span>
          {/* Sparkle glow */}
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* AI QUICK ACCESS — Premium purple gradient card           */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 p-4 shadow-lg shadow-purple-500/20 stagger-in"
        style={{ animationDelay: "0.35s" }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
          <Sparkles className="w-full h-full text-white" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center animate-pulse-soft shrink-0">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white text-sm font-bold">AI-Powered Insights</h3>
            <p className="text-white/80 text-xs">Get instant business analysis & recommendations</p>
          </div>
          <Button
            size="sm"
            className="bg-white text-purple-700 hover:bg-white/90 font-semibold gap-1 shrink-0"
            onClick={() => setActiveView("ai-insights")}
          >
            Launch
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* INVENTORY HEALTH CARD — pulse animation                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="bg-white rounded-2xl p-5 shadow-pharmacy border-l-4 border-emerald-500 stagger-in"
        style={{ animationDelay: "0.40s" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 animate-pulse-soft">
            <Check className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 text-sm">Inventory Health is Good</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {stats.lowStockCount === 0
                ? "All products are well-stocked. No critical alerts."
                : `${stats.lowStockCount} product(s) need restocking. Check the Stock tab.`}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* EXPIRY ALERTS WIDGET                                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="stagger-in" style={{ animationDelay: "0.45s" }}>
        <ExpiryAlertsWidget />
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* RECENT STOCK UPDATES — Product list with status badges   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="stagger-in" style={{ animationDelay: "0.50s" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Recent Products</h3>
          <button
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            onClick={() => setActiveView("products")}
          >
            View All →
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-pharmacy">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 rounded skeleton" />
                    <div className="h-2 w-1/3 rounded skeleton" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recentProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-pharmacy text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto">
              <Package className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500">No products yet</p>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setActiveView("add-product")}>
              <Plus className="h-3.5 w-3.5" />
              Add your first product
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentProducts.map((product, idx) => {
              const qty = product.inventory?.quantity ?? 0;
              const status = qty <= 0
                ? { label: "Out of stock", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-l-rose-400" }
                : qty <= 5
                ? { label: `${qty} left`, bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-l-amber-400" }
                : { label: `${qty} in stock`, bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "" };

              return (
                <div
                  key={product.id}
                  className={cn(
                    "card-hover bg-white rounded-2xl p-4 shadow-pharmacy flex items-center gap-3 cursor-pointer",
                    status.border && `border-l-4 ${status.border}`
                  )}
                  onClick={() => { useNavStore.getState().setActiveProductId(product.id); setActiveView("product-detail"); }}
                >
                  {/* Category icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
                  >
                    <Pill className="h-5 w-5" style={{ color: product.category?.color || "#6b7280" }} />
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {product.genericName || product.manufacturer || "No details"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
                      status.bg, status.text
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Brain icon (inline since lucide doesn't export it in all versions) ──
function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}
