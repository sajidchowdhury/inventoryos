// POST /api/businesses/[id]/subscription/upgrade
// P6: Upgrade or downgrade tier. Upgrades take effect immediately (prorated).
// Downgrades take effect at next billing cycle (no immediate change).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTierConfig } from "@/lib/feature-gate";
import { getPaymentConfig } from "@/lib/payment-config";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const { newTier, reason } = body as { newTier?: string; reason?: string };

    if (!newTier || !["free", "pro", "pro_ai"].includes(newTier)) {
      return NextResponse.json({ error: "newTier must be 'free', 'pro', or 'pro_ai'" }, { status: 400 });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, subscriptionTier: true, subscriptionEnd: true, subscriptionStage: true, aiEnabled: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const oldTier = business.subscriptionTier;

    if (oldTier === newTier) {
      return NextResponse.json({ error: "Already on this tier" }, { status: 400 });
    }

    const oldConfig = getTierConfig(oldTier);
    const newConfig = getTierConfig(newTier);
    const isUpgrade = newConfig.price > oldConfig.price;

    const now = new Date();
    const remaining = business.subscriptionEnd ? Math.max(0, business.subscriptionEnd.getTime() - now.getTime()) : 0;
    const remainingDays = Math.ceil(remaining / (1000 * 60 * 60 * 24));

    if (isUpgrade) {
      // ── Upgrade: prorate the remaining days, change immediately ──
      // Proration = (new price - old price) × remaining days / 30
      const proratedAmount = Math.max(0, (newConfig.price - oldConfig.price) * remainingDays / 30);

      await db.$transaction(async (tx) => {
        await tx.business.update({
          where: { id: businessId },
          data: {
            subscriptionTier: newTier,
            aiEnabled: newConfig.limits.aiEnabled,
            aiDailyLimit: newConfig.limits.aiDailyLimit || 50,
            aiMonthlyLimit: newConfig.limits.aiMonthlyLimit || 1000,
            aiTokenBudget: newConfig.limits.aiTokenBudget || 500000,
          },
        });

        // Log the adjustment
        await tx.subscriptionAdjustment.create({
          data: {
            businessId,
            type: "plan_change",
            daysAdjusted: 0,
            amount: proratedAmount,
            reason: reason || `Upgrade from ${oldTier} to ${newTier}`,
            oldTier,
            newTier,
          },
        });

        // Create a prorated invoice if amount > 0
        if (proratedAmount > 0) {
          await tx.subscriptionInvoice.create({
            data: {
              businessId,
              tier: newTier,
              billingPeriod: "month",
              amount: proratedAmount,
              status: "pending",
              dueDate: now,
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `Upgraded from ${oldConfig.label} to ${newConfig.label}. ${proratedAmount > 0 ? `Prorated charge: ৳${proratedAmount.toFixed(2)}` : "No additional charge."}`,
        oldTier,
        newTier,
        proratedAmount: proratedAmount > 0 ? proratedAmount : 0,
        effectiveImmediately: true,
      });
    } else {
      // ── Downgrade: takes effect at next billing cycle ──
      // We don't change the tier now — we log the request and the P2 cron
      // will apply it when subscriptionEnd is reached.
      await db.subscriptionAdjustment.create({
        data: {
          businessId,
          type: "plan_change",
          daysAdjusted: 0,
          amount: 0,
          reason: reason || `Downgrade from ${oldTier} to ${newTier} (effective at next billing cycle)`,
          oldTier,
          newTier,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Downgrade from ${oldConfig.label} to ${newConfig.label} scheduled. Takes effect at your next billing cycle (${business.subscriptionEnd?.toLocaleDateString("en-GB") || "soon"}). No refund for the current period.`,
        oldTier,
        newTier,
        effectiveImmediately: false,
        effectiveDate: business.subscriptionEnd,
      });
    }
  } catch (error) {
    console.error("Upgrade error:", error);
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
  }
}
