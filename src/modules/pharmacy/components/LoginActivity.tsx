"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Clock, User, Check, X,
  LogIn, AlertTriangle, Monitor, Smartphone, Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface LoginEvent {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
  deviceInfo: string;
  loginAt: string;
  isActive: boolean;
}

interface UserLoginStatus {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
  daysSinceLogin: number | null;
}

interface ActivityData {
  summary: {
    totalUsers: number;
    activeUsers: number;
    neverLoggedIn: number;
    loginsToday: number;
    loginsThisWeek: number;
    activeSessions: number;
  };
  recentLogins: LoginEvent[];
  userLoginStatus: UserLoginStatus[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type FilterPill = "all" | "success" | "failed";

function getDeviceIcon(deviceStr: string): { icon: typeof Monitor; label: string } {
  if (!deviceStr || deviceStr === "Unknown") return { icon: Monitor, label: "Unknown device" };
  const isMobile = /mobile|android|iphone|ipad/i.test(deviceStr);
  const browser = /chrome/i.test(deviceStr) ? "Chrome" : /firefox/i.test(deviceStr) ? "Firefox" : /safari/i.test(deviceStr) ? "Safari" : "Browser";
  const os = /windows/i.test(deviceStr) ? "Windows" : /mac/i.test(deviceStr) ? "macOS" : /linux/i.test(deviceStr) ? "Linux" : /android/i.test(deviceStr) ? "Android" : /ios|iphone|ipad/i.test(deviceStr) ? "iOS" : "Unknown OS";
  return {
    icon: isMobile ? Smartphone : Monitor,
    label: `${browser} on ${os}`,
  };
}

export function LoginActivity() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;
  const [filter, setFilter] = useState<FilterPill>("all");

  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/login-activity`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error("Login activity fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered logins — "success" = active session, "failed" = expired session
  const filteredLogins = useMemo(() => {
    if (!data) return [];
    const all = data.recentLogins;
    if (filter === "success") return all.filter((e) => e.isActive);
    if (filter === "failed") return all.filter((e) => !e.isActive);
    return all;
  }, [data, filter]);

  // Summary counts derived from existing data
  const totalLogins = data?.summary.loginsThisWeek ?? 0;
  const failedAttempts = data ? data.recentLogins.filter((e) => !e.isActive).length : 0;

  if (loading || !data) {
    return (
      <motion.div
        {...fadeIn}
        className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("users")} className="shadow-pharmacy">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <Card key={i} className="border-0 shadow-pharmacy">
              <CardContent className="p-4 h-24 skeleton rounded-xl" />
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-pharmacy">
              <CardContent className="p-4 h-16 skeleton rounded-xl" />
            </Card>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...fadeIn}
      className="pharmacy-bg min-h-screen -mx-4 -my-4 px-4 py-4 space-y-4 pb-6"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy" onClick={() => setActiveView("users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Login Activity</h1>
          <p className="text-[11px] text-muted-foreground">Track user sign-ins</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} className="shadow-pharmacy">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Summary Cards — 2-card grid ── */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="card-hover shadow-pharmacy border-0 overflow-hidden stagger-in">
          <CardContent className="p-3 space-y-1.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <LogIn className="h-4 w-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 leading-none">{totalLogins}</p>
            <p className="text-[10px] text-muted-foreground">Total Logins (week)</p>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy border-0 overflow-hidden stagger-in">
          <CardContent className="p-3 space-y-1.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <p className="text-2xl font-bold text-rose-600 leading-none">{failedAttempts}</p>
            <p className="text-[10px] text-muted-foreground">Failed Attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter pills ── */}
      <div className="flex items-center gap-2">
        {([
          { key: "all" as const,     label: "All",     cls: "bg-emerald-500 text-white" },
          { key: "success" as const, label: "Success", cls: "bg-green-500 text-white" },
          { key: "failed" as const,  label: "Failed",  cls: "bg-rose-500 text-white" },
        ]).map((pill) => (
          <button
            key={pill.key}
            onClick={() => setFilter(pill.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
              filter === pill.key
                ? cn(pill.cls, "shadow-md")
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {pill.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {filteredLogins.length} event(s)
        </span>
      </div>

      {/* ── Activity list ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Recent Activity
        </h2>
        {filteredLogins.length === 0 ? (
          <Card className="shadow-pharmacy border-0">
            <CardContent className="p-8 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-sm">No events</p>
              <p className="text-xs text-muted-foreground">Try a different filter</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {filteredLogins.slice(0, 15).map((event) => {
              const device = getDeviceIcon(event.deviceInfo);
              const isSuccess = event.isActive;
              return (
                <Card
                  key={event.id}
                  className={cn(
                    "card-hover shadow-pharmacy border-0 overflow-hidden stagger-in",
                    !isSuccess && "opacity-90"
                  )}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Avatar with status */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        "h-10 w-10 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-sm",
                        isSuccess ? "from-emerald-500 to-teal-500" : "from-rose-500 to-red-500"
                      )}>
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-background flex items-center justify-center",
                        isSuccess ? "bg-emerald-500" : "bg-rose-500"
                      )}>
                        {isSuccess
                          ? <Check className="h-2 w-2 text-white" />
                          : <X className="h-2 w-2 text-white" />}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{event.fullName || event.username}</p>
                        <Badge className={cn(
                          "text-[8px] h-4 px-1.5 border-0",
                          isSuccess
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                        )}>
                          {isSuccess ? "Success" : "Failed"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">@{event.username}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <device.icon className="h-2.5 w-2.5" /> {device.label}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Globe className="h-2.5 w-2.5" /> N/A
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-medium text-foreground/80">
                        {new Date(event.loginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {new Date(event.loginAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── User Login Status (preserved) ── */}
      {data.userLoginStatus.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> User Login Status
          </h2>
          <div className="space-y-2">
            {data.userLoginStatus.map((u) => (
              <Card key={u.id} className="card-hover shadow-pharmacy border-0 overflow-hidden stagger-in">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shrink-0 shadow-sm">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{u.fullName || u.username}</p>
                      {!u.isActive && (
                        <Badge variant="outline" className="text-[9px] text-rose-600 border-rose-200">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">@{u.username} · {u.role}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {u.lastLoginAt ? (
                      <>
                        <p className="text-xs font-semibold">{new Date(u.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {u.daysSinceLogin === 0 ? "Today" : u.daysSinceLogin === 1 ? "Yesterday" : `${u.daysSinceLogin}d ago`}
                        </p>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">Never</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
