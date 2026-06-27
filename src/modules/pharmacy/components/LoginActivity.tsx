"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Clock, User, Check, X,
  TrendingUp, Calendar,
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

export function LoginActivity() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

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

  if (loading || !data) {
    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveView("users")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold flex-1">Loading...</h1>
        </div>
        <Card className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
      </motion.div>
    );
  }

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Login Activity</h1>
        <Button variant="ghost" size="icon" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-2 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-green-600 mb-0.5" />
          <p className="text-base font-bold text-green-600">{data.summary.loginsToday}</p>
          <p className="text-[9px] text-muted-foreground">Logins Today</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <Calendar className="h-4 w-4 mx-auto text-blue-600 mb-0.5" />
          <p className="text-base font-bold text-blue-600">{data.summary.loginsThisWeek}</p>
          <p className="text-[9px] text-muted-foreground">This Week</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 text-center">
          <Clock className="h-4 w-4 mx-auto text-orange-600 mb-0.5" />
          <p className="text-base font-bold text-orange-600">{data.summary.activeSessions}</p>
          <p className="text-[9px] text-muted-foreground">Active Now</p>
        </CardContent></Card>
      </div>

      {/* User Login Status */}
      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground">User Login Status</h2>
        <div className="space-y-2">
          {data.userLoginStatus.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{u.fullName || u.username}</p>
                    {!u.isActive && <Badge variant="outline" className="text-[9px] text-red-600">Inactive</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    @{u.username} · {u.role}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {u.lastLoginAt ? (
                    <>
                      <p className="text-xs font-medium">{new Date(u.lastLoginAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {u.daysSinceLogin === 0 ? "Today" : u.daysSinceLogin === 1 ? "Yesterday" : `${u.daysSinceLogin}d ago`}
                      </p>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-[9px] text-orange-600">Never</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Login Events */}
      {data.recentLogins.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent Logins</h2>
          <div className="space-y-1">
            {data.recentLogins.slice(0, 15).map((event) => (
              <Card key={event.id}>
                <CardContent className="p-2.5 flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    event.isActive ? "bg-green-500" : "bg-muted-foreground/30"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{event.fullName || event.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(event.loginAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {event.isActive ? (
                    <Badge variant="outline" className="text-[9px] text-green-600">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] text-muted-foreground">Expired</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
