// ── InventoryOS: Subscription Tier Feature Gate ──
//
// Pure mapping from a Business.subscriptionTier string to the tier's
// configuration: price, hard limits (max products, AI quota, multi-user), and
// per-feature boolean flags.
//
// Used by:
//   - Backend route handlers — to validate whether a feature is allowed for
//     the caller's tier before doing any work.
//   - Frontend components — to hide/disable UI for features outside the tier.
//
// Tier ladder:
//   free    → 0    BDT/mo, 100 products,  no AI, single user
//   pro     → 500  BDT/mo, unlimited,     no AI, multi-user
//   pro_ai  → 1000 BDT/mo, unlimited,     full AI, multi-user
//
// Unknown / null / undefined tiers resolve to "free" (most restrictive) so a
// corrupt or missing tier value can never accidentally grant elevated access.
//
// This module is intentionally side-effect-free and imports nothing — it can
// be used from server routes, server components, and client components alike.

// ── Types ──
export type SubscriptionTier = "free" | "pro" | "pro_ai";

export interface TierLimits {
  /** Maximum number of active products. null = unlimited. */
  maxProducts: number | null;
  /** Whether any AI feature may be used at all. */
  aiEnabled: boolean;
  /** Whether multiple BusinessUser accounts can be created. */
  multiUserEnabled: boolean;
  /** Per-day AI call cap. Only meaningful when aiEnabled = true. */
  aiDailyLimit: number;
  /** Per-month AI call cap. Only meaningful when aiEnabled = true. */
  aiMonthlyLimit: number;
  /** Per-month AI token budget. Only meaningful when aiEnabled = true. */
  aiTokenBudget: number;
}

export interface TierFeatures {
  // ── Core inventory features (available on every tier) ──
  reports: boolean;
  analytics: boolean;
  suppliers: boolean;
  customerCredit: boolean;
  payments: boolean;
  returns: boolean;
  discountRules: boolean;
  csvImport: boolean;
  auditTrail: boolean;
  // ── AI-only features (require pro_ai) ──
  aiInsights: boolean;
  aiChat: boolean;
  smartReorder: boolean;
  demandForecast: boolean;
  expiryOptimizer: boolean;
}

export interface TierConfig {
  /** Human-readable tier name (e.g., "Pro AI"). */
  label: string;
  /** Monthly price in BDT. */
  price: number;
  limits: TierLimits;
  features: TierFeatures;
}

// ── Tier registry ──
const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    label: "Free",
    price: 0,
    limits: {
      maxProducts: 100,
      aiEnabled: false,
      multiUserEnabled: false,
      aiDailyLimit: 0,
      aiMonthlyLimit: 0,
      aiTokenBudget: 0,
    },
    features: {
      reports: true,
      analytics: true,
      suppliers: true,
      customerCredit: true,
      payments: true,
      returns: true,
      discountRules: true,
      csvImport: true,
      auditTrail: true,
      // AI features locked on Free
      aiInsights: false,
      aiChat: false,
      smartReorder: false,
      demandForecast: false,
      expiryOptimizer: false,
    },
  },

  pro: {
    label: "Pro",
    price: 500,
    limits: {
      maxProducts: null, // unlimited
      aiEnabled: false,
      multiUserEnabled: true,
      aiDailyLimit: 0,
      aiMonthlyLimit: 0,
      aiTokenBudget: 0,
    },
    features: {
      reports: true,
      analytics: true,
      suppliers: true,
      customerCredit: true,
      payments: true,
      returns: true,
      discountRules: true,
      csvImport: true,
      auditTrail: true,
      // AI still locked — needs pro_ai
      aiInsights: false,
      aiChat: false,
      smartReorder: false,
      demandForecast: false,
      expiryOptimizer: false,
    },
  },

  pro_ai: {
    label: "Pro AI",
    price: 1000,
    limits: {
      maxProducts: null, // unlimited
      aiEnabled: true,
      multiUserEnabled: true,
      aiDailyLimit: 50,
      aiMonthlyLimit: 1000,
      aiTokenBudget: 500_000,
    },
    features: {
      reports: true,
      analytics: true,
      suppliers: true,
      customerCredit: true,
      payments: true,
      returns: true,
      discountRules: true,
      csvImport: true,
      auditTrail: true,
      // Full AI access
      aiInsights: true,
      aiChat: true,
      smartReorder: true,
      demandForecast: true,
      expiryOptimizer: true,
    },
  },
};

// ── getTierConfig ──
// Returns the TierConfig for the given tier string. Unknown / null / undefined
// tiers resolve to "free" — the most restrictive — so corrupt data never
// silently grants elevated access.
export function getTierConfig(tier: string | null | undefined): TierConfig {
  if (tier && (tier as SubscriptionTier) in TIER_CONFIGS) {
    return TIER_CONFIGS[tier as SubscriptionTier];
  }
  return TIER_CONFIGS.free;
}

// ── Convenience helpers (used by route handlers & UI gates) ──

/** True if the tier permits any AI feature at all. */
export function isAIEnabled(tier: string | null | undefined): boolean {
  return getTierConfig(tier).limits.aiEnabled;
}

/** True if the given feature flag is on for this tier. */
export function isFeatureEnabled(
  tier: string | null | undefined,
  feature: keyof TierFeatures
): boolean {
  return getTierConfig(tier).features[feature];
}

/** Max products for this tier, or null for unlimited. */
export function getMaxProducts(tier: string | null | undefined): number | null {
  return getTierConfig(tier).limits.maxProducts;
}

/** True if the tier allows creating multiple BusinessUser accounts. */
export function isMultiUserEnabled(tier: string | null | undefined): boolean {
  return getTierConfig(tier).limits.multiUserEnabled;
}

/** All supported tiers, in upgrade order. Useful for pricing tables. */
export const ALL_TIERS: SubscriptionTier[] = ["free", "pro", "pro_ai"];
