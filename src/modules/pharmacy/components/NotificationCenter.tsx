"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, X, Check, AlertTriangle, Clock, ShieldAlert,
  TrendingDown, ChevronRight, CheckCheck,
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

const typeIcons: Record<string, typeof Bell> = {
  expiry_expired: AlertTriangle,
  expiry_critical: AlertTriangle,
  expiry_warning: Clock,
  expiry_notice: Clock,
  low_stock: TrendingDown,
  quarantine: ShieldAlert,
};

const severityColors: Record<string, string> = {
  critical: "text-red-600 bg-red-50",
  warning: "text-orange-600 bg-orange-50",
  info: "text-blue-600 bg-blue-50",
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-muted transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleMarkAllRead}
              disabled={loading}
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                Alerts will appear here when stock is low or batches expire
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.slice(0, 15).map((notif) => {
                const Icon = typeIcons[notif.type] || Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-2",
                      !notif.isRead && "bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                      severityColors[notif.severity] || "bg-muted"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold truncate">{notif.title}</p>
                        {!notif.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1"
            onClick={() => {
              setActiveView("alerts");
              setOpen(false);
            }}
          >
            View all alerts
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
