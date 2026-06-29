// ── POST /api/super-admin/report-scheduling/report-deliveries/[id]/resend ──
// Manually resend a delivery (e.g., if it failed and the founder fixed the email address).
// Resets status to "queued" and retryCount to 0.

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
        superAdminId: true, expiresAt: true,
        superAdmin: { select: { id: true, isActive: true, username: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const delivery = await db.reportDelivery.findUnique({ where: { id } });
    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    // Reset to queued for the delivery worker to pick up
    await db.reportDelivery.update({
      where: { id },
      data: {
        status: "queued",
        retryCount: 0,
        errorMessage: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Delivery ${id} reset to queued. The delivery worker will send it within 1 minute.`,
    });
  } catch (error) {
    console.error("[resend] failed:", error);
    return NextResponse.json({ error: "Failed to resend delivery" }, { status: 500 });
  }
}
