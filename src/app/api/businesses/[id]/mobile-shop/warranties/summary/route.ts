// GET /api/businesses/[id]/mobile-shop/warranties/summary
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// GET: Warranty statistics
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get("days") || "90", 10) || 90;

    const now = new Date();
    const expiringThreshold = new Date(now.getTime() + days * MS_PER_DAY);

    // Count warranty serial items by computed status
    const [active, expiringSoon, expired, total] = await Promise.all([
      // ACTIVE: warrantyEnd > now + days
      db.mSSerialItem.count({
        where: {
          businessId,
          isActive: true,
          warrantyEnd: { gt: expiringThreshold },
          status: { in: ["SOLD", "WARRANTY_ACTIVE", "WARRANTY_EXPIRED", "INSTALLED"] },
        },
      }),
      // EXPIRING_SOON: warrantyEnd > now AND warrantyEnd <= now + days
      db.mSSerialItem.count({
        where: {
          businessId,
          isActive: true,
          warrantyEnd: { gt: now, lte: expiringThreshold },
          status: { in: ["SOLD", "WARRANTY_ACTIVE", "WARRANTY_EXPIRED", "INSTALLED"] },
        },
      }),
      // EXPIRED: warrantyEnd <= now
      db.mSSerialItem.count({
        where: {
          businessId,
          isActive: true,
          warrantyEnd: { lte: now },
          status: { in: ["SOLD", "WARRANTY_ACTIVE", "WARRANTY_EXPIRED", "INSTALLED"] },
        },
      }),
      // Total (any sold/installed with warrantyEnd set)
      db.mSSerialItem.count({
        where: {
          businessId,
          isActive: true,
          warrantyEnd: { not: null },
          status: { in: ["SOLD", "WARRANTY_ACTIVE", "WARRANTY_EXPIRED", "INSTALLED"] },
        },
      }),
    ]);

    // Count warranty claims by status
    const [pending, approved, inProgress, completed, rejected] = await Promise.all([
      db.mSWarrantyClaim.count({ where: { businessId, isActive: true, status: "PENDING" } }),
      db.mSWarrantyClaim.count({ where: { businessId, isActive: true, status: "APPROVED" } }),
      db.mSWarrantyClaim.count({ where: { businessId, isActive: true, status: "IN_PROGRESS" } }),
      db.mSWarrantyClaim.count({ where: { businessId, isActive: true, status: "COMPLETED" } }),
      db.mSWarrantyClaim.count({ where: { businessId, isActive: true, status: "REJECTED" } }),
    ]);

    return NextResponse.json({
      active,
      expiringSoon,
      expired,
      total,
      claims: {
        pending,
        approved,
        inProgress,
        completed,
        rejected,
      },
    });
  } catch (error) {
    console.error("Warranty summary error:", error);
    return NextResponse.json({ error: "Failed to get warranty summary" }, { status: 500 });
  }
}