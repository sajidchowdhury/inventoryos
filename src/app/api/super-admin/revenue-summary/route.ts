// GET /api/super-admin/revenue-summary
// P4: Monthly expected, received, outstanding, churn risk.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTierConfig } from "@/lib/feature-gate";

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

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── All active businesses (not cancelled) ──
    const businesses = await db.business.findMany({
      where: {
        subscriptionStatus: { in: ["trial", "active", "suspended"] },
        subscriptionTier: { in: ["pro", "pro_ai"] },
      },
      select: { id: true, subscriptionTier: true, subscriptionStage: true },
    });

    // ── Expected: sum of monthly prices for pro + pro_ai businesses ──
    const monthlyExpected = businesses.reduce((sum, b) => {
      return sum + getTierConfig(b.subscriptionTier).price;
    }, 0);

    // ── Received: sum of matched payments this month ──
    const receivedAgg = await db.paymentTransaction.aggregate({
      where: { status: "matched", matchedAt: { gte: monthStart } },
      _sum: { amount: true },
    });
    const monthlyReceived = receivedAgg._sum.amount ?? 0;

    // ── Outstanding ──
    const outstanding = Math.max(0, monthlyExpected - monthlyReceived);

    // ── Churn risk: businesses in expiring_soon + read_only ──
    const churnRisk = businesses.filter(
      (b) => b.subscriptionStage === "expiring_soon" || b.subscriptionStage === "read_only"
    ).length;

    // ── 6-month history (received per month) ──
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const allMatchedPayments = await db.paymentTransaction.findMany({
      where: { status: "matched", matchedAt: { gte: sixMonthsAgo } },
      select: { amount: true, matchedAt: true },
    });

    const monthlyHistory: Array<{ month: string; received: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthName = monthDate.toLocaleString("en-US", { month: "short" });
      const received = allMatchedPayments
        .filter((p) => p.matchedAt && p.matchedAt >= monthDate && p.matchedAt < nextMonth)
        .reduce((sum, p) => sum + p.amount, 0);
      monthlyHistory.push({ month: monthName, received });
    }

    return NextResponse.json({
      success: true,
      summary: {
        monthlyExpected,
        monthlyReceived,
        outstanding,
        churnRisk,
      },
      history: monthlyHistory,
    });
  } catch (error) {
    console.error("Revenue summary error:", error);
    return NextResponse.json({ error: "Failed to load revenue summary" }, { status: 500 });
  }
}
