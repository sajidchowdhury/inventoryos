"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Bell, AlertTriangle, XCircle, ChevronRight, Pill, Calendar,
  RefreshCw, CheckCircle2, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface AlertItem {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
  valueAtRisk: number;
  status: string;
  severity: "expired" | "critical" | "warning";
  suggestedAction: string;
  product: {
    id: string;
    name: string;
    genericName: string | null;
    strength: string | null;
    manufacturer: string | null;
    unit: string;
    mrp: number | null;
    category: { name: string; color: string } | null;
  };
}

interface AlertsData {
  summary: {
    totalAlerts: number;
    expired: number;
    critical: number;
    warning: number;
    totalValueAtRisk: number;
  };
  groups: {
    expired: AlertItem[];
    critical: AlertItem[];
    warning: AlertItem[];
  };
}

// Status badge config — Expired (rose), Critical ≤7 days (rose), Warning ≤30 days (amber), Notice ≤90 days (blue)
const severityConfig = {
  expired: {
    icon: XCircle,
    gradient: "bg-gradient-to-br from-rose-400 to-rose-600",
    color: "text-rose-700",
    border: "border-l-rose-600",
    badge: "bg-rose-100 text-rose-700",
    label: "Expired",
    pulse: true,
  },
  critical: {
    icon: AlertTriangle,
    gradient: "bg-gradient-to-br from-rose-400 to-rose-600",
    color: "text-rose-600",
    border: "border-l-rose-500",
    badge: "bg-rose-50 text-rose-600",
    label: "Critical ≤7d",
    pulse: true,
  },
  warning: {
    icon: Clock,
    gradient: "bg-gradient-to-br from-amber-400 to-amber-600",
    color: "text-amber-600",
    border: "border-l-amber-500",
    badge: "bg-amber-50 text-amber-700",
    label: "Warning ≤30d",
    pulse: false,
  },
  notice: {
    icon: Clock,
    gradient: "bg-gradient-to-br from-blue-400 to-blue-600",
    color: "text-blue-600",
    border: "border-l-blue-500",
    badge: "bg-blue-50 text-blue-700",
    label: "Notice ≤90d",
    pulse: false,
  },
};

export function ExpiryAlertsWidget() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/expiry-alerts`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Expiry alerts fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Skeleton loader
  if (loading) {
    return (
      <Card className="shadow-pharmacy">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-28 rounded" />
            <div className="skeleton h-6 w-6 rounded" />
          </div>
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-14 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state — all clear with green checkmark
  if (!data || data.summary.totalAlerts === 0) {
    return (
      <Card className="shadow-pharmacy border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/60 to-emerald-50/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
              <Bell className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold flex-1">Expiry Alerts</h2>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">0</Badge>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">All clear!</p>
              <p className="text-xs text-muted-foreground">No expiring batches in the next 90 days</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, groups } = data;

  // Get top 3 most urgent (expired first, then critical)
  const topAlerts = [
    ...groups.expired.slice(0, 2),
    ...groups.critical.slice(0, 3 - Math.min(groups.expired.length, 2)),
  ].slice(0, 3);

  const handleAlertClick = (alert: AlertItem) => {
    setActiveProductId(alert.product.id);
    setActiveView("product-detail");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Header — bell icon + count badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-sm">
            <Bell className="h-3 w-3 text-white" />
          </div>
          Expiry Alerts
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px] px-1.5 h-5 animate-pulse-soft">
            {summary.totalAlerts}
          </Badge>
        </h2>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchAlerts}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-2">
        {summary.expired > 0 && (
          <div className="stagger-in rounded-lg border-l-4 border-l-rose-600 bg-rose-50/50 p-2 text-center">
            <p className="text-lg font-bold text-rose-700 leading-tight">{summary.expired}</p>
            <p className="text-[9px] text-muted-foreground">Expired</p>
          </div>
        )}
        {summary.critical > 0 && (
          <div className="stagger-in rounded-lg border-l-4 border-l-rose-500 bg-rose-50/30 p-2 text-center">
            <p className="text-lg font-bold text-rose-600 leading-tight">{summary.critical}</p>
            <p className="text-[9px] text-muted-foreground">Critical</p>
          </div>
        )}
        {summary.warning > 0 && (
          <div className="stagger-in rounded-lg border-l-4 border-l-amber-500 bg-amber-50/40 p-2 text-center">
            <p className="text-lg font-bold text-amber-600 leading-tight">{summary.warning}</p>
            <p className="text-[9px] text-muted-foreground">Warning</p>
          </div>
        )}
      </div>

      {/* Value at risk strip */}
      {summary.totalValueAtRisk > 0 && (
        <div className="stagger-in flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-50 to-rose-50 px-3 py-2 border border-amber-100">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600" /> Value at risk
          </span>
          <span className="text-sm font-bold text-rose-700">৳{summary.totalValueAtRisk.toFixed(2)}</span>
        </div>
      )}

      {/* Top Alerts — compact card-hover cards with colored left borders */}
      <div className="space-y-2">
        {topAlerts.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          return (
            <Card
              key={alert.batchId}
              className={cn(
                "stagger-in card-hover shadow-pharmacy border-l-4 cursor-pointer overflow-hidden",
                cfg.border
              )}
              onClick={() => handleAlertClick(alert)}
            >
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm", cfg.gradient)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {cfg.pulse && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse-soft shrink-0" />
                      )}
                      <p className="text-sm font-semibold truncate">{alert.product.name}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      <span className="font-mono">#{alert.batchNo}</span>
                      {alert.product.strength && ` · ${alert.product.strength}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                </div>
                <div className="flex items-center justify-between text-[10px] pl-10">
                  <span className="text-muted-foreground">
                    {alert.daysUntilExpiry < 0
                      ? `Expired ${Math.abs(alert.daysUntilExpiry)}d ago`
                      : `${alert.daysUntilExpiry}d left`}
                    {" · "}
                    {alert.quantity} {alert.product.unit}
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-medium", cfg.badge)}>
                    {cfg.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View All Link — navigate to expiry dashboard */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs gap-1 hover:bg-emerald-50 hover:text-emerald-700"
        onClick={() => setActiveView("expiry")}
      >
        {summary.totalAlerts > topAlerts.length
          ? `View all ${summary.totalAlerts} alerts`
          : "Open expiry dashboard"}
        <ChevronRight className="h-3 w-3" />
      </Button>
    </motion.div>
  );
}
