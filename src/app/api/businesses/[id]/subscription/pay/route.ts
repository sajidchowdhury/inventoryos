// POST /api/businesses/[id]/subscription/pay
// P3: User submits a bKash/Nagad payment (TRX ID + amount).
// Creates a PaymentTransaction with status="pending" for the auto-matching engine.
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
    const { method, trxId, amount, billingPeriod, note } = body;

    // ── Validate ──
    if (!method || !["bkash", "nagad"].includes(method)) {
      return NextResponse.json(
        { error: "Payment method must be 'bkash' or 'nagad'" },
        { status: 400 }
      );
    }

    if (!trxId || typeof trxId !== "string" || trxId.trim().length < 6) {
      return NextResponse.json(
        { error: "TRX ID must be at least 6 characters" },
        { status: 400 }
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // ── Load business to get tier + expected amount ──
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionEnd: true,
        subscriptionStage: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // ── Get tier config + payment config for expected amount + active methods ──
    const tierConfig = getTierConfig(business.subscriptionTier);
    const period = billingPeriod === "year" ? "year" : "month";
    const paymentConfig = await getPaymentConfig();

    // Use DB-configured prices if available, otherwise fall back to tier config
    let expectedAmount: number;
    if (business.subscriptionTier === "pro") {
      expectedAmount = period === "year" ? paymentConfig.proAnnual : paymentConfig.proMonthly;
    } else if (business.subscriptionTier === "pro_ai") {
      expectedAmount = period === "year" ? paymentConfig.proAiAnnual : paymentConfig.proAiMonthly;
    } else {
      expectedAmount = period === "year" ? tierConfig.annualPrice : tierConfig.price;
    }

    // ── Check if this TRX ID has EVER been submitted (SUB-12) ──
    // Previously, we only checked for pending payments with this TRX
    // ID. This allowed a TRX ID to be re-submitted by a different
    // business after the first one was matched/rejected — creating
    // ambiguity in the auto-match engine (two PaymentTransactions
    // with the same TRX ID, one matched, one pending).
    //
    // Now we check across ALL statuses (pending + matched + rejected).
    // If a TRX ID has ever been used, we reject the new submission.
    // This prevents:
    //   - Duplicate submissions (user submits the same TX ID twice)
    //   - Cross-business TRX ID collisions (typo or fraud)
    //   - Reuse of a matched TRX ID for a second month (the user should
    //     get a NEW TX ID from bKash each time they pay)
    //
    // Edge case: if the super-admin rejects a payment (e.g. wrong
    // amount), the user CANNOT resubmit with the same TX ID — they
    // must make a new bKash payment and get a new TX ID. This is
    // intentional and documented in the rejection message.
    const existing = await db.paymentTransaction.findFirst({
      where: {
        trxId: trxId.trim(),
      },
      select: { id: true, status: true, businessId: true },
    });

    if (existing) {
      // Distinguish the error message based on the existing payment's
      // status so the user knows what to do.
      let errorMessage: string;
      if (existing.status === "pending") {
        errorMessage = "A pending payment with this TRX ID already exists. Please wait for the super-admin to verify it, or contact support if it's taking too long.";
      } else if (existing.status === "matched") {
        errorMessage = "This TRX ID has already been used for a verified payment. Each bKash/Nagad transaction can only be submitted once. Please make a new payment to get a new TRX ID.";
      } else if (existing.status === "rejected") {
        errorMessage = "This TRX ID was previously submitted but rejected. Please make a new payment to get a new TRX ID, or contact support if you believe the rejection was in error.";
      } else {
        errorMessage = `This TRX ID has already been submitted (status: ${existing.status}). Please use a new TRX ID.`;
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 409 }
      );
    }

    // ── Create the payment transaction ──
    const payment = await db.paymentTransaction.create({
      data: {
        businessId,
        method,
        trxId: trxId.trim(),
        amount: amountNum,
        status: "pending",
        notes: note?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        method: payment.method,
        trxId: payment.trxId,
        amount: payment.amount,
        status: payment.status,
        submittedAt: payment.submittedAt,
      },
      expectedAmount,
      billingPeriod: period,
      message: "Payment submitted successfully. Your subscription will be activated once the super-admin verifies your transaction.",
    });
  } catch (error) {
    console.error("Payment submission error:", error);
    return NextResponse.json({ error: "Failed to submit payment" }, { status: 500 });
  }
}
