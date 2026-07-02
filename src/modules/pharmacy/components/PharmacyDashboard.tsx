"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Package, AlertTriangle, TrendingUp,
  Check, Boxes, Receipt,
  Clock, Pill, Users, DollarSign, RotateCcw, Percent, BarChart3,
  Copy, Store,
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
  overstockCount: number;
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
    totalProducts: 0, lowStockCount: 0, expiringSoonCount: 0, overstockCount: 0, totalCategories: 0,
  });
  const [recentProducts, setRecentProducts] = useState<Array<{
    id: string; name: string; genericName: string | null; manufacturer: string | null;
    inventory: { quantity: number } | null;
    category: { name: string; color: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyShopCode = async () => {
    const code = session?.business?.shopCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silent fail
    }
  };

  const fetchDashboard = useCallback(async () => {
    if (!businessId) return;
    try {
      const [prodRes, catRes, dashRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/products?limit=5`),
        fetch(`/api/businesses/${businessId}/categories`),
        fetch(`/api/businesses/${businessId}/dashboard`),
      ]);
      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const dashData = await dashRes.json().catch(() => null);

      if (prodData.success) {
        const products = prodData.products || [];
        const totalProducts = prodData.pagination?.total ?? products.length;

        // Prefer the dashboard API's accurate counts when available; fall back
        // to the legacy product-list-based estimate otherwise.
        const lowStock = dashData?.inventory?.lowStockProducts
          ?? products.filter((p: { inventory: { quantity: number } | null }) => (p.inventory?.quantity ?? 0) <= 5).length;
        const expiringSoon = dashData?.expiry?.nearExpiryBatches ?? 0;
        const overstock = dashData?.inventory?.overstockProducts ?? 0;

        setStats({
          totalProducts,
          lowStockCount: lowStock,
          expiringSoonCount: expiringSoon,
          overstockCount: overstock,
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
      {/* HEADER BANNER — consolidated pharmacy name + shop code   */}
      {/* + notification bell, all in one full-width gradient     */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 stagger-in"
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" fill="white">
            <circle cx="70" cy="30" r="40" />
            <circle cx="30" cy="70" r="25" />
          </svg>
        </div>
        <div className="relative z-10 p-5 flex items-center justify-between gap-3">
          {/* Left: title + shop code badge */}
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-xl font-bold leading-tight">
              {session?.business?.name || "Pharmacy"}{" "}
              <span className="text-white/90 font-semibold">Inventory</span>
            </h1>
            {session?.business?.shopCode && (
              <button
                onClick={copyShopCode}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-medium transition-colors active:scale-95"
                title="Tap to copy shop code"
              >
                <Store className="h-3.5 w-3.5 shrink-0" />
                <span className="opacity-80">Shop code:</span>
                <span className="font-mono font-bold tracking-wider">{session.business.shopCode}</span>
                <span className="text-white/70 hidden sm:inline">· share with staff to log in</span>
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-200 shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 opacity-70 shrink-0" />
                )}
              </button>
            )}
          </div>
          {/* Right: notification bell */}
          <div className="shrink-0">
            <NotificationCenter />
          </div>
        </div>
        {/* Copied toast */}
        {copied && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 rounded-full bg-white text-emerald-700 text-[10px] font-semibold px-2.5 py-1 shadow-lg">
            Copied!
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 4-CARD STATS GRID — Products, Low Stock, Expiring, Overstock */}
      {/* Colored left borders, card-hover effect, NO financials   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

        {/* Overstock — indigo accent (Phase 3 P2 fix: surfaces Product.maxStock) */}
        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden stagger-in"
          style={{ animationDelay: "0.25s" }}
          onClick={() => setActiveView("products")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Boxes className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Overstock</span>
          </div>
          <p className={cn("text-2xl font-bold", stats.overstockCount > 0 ? "text-indigo-600" : "text-gray-900")}>
            {loading ? "—" : stats.overstockCount}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Above max level</p>
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
          onClick={() => setActiveView("products")}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Products</span>
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

        {/* Reports — goes to Business Dashboard with all reports */}
        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("business-dashboard")}
        >
          <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-sky-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Reports</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2ND ROW — Operations (moved from More hub)               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-3 stagger-in" style={{ animationDelay: "0.35s" }}>
        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("customers")}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Customers</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("payments")}
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-amber-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Payments</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("returns")}
        >
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-rose-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Returns</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("discount-rules")}
        >
          <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">
            <Percent className="h-5 w-5 text-orange-600" />
          </div>
          <span className="text-xs font-medium text-gray-700">Discount</span>
        </button>
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
