// GET /api/super-admin/pending-payments
// P3: Lists all pending user payment submissions awaiting match/review.
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

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const pending = await db.paymentTransaction.findMany({
      where: { status: "pending" },
      orderBy: { submittedAt: "asc" },
      take: 100,
      include: {
        business: {
          select: {
            id: true, name: true, shopCode: true,
            subscriptionTier: true, subscriptionEnd: true, subscriptionStage: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      pending,
      count: pending.length,
    });
  } catch (error) {
    console.error("Pending payments error:", error);
    return NextResponse.json({ error: "Failed to load pending payments" }, { status: 500 });
  }
}
