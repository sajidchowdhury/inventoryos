"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Smartphone, Monitor, Trash2,
  Clock, Shield, AlertCircle, Check, Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  token: string;
  username: string;
  fullName: string | null;
  role: string;
  deviceInfo: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// Role color system matching the rest of the app
const roleStyles: Record<string, { badge: string; grad: string }> = {
  owner:       { badge: "bg-purple-100 text-purple-700",  grad: "from-purple-500 to-fuchsia-500" },
  admin:       { badge: "bg-emerald-100 text-emerald-700", grad: "from-emerald-500 to-teal-500" },
  manager:     { badge: "bg-blue-100 text-blue-700",       grad: "from-blue-500 to-indigo-500" },
  pharmacist:  { badge: "bg-cyan-100 text-cyan-700",       grad: "from-cyan-500 to-sky-500" },
  cashier:     { badge: "bg-amber-100 text-amber-700",     grad: "from-amber-500 to-orange-500" },
  stock_clerk: { badge: "bg-slate-100 text-slate-700",     grad: "from-slate-500 to-slate-600" },
};

const defaultRoleStyle = roleStyles.stock_clerk;

function getDeviceInfo(deviceStr: string): { icon: typeof Smartphone; label: string } {
  if (!deviceStr || deviceStr === "Unknown") return { icon: Monitor, label: "Unknown device" };
  const isMobile = /mobile|android|iphone|ipad/i.test(deviceStr);
  const browser = /chrome/i.test(deviceStr) ? "Chrome" : /firefox/i.test(deviceStr) ? "Firefox" : /safari/i.test(deviceStr) ? "Safari" : "Browser";
  const os = /windows/i.test(deviceStr) ? "Windows" : /mac/i.test(deviceStr) ? "macOS" : /linux/i.test(deviceStr) ? "Linux" : /android/i.test(deviceStr) ? "Android" : /ios|iphone|ipad/i.test(deviceStr) ? "iOS" : "Unknown OS";
  return {
    icon: isMobile ? Smartphone : Monitor,
    label: `${browser} on ${os}`,
  };
}

export function SessionManager() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;
  const currentToken = session?.token;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/sessions`);
      const data = await res.json();
      if (data.success) setSessions(data.sessions || []);
    } catch (err) {
      console.error("Fetch sessions error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleRevoke = async (sessionId: string, username: string) => {
    if (!businessId) return;
    if (!confirm(`Revoke session for ${username}? They will be logged out immediately.`)) return;
    setRevoking(sessionId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/sessions?sessionId=${sessionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Session revoked — ${username} logged out`);
      setTimeout(() => setSuccess(null), 3000);
      fetchSessions();
    } catch (err) {
      console.error("Revoke error:", err);
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllForUser = async (userId: string, username: string) => {
    if (!businessId) return;
    if (!confirm(`Revoke ALL sessions for ${username}?`)) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/sessions?userId=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(data.message);
      setTimeout(() => setSuccess(null), 3000);
      fetchSessions();
    } catch (err) {
      console.error("Revoke all error:", err);
    }
  };

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
          <h1 className="text-lg font-bold leading-tight">Active Sessions</h1>
          <p className="text-[11px] text-muted-foreground">Manage logged-in devices</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchSessions} disabled={loading} className="shadow-pharmacy">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* ── Success toast ── */}
      {success && (
        <Card className="border-emerald-200 bg-emerald-50 stagger-in">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-emerald-700">
            <Check className="h-4 w-4 shrink-0" /> {success}
          </CardContent>
        </Card>
      )}

      {/* ── Security info banner ── */}
      <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-100 stagger-in">
        <CardContent className="p-3 flex items-start gap-2 text-xs text-blue-700">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold">Session Security</p>
            <p className="mt-0.5 text-blue-600">{sessions.length} active session(s). Revoke to force logout a user from a specific device.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Session List ── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Card key={i} className="border-0 shadow-pharmacy">
              <CardContent className="p-4 h-24 skeleton rounded-xl" />
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="shadow-pharmacy border-0 stagger-in">
          <CardContent className="p-8 text-center space-y-2">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Clock className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="font-semibold">No active sessions</p>
            <p className="text-xs text-muted-foreground">Logins will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const device = getDeviceInfo(s.deviceInfo);
            const isCurrent = currentToken && s.token.startsWith(currentToken.substring(0, 8));
            const roleStyle = roleStyles[s.role] || defaultRoleStyle;
            return (
              <Card
                key={s.id}
                className={cn(
                  "card-hover shadow-pharmacy border-0 overflow-hidden stagger-in",
                  isCurrent && "ring-2 ring-emerald-300"
                )}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  {/* Gradient device icon */}
                  <div className={cn(
                    "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
                    isCurrent ? "from-emerald-500 to-teal-500" : "from-slate-500 to-slate-600"
                  )}>
                    <device.icon className="h-5 w-5 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold">{s.fullName || s.username}</p>
                      <Badge variant="outline" className={cn("text-[9px]", roleStyle.badge)}>{s.role}</Badge>
                      {isCurrent && (
                        <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                          <Check className="h-2.5 w-2.5 mr-0.5" /> Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Globe className="h-2.5 w-2.5" /> {device.label}
                    </p>
                    <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        <span className="font-medium text-foreground/80">Logged in:</span>
                        {" "}{new Date(s.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        <span className="font-medium text-foreground/80">Expires:</span>
                        {" "}{new Date(s.expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>

                  {/* Revoke button — rose outline */}
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-8"
                      onClick={() => handleRevoke(s.id, s.fullName || s.username)}
                      disabled={revoking === s.id}
                    >
                      {revoking === s.id
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                      Revoke
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </motion.div>
  );
}
