"use client";

// /admin/layout.tsx — Shared shell for all super admin pages.
// Wraps every /admin/* route with:
//   - Auth check (login screen if no token)
//   - Hydration check (loading spinner until client hydrates)
//   - Sidebar navigation (desktop) / bottom tab bar (mobile)
//   - Header (Help button + Refresh + Logout)
//   - Toast notifications
//   - SuperAdminHelp off-canvas

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, LogOut, HelpCircle, Check, AlertCircle, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AdminProvider, useAdmin } from "./AdminContext";
import { AdminSidebar } from "./AdminSidebar";
import { SuperAdminHelp } from "./SuperAdminHelp";

// ── Page title map ──
const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin": { title: "Global Dashboard", subtitle: "Cross-project metrics & platform health" },
  "/admin/api-setup": { title: "API Setup", subtitle: "Configure cross-project infrastructure" },
  "/admin/deploy": { title: "Deploy", subtitle: "Deployment checklist & Hostinger guide" },
  "/admin/catalog": { title: "Master Catalog", subtitle: "14K+ pharmaceutical products from 232 companies" },
  "/admin/pharmacy": { title: "Pharmacy Dashboard", subtitle: "Pharmacy-specific metrics & configuration" },
  "/admin/cctv": { title: "CC Camera", subtitle: "Coming Soon" },
};

function getPageTitle(pathname: string): { title: string; subtitle: string } {
  for (const key of Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length)) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      return PAGE_TITLES[key];
    }
  }
  return { title: "Super Admin", subtitle: "InventoryOS Platform Control" };
}

// ── Login Screen ──
function LoginScreen() {
  const { setToken } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Super Admin</h2>
          <p className="text-sm text-slate-300 mt-1">InventoryOS Platform Control</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-slate-300">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 mt-1"
              placeholder="superadmin"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-slate-300">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 mt-1"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-300">{error}</div>
          )}
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
          </Button>
        </form>
        <div className="text-center text-xs text-slate-500">
          Demo: superadmin / admin123
        </div>
      </div>
    </div>
  );
}

// ── Main shell (wraps all authenticated pages) ──
function AdminShell({ children }: { children: React.ReactNode }) {
  const { token, setToken, hydrated, toast } = useAdmin();
  const [helpOpen, setHelpOpen] = useState(false);
  const pathname = usePathname();
  const pageInfo = getPageTitle(pathname);

  // Hydration check
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Auth check
  if (!token) {
    return <LoginScreen />;
  }

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-950">
      {/* Sidebar (desktop) + bottom tab (mobile) */}
      <AdminSidebar />

      {/* Main content area (offset for sidebar on desktop, padding for bottom tab on mobile) */}
      <div className="lg:pl-64 pb-16 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <h1 className="text-base font-bold leading-tight sm:text-lg">{pageInfo.title}</h1>
              <p className="text-xs text-muted-foreground">{pageInfo.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Help</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            className={cn(
              "fixed bottom-6 left-1/2 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg",
              toast.kind === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {toast.kind === "ok" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help off-canvas */}
      <SuperAdminHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

// ── Layout wrapper ──
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
