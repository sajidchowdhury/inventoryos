"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Bell, AlertTriangle, Clock,
  TrendingDown, ShieldAlert, Check, Settings, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string | null;
  productName?: string;
  batchNo?: string;
  quantity?: number;
  unit?: string;
  valueAtRisk?: number;
  valueHeld?: number;
  daysUntilExpiry?: number;
  category?: { name: string; color: string } | null;
  createdAt: string;
}

interface AlertsData {
  preferences: {
    expiryCriticalDays: number;
    expiryWarningDays: number;
    expiryNoticeDays: number;
    lowStockThreshold: number;
  };
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    byType: Record<string, number>;
    totalValueAtRisk: number;
  };
  alerts: Alert[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const severityConfig = {
  critical: { color: "text-red-600", bg: "bg-red-50", border: "border-l-red-500", icon: AlertTriangle },
  warning: { color: "text-orange-600", bg: "bg-orange-50", border: "border-l-orange-500", icon: Clock },
  info: { color: "text-blue-600", bg: "bg-blue-50", border: "border-l-blue-500", icon: Bell },
};

const typeIcons: Record<string, typeof Bell> = {
  low_stock: TrendingDown,
  expiry_expired: AlertTriangle,
  expiry_critical: AlertTriangle,
  expiry_warning: Clock,
  expiry_notice: Clock,
  quarantine: ShieldAlert,
};

type SeverityFilter = "all" | "critical" | "warning" | "info";

export function AlertsCenter() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const fetchAlerts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/combined-alerts`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Alerts fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleAlertClick = (alert: Alert) => {
    if (alert.entityType === "product") {
      if (alert.entityId) {
        setActiveProductId(alert.entityId);
        setActiveView("product-detail");
      }
    } else if (alert.entityType === "batch") {
      setActiveView("expiry");
    }
  };

  const filteredAlerts = data?.alerts.filter(
    (a) => filter === "all" || a.severity === filter
  ) || [];

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Alerts Center</h1>
        <Button variant="ghost" size="icon" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setActiveView("alert-settings")}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {data && (
        <>
          {/* Summary Hero Card */}
          <Card className={cn(
            "border-l-4",
            data.summary.critical > 0 ? "border-l-red-500 bg-red-50/30" : "border-l-green-500 bg-green-50/30"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Active Alerts</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    data.summary.critical > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {data.summary.total}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Value at Risk</p>
                  <p className="text-lg font-bold text-foreground">
                    ৳{data.summary.totalValueAtRisk.toFixed(0)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-3 text-[10px]">
                <span className="text-red-600">● {data.summary.critical} critical</span>
                <span className="text-orange-600">● {data.summary.warning} warning</span>
                <span className="text-blue-600">● {data.summary.info} notice</span>
              </div>
            </CardContent>
          </Card>

          {/* Type Breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveView("expiry")}>
              <CardContent className="p-3 text-center">
                <AlertTriangle className="h-4 w-4 mx-auto text-red-600 mb-1" />
                <p className="text-base font-bold text-red-600">
                  {(data.summary.byType.expiry_expired || 0) + (data.summary.byType.expiry_critical || 0)}
                </p>
                <p className="text-[9px] text-muted-foreground">Expiry Critical</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveView("expiry")}>
              <CardContent className="p-3 text-center">
                <Clock className="h-4 w-4 mx-auto text-orange-600 mb-1" />
                <p className="text-base font-bold text-orange-600">
                  {(data.summary.byType.expiry_warning || 0) + (data.summary.byType.expiry_notice || 0)}
                </p>
                <p className="text-[9px] text-muted-foreground">Expiry Soon</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md" onClick={() => setActiveView("products")}>
              <CardContent className="p-3 text-center">
                <TrendingDown className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                <p className="text-base font-bold text-blue-600">
                  {data.summary.byType.low_stock || 0}
                </p>
                <p className="text-[9px] text-muted-foreground">Low Stock</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            {(["all", "critical", "warning", "info"] as SeverityFilter[]).map((f) => (
              <button
                key={f}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                  filter === f
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setFilter(f)}
              >
                {f} {f !== "all" && `(${data.summary[f] || 0})`}
              </button>
            ))}
          </div>

          {/* Alerts List */}
          {filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <Check className="h-12 w-12 mx-auto text-green-600/50" />
                <p className="font-medium">All clear!</p>
                <p className="text-sm text-muted-foreground">
                  No {filter !== "all" ? `${filter} ` : ""}alerts at this time
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((alert) => {
                const cfg = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
                const Icon = typeIcons[alert.type] || Bell;
                return (
                  <Card
                    key={alert.id}
                    className={cn("border-l-4 cursor-pointer hover:shadow-md transition-shadow", cfg.border)}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <CardContent className="p-3 flex items-start gap-2">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cfg.bg)}>
                        <Icon className={cn("h-4 w-4", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{alert.title}</p>
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {alert.message}
                        </p>
                        {alert.valueAtRisk && alert.valueAtRisk > 0 && (
                          <p className="text-[10px] mt-1">
                            <span className="text-muted-foreground">Value at risk: </span>
                            <span className="font-semibold text-red-600">৳{alert.valueAtRisk.toFixed(0)}</span>
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" className="gap-2" onClick={() => setActiveView("report")}>
              <Bell className="h-4 w-4" /> Generate Report
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setActiveView("alert-settings")}>
              <Settings className="h-4 w-4" /> Alert Settings
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
