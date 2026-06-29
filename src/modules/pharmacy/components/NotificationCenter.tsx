"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, X, Check, AlertTriangle, Clock, ShieldAlert,
  TrendingDown, ChevronRight, CheckCheck, Sparkles, Info, BellOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface CategoryStyle {
  icon: typeof Bell;
  bg: string;
  text: string;
  ring: string;
  label: string;
}

const typeStyles: Record<string, CategoryStyle> = {
  expiry_expired: { icon: AlertTriangle, bg: "bg-rose-100", text: "text-rose-600", ring: "ring-rose-200", label: "Expiry" },
  expiry_critical: { icon: AlertTriangle, bg: "bg-rose-100", text: "text-rose-600", ring: "ring-rose-200", label: "Expiry" },
  expiry_warning: { icon: Clock, bg: "bg-amber-100", text: "text-amber-600", ring: "ring-amber-200", label: "Expiry" },
  expiry_notice: { icon: Clock, bg: "bg-amber-100", text: "text-amber-600", ring: "ring-amber-200", label: "Expiry" },
  low_stock: { icon: TrendingDown, bg: "bg-amber-100", text: "text-amber-600", ring: "ring-amber-200", label: "Stock" },
  quarantine: { icon: ShieldAlert, bg: "bg-rose-100", text: "text-rose-600", ring: "ring-rose-200", label: "Quarantine" },
  system: { icon: Info, bg: "bg-blue-100", text: "text-blue-600", ring: "ring-blue-200", label: "System" },
  ai: { icon: Sparkles, bg: "bg-purple-100", text: "text-purple-600", ring: "ring-purple-200", label: "AI" },
};

const severityDot: Record<string, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function dateBucket(dateStr: string): "today" | "yesterday" | "older" {
  const now = new Date();
  const date = new Date(dateStr);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const ts = date.getTime();
  if (ts >= startOfToday) return "today";
  if (ts >= startOfYesterday) return "yesterday";
  return "older";
}

const bucketLabels: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  older: "Earlier",
};

export function NotificationCenter() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/notifications?limit=20`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Notifications fetch error:", err);
    }
  }, [businessId]);

  // Initial fetch
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Poll every 60 seconds for new notifications
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchNotifications, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!businessId || unreadCount === 0) return;
    setLoading(true);
    try {
      await fetch(`/api/businesses/${businessId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      fetchNotifications();
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    // Mark as read
    if (!notif.isRead && businessId) {
      fetch(`/api/businesses/${businessId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notif.id] }),
      }).then(() => fetchNotifications());
    }

    // Navigate based on type
    if (notif.type.startsWith("expiry") || notif.type === "quarantine") {
      setActiveView("expiry");
    } else if (notif.type === "low_stock") {
      setActiveView("products");
    }
    setOpen(false);
  };

  // Group notifications into buckets
  const buckets: { today: Notification[]; yesterday: Notification[]; older: Notification[] } = {
    today: [],
    yesterday: [],
    older: [],
  };
  notifications.slice(0, 15).forEach((n) => {
    buckets[dateBucket(n.createdAt)].push(n);
  });
  const hasAny = buckets.today.length + buckets.yesterday.length + buckets.older.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-pharmacy transition-transform hover:scale-105 active:scale-95"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background animate-pulse-soft">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-96 p-0 glass border border-border/60 shadow-pharmacy-xl rounded-2xl overflow-hidden"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-emerald-50/60 to-teal-50/40">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Bell className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">Notifications</span>
              {unreadCount > 0 && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 rounded-full bg-rose-500 hover:bg-rose-500 text-white border-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
          </div>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] gap-1 hover:bg-emerald-100/60 hover:text-emerald-700"
              onClick={handleMarkAllRead}
              disabled={loading}
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          ) : (
            <button
              className="text-muted-foreground/60 hover:text-foreground transition-colors p-1 rounded-md"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[28rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="h-14 w-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                <BellOff className="h-7 w-7 text-emerald-500/60" />
              </div>
              <p className="text-sm font-semibold text-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground leading-snug">
                Alerts will appear here when stock is low or batches expire.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {(["today", "yesterday", "older"] as const).map((bucket) => {
                if (buckets[bucket].length === 0) return null;
                return (
                  <div key={bucket}>
                    <div className="px-4 py-1.5 bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {bucketLabels[bucket]}
                      </span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {buckets[bucket].map((notif) => {
                        const style = typeStyles[notif.type] || typeStyles.system;
                        const Icon = style.icon;
                        return (
                          <button
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={cn(
                              "w-full text-left px-4 py-2.5 hover:bg-emerald-50/50 transition-colors flex items-start gap-2.5 group relative",
                              !notif.isRead && "bg-emerald-50/30"
                            )}
                          >
                            {/* Unread indicator */}
                            <div className="absolute left-1 top-1/2 -translate-y-1/2">
                              {!notif.isRead && (
                                <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                              )}
                            </div>

                            <div className={cn(
                              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ring-1",
                              style.bg, style.text, style.ring
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <p className={cn(
                                  "text-xs truncate",
                                  notif.isRead ? "font-medium text-foreground" : "font-semibold text-foreground"
                                )}>
                                  {notif.title}
                                </p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={cn("h-1.5 w-1.5 rounded-full", severityDot[notif.severity] || "bg-slate-400")} />
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(notif.createdAt)}</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                                {notif.message}
                              </p>
                              <span className={cn(
                                "inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide",
                                style.bg, style.text, "opacity-80"
                              )}>
                                {style.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasAny && (
          <div className="border-t border-border/60 p-2 bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1.5 hover:bg-emerald-100/60 hover:text-emerald-700 font-medium"
              onClick={() => {
                setActiveView("alerts");
                setOpen(false);
              }}
            >
              View all alerts
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
