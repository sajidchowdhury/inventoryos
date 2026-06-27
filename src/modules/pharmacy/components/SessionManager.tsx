"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Smartphone, Monitor, Trash2,
  Clock, Shield, AlertCircle, Check,
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

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  manager: "bg-green-100 text-green-700",
  pharmacist: "bg-orange-100 text-orange-700",
  cashier: "bg-red-100 text-red-700",
  stock_clerk: "bg-indigo-100 text-indigo-700",
};

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
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("users")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Active Sessions</h1>
        <Button variant="ghost" size="icon" onClick={fetchSessions} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {success && (
        <Card className="border-green-500/50 bg-green-50">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-green-700">
            <Check className="h-4 w-4" /> {success}
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 flex items-start gap-2 text-xs text-blue-700">
          <Shield className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Session Security</p>
            <p className="mt-0.5">{sessions.length} active session(s). Revoke to force logout a user from a specific device.</p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No active sessions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const device = getDeviceInfo(s.deviceInfo);
            const isCurrent = currentToken && s.token.startsWith(currentToken.substring(0, 8));
            return (
              <Card key={s.id} className={cn("overflow-hidden", isCurrent && "border-green-300 bg-green-50/30")}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <device.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{s.fullName || s.username}</p>
                      <Badge variant="outline" className={cn("text-[9px]", roleColors[s.role])}>{s.role}</Badge>
                      {isCurrent && <Badge className="text-[9px] bg-green-100 text-green-700">Current</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{device.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Logged in: {new Date(s.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Expires: {new Date(s.expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {!isCurrent && (
                    <button
                      className="p-1.5 rounded hover:bg-red-50 shrink-0 disabled:opacity-50"
                      onClick={() => handleRevoke(s.id, s.fullName || s.username)}
                      disabled={revoking === s.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
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
