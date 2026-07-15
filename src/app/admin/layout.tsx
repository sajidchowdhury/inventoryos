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
  "/admin": { title: "Command Center", subtitle: "Platform overview + system health" },
  "/admin/clients": { title: "Client Monitor", subtitle: "Subscriptions + revenue tracking" },
  "/admin/api-setup": { title: "System Config", subtitle: "AI, SMTP, Cron, Kill Switches" },
  "/admin/deploy": { title: "Deploy", subtitle: "Build + deploy guide" },
  // Each business has one consolidated menu (Overview + Catalog tabs).
  "/admin/cctv": { title: "CCTV Shop", subtitle: "CCTV business — overview + master catalog" },
  "/admin/catalog/cctv": { title: "CCTV Shop", subtitle: "CCTV master product catalog" },
  "/admin/pharmacy": { title: "Pharmacy", subtitle: "Pharmacy business — overview + 14K catalog" },
  "/admin/catalog": { title: "Pharmacy", subtitle: "Pharmacy master product catalog (14K+)" },
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
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.hint) {
          throw new Error(data.hint);
        }
        // If login fails with 401, check if any super-admin accounts exist
        // and show a helpful message pointing to the setup script.
        if (res.status === 401) {
          try {
            const statusRes = await fetch("/api/setup-status");
            const status = await statusRes.json();
            if (status?.database?.connected && status?.database?.superAdminCount === 0) {
              throw new Error("No super-admin account exists on this server. Run: npx tsx scripts/create-super-admin.ts admin YourPassword");
            }
            if (status?.database?.connected === false) {
              throw new Error("Database not connected. Check DATABASE_URL in .env, then run: npm run db:push");
            }
          } catch (inner) {
            if (inner instanceof Error && inner.message.startsWith("No super-admin")) {
              throw inner;
            }
            if (inner instanceof Error && inner.message.startsWith("Database not connected")) {
              throw inner;
            }
          }
        }
        if (res.status === 500) {
          throw new Error("Server error — is the database running? Check DATABASE_URL in .env.");
        }
        throw new Error(data.error || "Login failed");
      }
      if (!data.token) {
        throw new Error("Login succeeded but no session token was returned. Check server logs.");
      }
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4 overflow-hidden">
      {/* Soft decorative wash — low-opacity radial of the primary color */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top, oklch(0.52 0.19 275 / 0.12), transparent 55%), radial-gradient(ellipse at bottom right, oklch(0.6 0.12 170 / 0.08), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card text-card-foreground p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Super Admin</h2>
          <p className="text-sm text-muted-foreground mt-1">InventoryOS Platform Control</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1"
              placeholder="superadmin"
              autoFocus
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
          </Button>
        </form>
        <div className="text-center text-xs text-muted-foreground">
          First time? Default: superadmin / admin123 (after seed), or run:
          <br />
          <code className="font-mono text-[10px]">npx tsx scripts/create-super-admin.ts admin YourPassword</code>
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
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar (desktop) + bottom tab (mobile) */}
      <AdminSidebar />

      {/* Main content area (offset for sidebar on desktop, padding for bottom tab on mobile) */}
      <div className="lg:pl-64 pb-16 lg:pb-0">
        {/* Header — soft frosted bg, low-contrast border */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              <h1 className="text-base font-semibold leading-tight sm:text-lg tracking-tight">{pageInfo.title}</h1>
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

        {/* Page content — uses the soft warm-neutral --background token */}
        <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 min-h-screen">
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
              "fixed bottom-6 left-1/2 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg border",
              toast.kind === "ok"
                ? "bg-success text-success-foreground border-success-border"
                : "bg-destructive text-destructive-foreground border-destructive/30"
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
