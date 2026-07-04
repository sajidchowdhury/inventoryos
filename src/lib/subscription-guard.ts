// src/lib/subscription-guard.ts
// ── InventoryOS: Subscription Read-Only Guard ──
//
// Server-side enforcement of the 4-stage subscription lifecycle.
// Called at the top of every write endpoint (POST/PUT/DELETE on sales,
// purchases, batches, stock, products, customers, suppliers, etc.).
//
// If the business is in "read_only" or "data_wiped" stage, returns a 403
// with a clear message. Reports + export endpoints remain accessible.
//
// The client UI also disables write buttons (client-side), but THIS guard
// is the real enforcement — users can't bypass it via direct API calls.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type SubscriptionStage =
  | "active"
  | "expiring_soon"
  | "read_only"
  | "data_wiped";

export interface SubscriptionGuardResult {
  allowed: boolean;
  stage: SubscriptionStage;
  subscriptionEnd: Date | null;
  dataWipeDate: Date | null;
  error?: NextResponse;
}

/**
 * Check whether the given business is allowed to perform write operations.
 *
 * Returns { allowed: true, stage, ... } if writes are permitted.
 * Returns { allowed: false, stage, ..., error: NextResponse } if blocked.
 *
 * Stages:
 *   - active        → writes allowed (full access)
 *   - expiring_soon → writes allowed (full access + notification banner)
 *   - read_only     → writes BLOCKED (403) — can view reports only
 *   - data_wiped    → writes BLOCKED (403) — data soft-deleted, payment only
 *
 * Usage in a route handler:
 *   const guard = await requireActiveSubscription(businessId);
 *   if (!guard.allowed) return guard.error;
 *   // ... proceed with write operation
 */
export async function requireActiveSubscription(
  businessId: string
): Promise<SubscriptionGuardResult> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      subscriptionStage: true,
      subscriptionEnd: true,
      dataWipeDate: true,
      dataSoftDeletedAt: true,
    },
  });

  // If business not found, let the route handler return 404 (don't block here)
  if (!business) {
    return {
      allowed: true, // don't block — the route will 404 on missing business
      stage: "active",
      subscriptionEnd: null,
      dataWipeDate: null,
    };
  }

  const stage = business.subscriptionStage as SubscriptionStage;

  // Active + expiring_soon → full access
  if (stage === "active" || stage === "expiring_soon") {
    return {
      allowed: true,
      stage,
      subscriptionEnd: business.subscriptionEnd,
      dataWipeDate: business.dataWipeDate,
    };
  }

  // read_only + data_wiped → blocked
  const isDataWiped = stage === "data_wiped";
  const message = isDataWiped
    ? "Your subscription has expired and data was archived. Pay now to restore full access."
    : "Your subscription has expired. Pay now to restore full access. You can still view reports.";

  const daysUntilWipe = business.dataWipeDate
    ? Math.ceil((business.dataWipeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    allowed: false,
    stage,
    subscriptionEnd: business.subscriptionEnd,
    dataWipeDate: business.dataWipeDate,
    error: NextResponse.json(
      {
        success: false,
        error: message,
        type: "subscription_expired",
        stage,
        daysUntilWipe,
        dataWiped: isDataWiped,
      },
      { status: 403 }
    ),
  };
}

/**
 * Check if a business has soft-deleted data that can be restored.
 * Used by the restore-data endpoint after a payment is processed.
 */
export async function canRestoreData(businessId: string): Promise<boolean> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { dataSoftDeletedAt: true, dataPurgeDate: true },
  });

  if (!business || !business.dataSoftDeletedAt) return false;
  // Can only restore if the purge date hasn't passed
  if (business.dataPurgeDate && business.dataPurgeDate.getTime() < Date.now()) {
    return false;
  }
  return true;
}

/**
 * Restore soft-deleted data for a business.
 * Clears dataSoftDeletedAt + resets subscriptionStage to "active".
 * Called by the restore-data endpoint after a successful payment.
 */
export async function restoreBusinessData(businessId: string): Promise<void> {
  await db.business.update({
    where: { id: businessId },
    data: {
      dataSoftDeletedAt: null,
      subscriptionStage: "active",
      subscriptionStatus: "active",
    },
  });
}
