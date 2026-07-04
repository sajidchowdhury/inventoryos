// src/lib/payment-matching.ts
// ── InventoryOS: Payment Auto-Matching Engine (P3) ──
//
// When a super-admin uploads a ReceivedPayment (TRX ID + amount from their
// bKash/Nagad statement), this module searches for a pending PaymentTransaction
// with the same TRX ID + amount (±5 BDT tolerance). On match:
//   1. Sets PaymentTransaction.status = "matched"
//   2. Sets ReceivedPayment.matchedTransactionId
//   3. Extends the business's subscriptionEnd by 1 month (or 1 year for annual)
//   4. Resets subscriptionStage to "active"
//   5. If data was soft-deleted, restores it
//   6. Creates/updates a SubscriptionInvoice with status = "paid"
//
// If no match is found, the received payment stays unmatched (super-admin
// can manually review pending submissions).

import { db } from "@/lib/db";
import { getTierConfig } from "@/lib/feature-gate";
import { canRestoreData, restoreBusinessData } from "@/lib/subscription-guard";

const AMOUNT_TOLERANCE_BDT = 5; // ±5 BDT to handle rounding differences

export interface MatchResult {
  matched: boolean;
  paymentTransactionId: string | null;
  receivedPaymentId: string;
  businessId: string | null;
  subscriptionExtended: boolean;
  error?: string;
}

/**
 * Try to match a newly-uploaded ReceivedPayment to a pending PaymentTransaction.
 * Called after the super-admin uploads received payments.
 *
 * Matching logic:
 *   1. Exact TRX ID + exact amount
 *   2. Exact TRX ID + amount within ±5 BDT tolerance
 *   3. If multiple matches, pick the closest amount
 *
 * On match: extends subscription + restores data if needed.
 */
export async function tryMatchReceivedPayment(
  receivedPaymentId: string
): Promise<MatchResult> {
  const received = await db.receivedPayment.findUnique({
    where: { id: receivedPaymentId },
  });

  if (!received) {
    return {
      matched: false,
      paymentTransactionId: null,
      receivedPaymentId,
      businessId: null,
      subscriptionExtended: false,
      error: "Received payment not found",
    };
  }

  if (received.matchedTransactionId) {
    return {
      matched: true,
      paymentTransactionId: received.matchedTransactionId,
      receivedPaymentId,
      businessId: null,
      subscriptionExtended: false,
      error: "Already matched",
    };
  }

  // ── Search for pending PaymentTransactions with the same TRX ID ──
  const candidates = await db.paymentTransaction.findMany({
    where: {
      trxId: received.trxId,
      status: "pending",
      method: received.method,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          subscriptionEnd: true,
          subscriptionStage: true,
          dataSoftDeletedAt: true,
        },
      },
    },
    orderBy: { submittedAt: "asc" }, // oldest first
  });

  if (candidates.length === 0) {
    // No match — stays unmatched for manual review
    return {
      matched: false,
      paymentTransactionId: null,
      receivedPaymentId,
      businessId: null,
      subscriptionExtended: false,
    };
  }

  // ── Find the best match: exact amount first, then ±5 BDT ──
  let bestMatch = candidates[0];
  let bestDiff = Math.abs(bestMatch.amount - received.amount);

  for (const candidate of candidates) {
    const diff = Math.abs(candidate.amount - received.amount);
    if (diff < bestDiff) {
      bestMatch = candidate;
      bestDiff = diff;
    }
  }

  // Check if within tolerance
  if (bestDiff > AMOUNT_TOLERANCE_BDT) {
    // No match within tolerance — stays unmatched
    return {
      matched: false,
      paymentTransactionId: null,
      receivedPaymentId,
      businessId: null,
      subscriptionExtended: false,
    };
  }

  // ── Match found! Extend subscription + update records ──
  const business = bestMatch.business;
  const tierConfig = getTierConfig(business.subscriptionTier);

  // Determine extension period: if amount matches annual price, extend 1 year;
  // otherwise extend 1 month
  const isAnnual = Math.abs(bestMatch.amount - tierConfig.annualPrice) <= AMOUNT_TOLERANCE_BDT;
  const extensionDays = isAnnual ? 365 : 30;

  // Calculate new subscriptionEnd: extend from current end date (or now, whichever is later)
  const now = new Date();
  const currentEnd = business.subscriptionEnd ?? now;
  const baseDate = currentEnd > now ? currentEnd : now;
  const newSubscriptionEnd = new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

  // ── Update everything in a transaction ──
  await db.$transaction(async (tx) => {
    // 1. Update PaymentTransaction → matched
    await tx.paymentTransaction.update({
      where: { id: bestMatch.id },
      data: {
        status: "matched",
        matchedAt: now,
        matchedBy: "auto",
      },
    });

    // 2. Update ReceivedPayment → linked
    await tx.receivedPayment.update({
      where: { id: receivedPaymentId },
      data: {
        matchedTransactionId: bestMatch.id,
      },
    });

    // 3. Extend business subscription
    await tx.business.update({
      where: { id: business.id },
      data: {
        subscriptionEnd: newSubscriptionEnd,
        subscriptionStage: "active",
        subscriptionStatus: "active",
        aiEnabled: tierConfig.limits.aiEnabled,
      },
    });

    // 4. Create or update a SubscriptionInvoice
    await tx.subscriptionInvoice.create({
      data: {
        businessId: business.id,
        tier: business.subscriptionTier,
        billingPeriod: isAnnual ? "year" : "month",
        amount: bestMatch.amount,
        status: "paid",
        dueDate: now,
        paidAt: now,
        paymentMethod: bestMatch.method,
      },
    });
  });

  // 5. If data was soft-deleted, restore it
  if (business.dataSoftDeletedAt) {
    const canRestore = await canRestoreData(business.id);
    if (canRestore) {
      await restoreBusinessData(business.id);
      // P6: Send "data restored" notification
      await db.notificationLog.create({
        data: {
          businessId: business.id,
          type: "subscription_restored",
          severity: "info",
          title: "Data restored",
          message: "Your data has been restored after payment. Full access is re-enabled.",
          entityType: "subscription",
          entityId: null,
        },
      });
    }
  }

  // P6: Send "payment received" notification
  await db.notificationLog.create({
    data: {
      businessId: business.id,
      type: "subscription_payment_received",
      severity: "info",
      title: "Payment received",
      message: `Your ${isAnnual ? "annual" : "monthly"} subscription payment of ৳${bestMatch.amount} has been verified. Subscription extended until ${newSubscriptionEnd.toLocaleDateString("en-GB")}.`,
      entityType: "subscription",
      entityId: null,
    },
  });

  return {
    matched: true,
    paymentTransactionId: bestMatch.id,
    receivedPaymentId,
    businessId: business.id,
    subscriptionExtended: true,
  };
}

