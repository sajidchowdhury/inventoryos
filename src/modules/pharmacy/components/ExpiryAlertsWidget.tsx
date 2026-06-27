"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock, AlertTriangle, XCircle, ChevronRight, Pill, Calendar,
  RefreshCw,
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

const severityConfig = {
  expired: {
    icon: XCircle,
    color: "text-red-700",
    bg: "bg-red-100",
    border: "border-l-red-600",
    label: "Expired",
  },
  critical: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-l-red-500",
    label: "Critical (<30d)",
  },
  warning: {
    icon: Clock,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-l-orange-500",
    label: "Warning (<90d)",
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

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4 h-32" />
      </Card>
    );
  }

  if (!data || data.summary.totalAlerts === 0) {
    return (
      <Card className="border-l-4 border-l-green-500 bg-green-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-700">All Clear!</p>
            <p className="text-xs text-muted-foreground">No batches expiring in the next 90 days</p>
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4" /> Expiry Alerts
        </h2>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={fetchAlerts}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Summary Pills */}
      <div className="grid grid-cols-3 gap-2">
        {summary.expired > 0 && (
          <Card className="border-l-4 border-l-red-600">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-red-600">{summary.expired}</p>
              <p className="text-[9px] text-muted-foreground">Expired</p>
            </CardContent>
          </Card>
        )}
        {summary.critical > 0 && (
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-red-500">{summary.critical}</p>
              <p className="text-[9px] text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
        )}
        {summary.warning > 0 && (
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-2 text-center">
              <p className="text-lg font-bold text-orange-500">{summary.warning}</p>
              <p className="text-[9px] text-muted-foreground">Warning</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Value at Risk */}
      {summary.totalValueAtRisk > 0 && (
        <Card className="bg-orange-50/50">
          <CardContent className="p-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Value at risk</span>
            <span className="text-sm font-bold text-orange-700">৳{summary.totalValueAtRisk.toFixed(2)}</span>
          </CardContent>
        </Card>
      )}

      {/* Top Alerts */}
      <div className="space-y-2">
        {topAlerts.map((alert) => {
          const cfg = severityConfig[alert.severity];
          const Icon = cfg.icon;
          return (
            <Card
              key={alert.batchId}
              className={cn("border-l-4 cursor-pointer hover:shadow-md transition-shadow", cfg.border)}
              onClick={() => handleAlertClick(alert)}
            >
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{alert.product.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Batch #{alert.batchNo}
                      {alert.product.strength && ` · ${alert.product.strength}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="flex items-center justify-between text-[10px] pl-10">
                  <span className="text-muted-foreground">
                    {alert.daysUntilExpiry < 0
                      ? `Expired ${Math.abs(alert.daysUntilExpiry)}d ago`
                      : `${alert.daysUntilExpiry}d left`}
                    {" · "}
                    {alert.quantity} {alert.product.unit}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {cfg.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View All Link — always show, navigate to expiry dashboard */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs gap-1"
        onClick={() => setActiveView("expiry")}
      >
        {summary.totalAlerts > topAlerts.length
          ? `View all ${summary.totalAlerts} alerts`
          : "Open expiry dashboard"}
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
