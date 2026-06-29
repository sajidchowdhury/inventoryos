"use client";

// AdminContext — provides the super-admin token + auth state to all admin pages.
// Used by the layout to share auth across route segments without prop drilling.

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AdminContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  hydrated: boolean;
  notify: (kind: "ok" | "err", msg: string) => void;
  toast: { kind: "ok" | "err"; msg: string } | null;
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

  const notify = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <AdminContext.Provider value={{ token, setToken, hydrated, notify, toast }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
