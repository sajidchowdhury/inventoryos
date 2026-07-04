// POST /api/super-admin/clients/[id]/extend
// P4: Manually extend a business's subscription (admin override).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTierConfig } from "@/lib/feature-gate";
import { canRestoreData, restoreBusinessData } from "@/lib/subscription-guard";

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
    const { days, tier, reason } = body as { days?: number; tier?: string; reason?: string };

    if (!days || days <= 0) {
      return NextResponse.json({ error: "days (positive number) is required" }, { status: 400 });
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, subscriptionTier: true, subscriptionEnd: true, subscriptionStage: true, dataSoftDeletedAt: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const now = new Date();
    const currentEnd = business.subscriptionEnd ?? now;
    const baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    const updateData: Record<string, unknown> = {
      subscriptionEnd: newEnd,
      subscriptionStage: "active",
      subscriptionStatus: "active",
    };

    // Optionally change tier
    if (tier && ["free", "pro", "pro_ai"].includes(tier)) {
      updateData.subscriptionTier = tier;
      const tierConfig = getTierConfig(tier);
      updateData.aiEnabled = tierConfig.limits.aiEnabled;
    }

    await db.business.update({
      where: { id: businessId },
      data: updateData,
    });

    // Restore soft-deleted data if needed
    if (business.dataSoftDeletedAt) {
      const canRestore = await canRestoreData(businessId);
      if (canRestore) {
        await restoreBusinessData(businessId);
      }
    }

    // Log the manual extension as a payment transaction for audit
    await db.paymentTransaction.create({
      data: {
        businessId,
        method: "manual",
        trxId: `ADMIN-EXTEND-${Date.now()}`,
        amount: 0,
        status: "matched",
        matchedAt: now,
        matchedBy: session.superAdminId,
        notes: `Manual extension: +${days} days${tier ? `, tier=${tier}` : ""}${reason ? `, reason: ${reason}` : ""}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Subscription extended by ${days} days${tier ? ` (tier changed to ${tier})` : ""}.`,
      newSubscriptionEnd: newEnd,
    });
  } catch (error) {
    console.error("Extend subscription error:", error);
    return NextResponse.json({ error: "Failed to extend subscription" }, { status: 500 });
  }
}
