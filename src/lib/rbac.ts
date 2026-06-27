// ── InventoryOS: Role & Permission Definitions ──
// Centralized RBAC configuration for all business types

export type Role = "owner" | "admin" | "manager" | "pharmacist" | "cashier" | "stock_clerk";

export interface RoleConfig {
  name: string;
  label: string;
  description: string;
  color: string;
  permissions: string[];
}

// All available permissions in the system
export const ALL_PERMISSIONS = [
  // Dashboard & Analytics
  "dashboard.view",
  "analytics.view",
  "business-dashboard.view",
  // Products & Inventory
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "categories.view",
  "categories.create",
  "categories.edit",
  "categories.delete",
  "batches.view",
  "batches.create",
  "batches.edit",
  "batches.delete",
  "batches.adjust",
  "batches.quarantine",
  "batches.dispose",
  // Sales
  "sales.view",
  "sales.create",
  "sales.cancel",
  "dispense.create",
  "payments.view",
  "payments.create",
  "returns.view",
  "returns.create",
  "discount-rules.view",
  "discount-rules.manage",
  // Customers
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",
  // Purchases & Suppliers
  "suppliers.view",
  "suppliers.create",
  "suppliers.edit",
  "suppliers.delete",
  "purchases.view",
  "purchases.create",
  "purchases.cancel",
  // Expiry
  "expiry.view",
  "expiry.manage",
  // Reports
  "reports.view",
  "reports.tax",
  "reports.audit",
  "reports.export",
  // Alerts & Settings
  "alerts.view",
  "alerts.manage",
  "alert-settings.manage",
  // User Management
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  // Transactions
  "transactions.view",
] as const;

export const ROLE_DEFINITIONS: Record<Role, RoleConfig> = {
  owner: {
    name: "owner",
    label: "Owner",
    description: "Full access to everything including user management",
    color: "#7C3AED",
    permissions: [...ALL_PERMISSIONS],
  },
  admin: {
    name: "admin",
    label: "Administrator",
    description: "Full access except deleting other owners",
    color: "#3B82F6",
    permissions: [...ALL_PERMISSIONS],
  },
  manager: {
    name: "manager",
    label: "Manager",
    description: "Manage inventory, sales, purchases, reports — no user management",
    color: "#10B981",
    permissions: [
      "dashboard.view", "analytics.view", "business-dashboard.view",
      "products.view", "products.create", "products.edit", "products.delete",
      "categories.view", "categories.create", "categories.edit",
      "batches.view", "batches.create", "batches.edit", "batches.adjust", "batches.quarantine", "batches.dispose",
      "sales.view", "sales.create", "sales.cancel",
      "dispense.create",
      "payments.view", "payments.create",
      "returns.view", "returns.create",
      "discount-rules.view", "discount-rules.manage",
      "customers.view", "customers.create", "customers.edit", "customers.delete",
      "suppliers.view", "suppliers.create", "suppliers.edit",
      "purchases.view", "purchases.create", "purchases.cancel",
      "expiry.view", "expiry.manage",
      "reports.view", "reports.tax", "reports.audit", "reports.export",
      "alerts.view", "alerts.manage",
      "transactions.view",
    ],
  },
  pharmacist: {
    name: "pharmacist",
    label: "Pharmacist",
    description: "Dispense, manage batches, view products — no financial reports",
    color: "#F59E0B",
    permissions: [
      "dashboard.view",
      "products.view",
      "batches.view", "batches.create", "batches.edit", "batches.adjust", "batches.quarantine",
      "sales.view", "sales.create",
      "dispense.create",
      "returns.view", "returns.create",
      "customers.view", "customers.create", "customers.edit",
      "expiry.view", "expiry.manage",
      "alerts.view",
      "transactions.view",
    ],
  },
  cashier: {
    name: "cashier",
    label: "Cashier",
    description: "Process sales and payments only",
    color: "#EF4444",
    permissions: [
      "dashboard.view",
      "products.view",
      "sales.view", "sales.create",
      "dispense.create",
      "payments.view", "payments.create",
      "returns.view", "returns.create",
      "customers.view", "customers.create",
    ],
  },
  stock_clerk: {
    name: "stock_clerk",
    label: "Stock Clerk",
    description: "Manage stock, batches, and purchases — no sales",
    color: "#6366F1",
    permissions: [
      "dashboard.view",
      "products.view", "products.create", "products.edit",
      "categories.view",
      "batches.view", "batches.create", "batches.edit", "batches.adjust",
      "suppliers.view",
      "purchases.view", "purchases.create",
      "expiry.view",
      "alerts.view",
      "transactions.view",
    ],
  },
};

export function getPermissionsForRole(role: string): string[] {
  return ROLE_DEFINITIONS[role as Role]?.permissions || [];
}

export function hasPermission(userPermissions: string[], permission: string): boolean {
  if (userPermissions.includes("*")) return true; // wildcard
  return userPermissions.includes(permission);
}

export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  if (userPermissions.includes("*")) return true;
  return permissions.some((p) => userPermissions.includes(p));
}
