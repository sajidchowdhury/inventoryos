// POST /api/super-admin/clients/[id]/refund
// P6: Super-admin issues a refund. Reverses the subscription extension +
// logs the refund in SubscriptionAdjustment for audit.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: { id: true, superAdminId: true, expiresAt: true, superAdmin: { select: { id: true, isActive: true } } },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const { paymentTransactionId, reason } = body as { paymentTransactionId?: string; reason?: string };

    if (!paymentTransactionId) {
      return NextResponse.json({ error: "paymentTransactionId is required" }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "reason is required for refunds" }, { status: 400 });
    }

    const payment = await db.paymentTransaction.findUnique({
      where: { id: paymentTransactionId },
      include: {
        business: {
          select: { id: true, subscriptionEnd: true, subscriptionTier: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "matched") {
      return NextResponse.json({ error: "Only matched payments can be refunded" }, { status: 400 });
    }

    if (payment.businessId !== businessId) {
      return NextResponse.json({ error: "Payment does not belong to this business" }, { status: 400 });
    }

    // Determine the extension period that was applied
    const isAnnual = payment.notes?.includes("year") || payment.method === "ssl_commerz" && payment.amount >= 8000;
    const extensionDays = isAnnual ? 365 : 30;

    // Reverse the extension
    const now = new Date();
    const currentEnd = payment.business.subscriptionEnd ?? now;
    const newEnd = new Date(currentEnd.getTime() - extensionDays * 24 * 60 * 60 * 1000);

    await db.$transaction(async (tx) => {
      // Mark payment as refunded
      await tx.paymentTransaction.update({
        where: { id: paymentTransactionId },
        data: {
          status: "refunded",
          notes: `${payment.notes || ""} | Refunded: ${reason}`.trim(),
        },
      });

      // Shorten subscriptionEnd
      await tx.business.update({
        where: { id: businessId },
        data: {
          subscriptionEnd: newEnd > now ? newEnd : now,
          // If the refund brings the end date before now, the P2 cron will handle stage transition
        },
      });

      // Log the adjustment
      await tx.subscriptionAdjustment.create({
        data: {
          businessId,
          type: "refund",
          daysAdjusted: -extensionDays,
          amount: payment.amount,
          reason,
          createdBy: session.superAdminId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Refund processed. Subscription shortened by ${extensionDays} days. New end date: ${newEnd > now ? newEnd.toLocaleDateString("en-GB") : "immediate (will enter grace period)"}.`,
      newSubscriptionEnd: newEnd,
    });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
}
