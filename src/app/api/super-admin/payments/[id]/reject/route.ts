// POST /api/super-admin/payments/[id]/reject
// P3: Super-admin rejects a pending payment submission with a reason.
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

  const { id: paymentId } = await params;

  try {
    const body = await req.json();
    const { reason } = body as { reason?: string };

    const payment = await db.paymentTransaction.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot reject a payment with status '${payment.status}'` },
        { status: 400 }
      );
    }

    await db.paymentTransaction.update({
      where: { id: paymentId },
      data: {
        status: "rejected",
        matchedAt: new Date(),
        matchedBy: session.superAdminId,
        notes: reason ? `Rejected: ${reason}` : "Rejected by super-admin",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment rejected.",
    });
  } catch (error) {
    console.error("Reject payment error:", error);
    return NextResponse.json({ error: "Failed to reject payment" }, { status: 500 });
  }
}
