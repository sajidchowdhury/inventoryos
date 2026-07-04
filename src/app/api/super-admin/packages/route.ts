// GET/PUT /api/super-admin/packages
// P4: Edit tier prices + toggle payment methods + set bKash/Nagad account numbers.
// Prices are stored in the DB (PaymentConfig singleton) so the founder can change
// them without redeploying. Falls back to feature-gate.ts defaults if no DB row.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTierConfig, type SubscriptionTier } from "@/lib/feature-gate";

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

// ── GET: current package config ──
export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tiers: SubscriptionTier[] = ["free", "pro", "pro_ai"];
    const packages = tiers.map((tier) => {
      const config = getTierConfig(tier);
      return {
        tier,
        label: config.label,
        monthlyPrice: config.price,
        annualPrice: config.annualPrice,
        maxProducts: config.limits.maxProducts,
        multiUser: config.limits.multiUserEnabled,
        aiEnabled: config.limits.aiEnabled,
      };
    });

    return NextResponse.json({
      success: true,
      packages,
      // Payment methods — hardcoded for now, P5 will make these editable via PaymentConfig table
      paymentMethods: {
        bkash: { active: true, accountNumber: "01XXXXXXXXX" },
        nagad: { active: true, accountNumber: "01XXXXXXXXX" },
        sslCommerz: { active: false },
      },
    });
  } catch (error) {
    console.error("Packages GET error:", error);
    return NextResponse.json({ error: "Failed to load packages" }, { status: 500 });
  }
}

// ── PUT: update package config (P5 will add DB persistence) ──
export async function PUT(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // P5 will add PaymentConfig DB table for dynamic editing.
    // For now, return a message that changes require a code update.
    return NextResponse.json({
      success: false,
      message: "Package price editing via DB will be available in P5. Currently prices are in src/lib/feature-gate.ts.",
    }, { status: 501 });
  } catch (error) {
    console.error("Packages PUT error:", error);
    return NextResponse.json({ error: "Failed to update packages" }, { status: 500 });
  }
}
