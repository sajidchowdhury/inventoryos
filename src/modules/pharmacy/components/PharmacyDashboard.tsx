"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Package, AlertTriangle, TrendingUp,
  Check, Boxes,
  Clock, Users, DollarSign, RotateCcw, BarChart3,
  Copy, Store, ShoppingBag, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { ExpiryAlertsWidget } from "./ExpiryAlertsWidget";
import { NotificationCenter } from "./NotificationCenter";

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
      // clipboard unavailable
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
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  return (
    <motion.div {...fadeIn} className="space-y-5">

      {/* ═══════════════════════════════════════
          HEADER BANNER
      ═══════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" fill="white">
            <circle cx="70" cy="30" r="40" />
            <circle cx="30" cy="70" r="25" />
          </svg>
        </div>
        <div className="relative z-10 p-5 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-xl font-bold leading-tight">
              {session?.business?.name || "Pharmacy"}{" "}
              <span className="text-white/80 font-medium text-base">Inventory</span>
            </h1>
            {session?.business?.shopCode && (
              <button
                onClick={copyShopCode}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-medium transition-colors active:scale-95"
                title="Tap to copy shop code"
              >
                <Store className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono font-bold tracking-wider">{session.business.shopCode}</span>
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-200 shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 opacity-70 shrink-0" />
                )}
              </button>
            )}
          </div>
          <div className="shrink-0">
            <NotificationCenter />
          </div>
        </div>
        {copied && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 rounded-full bg-white text-emerald-700 text-[10px] font-semibold px-2.5 py-1 shadow-lg">
            Copied!
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          4 REPORT SHORTCUTS
      ═══════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden"
          onClick={() => setActiveView("analytics")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Sales</span>
          </div>
          <p className="text-xs font-semibold text-gray-700">Sales Analytics</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Trends & top products</p>
        </div>

        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden"
          onClick={() => setActiveView("expiry")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Expiry</span>
          </div>
          <p className="text-xs font-semibold text-gray-700">Expiry Report</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Track expiring stock</p>
        </div>

        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden"
          onClick={() => setActiveView("reports-hub")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Inventory</span>
          </div>
          <p className="text-xs font-semibold text-gray-700">Inventory Report</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Stock valuation & status</p>
        </div>

        <div
          className="card-hover bg-white rounded-2xl p-4 shadow-pharmacy relative overflow-hidden"
          onClick={() => setActiveView("profit-loss")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Finance</span>
          </div>
          <p className="text-xs font-semibold text-gray-700">Profit & Loss</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Revenue vs COGS</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          NEW SALE CTA
      ═══════════════════════════════════════ */}
      <Button
        size="lg"
        className="w-full h-14 gap-2 text-base shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 rounded-2xl"
        onClick={() => setActiveView("dispense")}
      >
        <ShoppingCart className="h-5 w-5" />
        New Sale
      </Button>

      {/* ═══════════════════════════════════════
          QUICK ACTIONS — 8-grid
      ═══════════════════════════════════════ */}
      <div className="grid grid-cols-4 gap-3">
        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("products")}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Products</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("add-purchase")}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Boxes className="h-5 w-5 text-amber-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Restock</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("returns")}
        >
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-rose-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Return</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("reports-hub")}
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-sky-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Reports</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("customers")}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Customers</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("payments")}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-amber-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Payment</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("purchases")}
        >
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-orange-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Purchase</span>
        </button>

        <button
          className="card-hover flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-pharmacy"
          onClick={() => setActiveView("suppliers")}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Truck className="h-5 w-5 text-purple-600" />
          </div>
          <span className="text-[11px] font-medium text-gray-700">Supplier</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════
          INVENTORY HEALTH CARD
      ═══════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-5 shadow-pharmacy border-l-4 border-emerald-500">
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

      {/* ═══════════════════════════════════════
          EXPIRY ALERTS
      ═══════════════════════════════════════ */}
      <ExpiryAlertsWidget />
    </motion.div>
  );
}