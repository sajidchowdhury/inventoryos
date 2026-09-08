// POST /api/super-admin/payments/[id]/verify
// SUB-5: Super-admin directly verifies a pending PaymentTransaction
// WITHOUT requiring a ReceivedPayment to exist first.
//
// This is the "direct verify" flow the user described in their step 4:
//   "When super admin verifies the TX ID is right then it will mark as
//    done and the user is good to use the software again."
//
// Previously, the only ways to approve a payment were:
//   (a) auto-match — requires the super-admin to upload a ReceivedPayment
//       (their bKash statement) first; the auto-match engine then finds
//       a pending PaymentTransaction with the same TRX ID + amount ±৳5
//   (b) manual match — /api/super-admin/received-payments/[id]/match
//       also requires a ReceivedPayment to exist
//
// There was no way to approve a pending PaymentTransaction directly.
// If the super-admin didn't upload their bKash statement, pending
// payments sat forever. This endpoint closes that gap.
//
// Auth: super-admin Bearer token (same as /reject and /match).
//
// Request body (all optional):
//   { "note"?: string } — super-admin's note appended to the payment's
//   existing notes (prefixed with "[Verified]").
//
// Response on success (200):
//   {
//     success: true,
//     message: "Payment verified. Subscription extended.",
//     paymentTransactionId: string,
//     businessId: string,
//     receivedPaymentId: string | null,  // null if no ReceivedPayment was linked
//     subscriptionExtended: true,
//     newSubscriptionEnd: string  // ISO date
//   }
//
// Response on error (400/404/401/500):
//   { error: string }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { directVerifyPayment } from "@/lib/payment-matching";

// ── Super-admin auth ──
// Mirrors the verifySuperAdmin helper in /reject and /match. Kept inline
// (not extracted to a shared util) to match the existing pattern — every
// super-admin endpoint has its own copy. A future refactor could extract
// this to src/lib/super-admin-auth.ts.
async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true,
        superAdminId: true,
        expiresAt: true,
        superAdmin: { select: { id: true, isActive: true } },
      },
    });
    if (
      !session ||
      !session.superAdmin.isActive ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ──
  const session = await verifySuperAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: paymentId } = await params;

  // ── Parse body (note is optional) ──
  let note: string | undefined;
  try {
    const body = await req.json();
    note = typeof body?.note === "string" ? body.note.trim() || undefined : undefined;
  } catch {
    // Body is optional or not JSON — that's fine, note is just undefined.
    note = undefined;
  }

  try {
    // ── Run the direct verify ──
    const result = await directVerifyPayment(paymentId, session.superAdminId, { note });

    if (!result.matched) {
      // Distinguish 404 (not found) from 400 (not pending) for the client.
      const status =
        result.error === "Payment transaction not found" ||
        result.error === "Business not found for this payment transaction"
          ? 404
          : 400;
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified. Subscription extended.",
      paymentTransactionId: result.paymentTransactionId,
      businessId: result.businessId,
      // null when no ReceivedPayment was linked (the common case for
      // direct verify — that's the whole point).
      receivedPaymentId: result.receivedPaymentId,
      subscriptionExtended: result.subscriptionExtended,
      newSubscriptionEnd: result.newSubscriptionEnd?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("[super-admin/payments/[id]/verify] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// ── GET: discovery endpoint ──
// Returns metadata about this route so the super-admin client can
// discover available actions without hardcoding. Matches the pattern
// used by /api/cron/* routes.
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/super-admin/payments/[id]/verify",
    method: "POST",
    description:
      "Directly verify a pending PaymentTransaction without requiring a ReceivedPayment. Extends the business subscription by 1 month (or 1 year if the amount matches the annual price).",
    auth: "Authorization: Bearer <superAdminToken>",
    body: { note: "string (optional) — appended to the payment notes with [Verified] prefix" },
    responses: {
      200: "Payment verified. Subscription extended.",
      400: "Transaction is not pending (already matched or rejected).",
      401: "Unauthorized — super-admin token required.",
      404: "Payment transaction not found.",
      500: "Internal error.",
    },
  });
}
