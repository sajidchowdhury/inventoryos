"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { hasPermission as checkPermission, hasAnyPermission as checkAny } from "@/lib/rbac";

interface PermissionState {
  permissions: string[];
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  role: string;
  username: string;
}

export function usePermissions(businessId: string | undefined): PermissionState {
  const session = useAuthStore((s) => s.session);
  const [permissions, setPermissions] = useState<string[]>(session?.permissions || []);
  const [loading, setLoading] = useState(!session?.permissions);

  const fetchPermissions = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/permissions`);
      const data = await res.json();
      if (data.success && data.permissions) {
        setPermissions(data.permissions);
        // Also update the auth store session
        const currentSession = useAuthStore.getState().session;
        if (currentSession) {
          useAuthStore.getState().setSession({
            ...currentSession,
            permissions: data.permissions,
            user: {
              ...currentSession.user,
              fullName: data.currentUser?.fullName,
            },
          });
        }
      }
    } catch (err) {
      console.error("Permission fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (!session?.permissions && businessId) {
      fetchPermissions();
    } else {
      setLoading(false);
    }
  }, [session?.permissions, businessId, fetchPermissions]);

  return {
    permissions,
    loading,
    hasPermission: (perm: string) => checkPermission(permissions, perm),
    hasAnyPermission: (perms: string[]) => checkAny(permissions, perms),
    role: session?.user?.role || "admin",
    username: session?.user?.username || "",
  };
}
