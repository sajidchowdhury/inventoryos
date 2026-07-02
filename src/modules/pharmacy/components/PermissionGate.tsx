"use client";

import { usePermissions } from "@/lib/use-permissions";
import { useAuthStore } from "@/lib/auth-store";

interface PermissionGateProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on whether the current user has the specified permission.
 * Usage: <PermissionGate permission="users.create"><Button>Add User</Button></PermissionGate>
 */
export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const { hasPermission, loading } = usePermissions(businessId);

  if (loading) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Conditionally renders children based on whether the user has ANY of the specified permissions.
 */
export function PermissionGateAny({ permissions, fallback = null, children }: { permissions: string[]; fallback?: React.ReactNode; children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const businessId = session?.business?.id;

  const { hasAnyPermission, loading } = usePermissions(businessId);

  if (loading) return null;
  if (!hasAnyPermission(permissions)) return <>{fallback}</>;
  return <>{children}</>;
}
