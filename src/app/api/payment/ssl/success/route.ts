// POST /api/payment/ssl/success
// P5: SSL Commerz success callback. Verifies the transaction + extends subscription.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySslTransaction } from "@/lib/ssl-commerz";
import { getTierConfig } from "@/lib/feature-gate";
import { canRestoreData, restoreBusinessData } from "@/lib/subscription-guard";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tranId = formData.get("tran_id") as string;
    const status = formData.get("status") as string;

    if (!tranId) {
      return NextResponse.redirect(new URL("/subscription?ssl=error", req.url));
    }

    // Find the pending payment transaction
    const payment = await db.paymentTransaction.findFirst({
      where: { trxId: tranId, status: "pending", method: "ssl_commerz" },
      include: {
        business: {
          select: {
            id: true, subscriptionTier: true, subscriptionEnd: true,
            subscriptionStage: true, dataSoftDeletedAt: true,
          },
        },
      },
    });

    if (!payment) {
      console.warn("[ssl-success] No pending payment found for tranId:", tranId);
      return NextResponse.redirect(new URL("/subscription?ssl=notfound", req.url));
    }

    // Verify with SSL Commerz
    const verification = await verifySslTransaction(tranId);

    if (!verification.valid) {
      // Mark as rejected
      await db.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: "rejected", notes: `SSL verification failed: ${verification.error}` },
      });
      return NextResponse.redirect(new URL("/subscription?ssl=failed", req.url));
    }

    // ── Success! Extend subscription ──
    const business = payment.business;
    const tierConfig = getTierConfig(business.subscriptionTier);
    const isAnnual = Math.abs(payment.amount - tierConfig.annualPrice) <= 5;
    const extensionDays = isAnnual ? 365 : 30;
    const now = new Date();
    const currentEnd = business.subscriptionEnd ?? now;
    const baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: { status: "matched", matchedAt: now, matchedBy: "ssl_commerz" },
      });

      await tx.business.update({
        where: { id: business.id },
        data: {
          subscriptionEnd: newEnd,
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
          amount: payment.amount,
          status: "paid",
          dueDate: now,
          paidAt: now,
          paymentMethod: "ssl_commerz",
        },
      });
    });

    // Restore soft-deleted data if needed
    if (business.dataSoftDeletedAt) {
      const canRestore = await canRestoreData(business.id);
      if (canRestore) {
        await restoreBusinessData(business.id);
      }
    }

    return NextResponse.redirect(new URL("/subscription?ssl=success", req.url));
  } catch (error) {
    console.error("[ssl-success] callback error:", error);
    return NextResponse.redirect(new URL("/subscription?ssl=error", req.url));
  }
}
