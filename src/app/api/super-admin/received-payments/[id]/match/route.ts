// POST /api/super-admin/received-payments/[id]/match
// P3: Manually match a received payment to a specific pending payment transaction.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualMatchPayment } from "@/lib/payment-matching";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true, superAdminId: true, expiresAt: true,
        superAdmin: { select: { id: true, isActive: true } },
      },
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

  const { id: receivedPaymentId } = await params;

  try {
    const body = await req.json();
    const { paymentTransactionId } = body as { paymentTransactionId?: string };

    if (!paymentTransactionId) {
      return NextResponse.json({ error: "paymentTransactionId is required" }, { status: 400 });
    }

    const result = await manualMatchPayment(
      receivedPaymentId,
      paymentTransactionId,
      session.superAdminId
    );

    if (!result.matched) {
      return NextResponse.json(
        { error: result.error || "Manual match failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment matched successfully. Subscription extended.",
      ...result,
    });
  } catch (error) {
    console.error("Manual match error:", error);
    return NextResponse.json({ error: "Failed to match payment" }, { status: 500 });
  }
}
