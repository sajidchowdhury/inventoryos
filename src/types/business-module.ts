// ── InventoryOS: Business Module Interface ──
// Every business module must implement this interface
// to be registered in the platform's module registry.

import { type LucideIcon } from "lucide-react";

export type BusinessSlug =
  | "pharmacy"
  | "grocery"
  | "restaurant"
  | "cctv"
  | "electric"
  | "mobile"
  | "bakery";

export interface BusinessModuleConfig {
  /** Unique slug identifier (e.g., "pharmacy") */
  slug: BusinessSlug;
  /** Human-readable name (e.g., "Pharmacy") */
  name: string;
  /** Short description for the landing page */
  description: string;
  /** Lucide icon component */
  icon: string;
  /** Brand color (hex) */
  color: string;
  /** Whether this module is currently active and available */
  isActive: boolean;
  /** Display order on the business selection screen */
  sortOrder: number;
  /** Feature list shown on the landing page */
  features: string[];
}

export type TransactionType =
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT"
  | "WASTE"
  | "RETURN";

export type UserRole = "admin" | "manager" | "staff";

export interface AuthUser {
  id: string;
  phone: string;
  name: string | null;
}

export interface AuthBusinessUser {
  id: string;
  businessId: string;
  username: string;
  role: UserRole;
  business: {
    id: string;
    name: string;
    businessType: {
      slug: BusinessSlug;
      name: string;
      color: string;
      icon: string;
    };
  };
}

export interface AuthSession {
  user: AuthUser;
  businessUser: AuthBusinessUser;
  token: string;
}