/**
 * Manually match a ReceivedPayment to a specific PaymentTransaction.
 * Used by the super-admin when auto-match fails (e.g. TRX ID typo).
 */
export async function manualMatchPayment(
  receivedPaymentId: string,
  paymentTransactionId: string,
  superAdminId: string
): Promise<MatchResult> {
  const received = await db.receivedPayment.findUnique({
    where: { id: receivedPaymentId },
  });
  const transaction = await db.paymentTransaction.findUnique({
    where: { id: paymentTransactionId },
    include: {
      business: {
        select: {
          id: true,
          subscriptionTier: true,
          subscriptionEnd: true,
          subscriptionStage: true,
          dataSoftDeletedAt: true,
        },
      },
    },
  });

  if (!received || !transaction) {
    return {
      matched: false,
      paymentTransactionId: null,
      receivedPaymentId,
      businessId: null,
      subscriptionExtended: false,
      error: "Payment or transaction not found",
    };
  }

  if (transaction.status !== "pending") {
    return {
      matched: false,
      paymentTransactionId,
      receivedPaymentId,
      businessId: null,
      subscriptionExtended: false,
      error: "Transaction is not pending (already matched or rejected)",
    };
  }

  const business = transaction.business;
  const tierConfig = getTierConfig(business.subscriptionTier);
  const isAnnual = Math.abs(transaction.amount - tierConfig.annualPrice) <= AMOUNT_TOLERANCE_BDT;
  const extensionDays = isAnnual ? 365 : 30;
  const now = new Date();
  const currentEnd = business.subscriptionEnd ?? now;
  const baseDate = currentEnd > now ? currentEnd : now;
  const newSubscriptionEnd = new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

  await db.$transaction(async (tx) => {
    await tx.paymentTransaction.update({
      where: { id: paymentTransactionId },
      data: {
        status: "matched",
        matchedAt: now,
        matchedBy: superAdminId,
      },
    });

    await tx.receivedPayment.update({
      where: { id: receivedPaymentId },
      data: { matchedTransactionId: paymentTransactionId },
    });

    await tx.business.update({
      where: { id: business.id },
      data: {
        subscriptionEnd: newSubscriptionEnd,
        subscriptionStage: "active",
        subscriptionStatus: "active",
        aiEnabled: tierConfig.limits.aiEnabled,
      },
    });

    await tx.subscriptionInvoice.create({
      data: {
        businessId: business.id,
        tier: business.subscriptionTier,
        billingPeriod: isAnnual ? "year" : "month",
        amount: transaction.amount,
        status: "paid",
        dueDate: now,
        paidAt: now,
        paymentMethod: transaction.method,
      },
    });
  });

  // Restore soft-deleted data if needed
  if (business.dataSoftDeletedAt) {
    const canRestore = await canRestoreData(business.id);
    if (canRestore) {
      await restoreBusinessData(business.id);
      // P6: Send "data restored" notification
      await db.notificationLog.create({
        data: {
          businessId: business.id,
          type: "subscription_restored",
          severity: "info",
          title: "Data restored",
          message: "Your data has been restored after payment. Full access is re-enabled.",
          entityType: "subscription",
          entityId: null,
        },
      });
    }
  }

  // P6: Send "payment received" notification
  await db.notificationLog.create({
    data: {
      businessId: business.id,
      type: "subscription_payment_received",
      severity: "info",
      title: "Payment received",
      message: `Your ${isAnnual ? "annual" : "monthly"} subscription payment of ৳${transaction.amount} has been verified. Subscription extended until ${newSubscriptionEnd.toLocaleDateString("en-GB")}.`,
      entityType: "subscription",
      entityId: null,
    },
  });

  return {
    matched: true,
    paymentTransactionId,
    receivedPaymentId,
    businessId: business.id,
    subscriptionExtended: true,
  };
}
