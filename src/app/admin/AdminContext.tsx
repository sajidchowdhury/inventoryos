"use client";

// AdminContext — provides the super-admin token + auth state to all admin pages.
// Includes auto-logout on 401 (expired/invalid token) and an apiFetch helper
// that automatically adds the Authorization header.

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface AdminContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  hydrated: boolean;
  notify: (kind: "ok" | "err", msg: string) => void;
  toast: { kind: "ok" | "err"; msg: string } | null;
  /** Fetch wrapper that auto-adds Authorization header and auto-logouts on 401 */
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Force logout (clears token from state + localStorage) */
  logout: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const TOKEN_KEY = "superAdminToken";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOKEN_KEY);
      if (saved) setTokenState(saved);
    } catch {}
    setHydrated(true);
  }, []);

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    try {
      if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  };

  const logout = () => {
    setToken(null);
  };

  const notify = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── apiFetch: wraps fetch with auto auth header + 401 handling ──
  const apiFetch = useCallback(async (url: string, options?: RequestInit): Promise<Response> => {
    const headers = new Headers(options?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (options?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, { ...options, headers });

    // Auto-logout on 401 (expired/invalid token)
    if (res.status === 401) {
      console.warn("[admin] Token expired or invalid — auto-logging out");
      setToken(null);
      notify("err", "Session expired. Please log in again.");
    }

    return res;
  }, [token]);

  return (
    <AdminContext.Provider value={{ token, setToken, hydrated, notify, toast, apiFetch, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
