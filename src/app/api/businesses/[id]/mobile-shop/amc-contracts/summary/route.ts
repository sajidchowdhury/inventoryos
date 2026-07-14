// GET /api/businesses/[id]/mobile-shop/amc-contracts/summary
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// GET: AMC summary statistics
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    const now = new Date();
    const nowMs = now.getTime();
    const thirtyDaysMs = nowMs + 30 * MS_PER_DAY;
    const sixtyDaysMs = nowMs + 60 * MS_PER_DAY;

    // Fetch all active contracts to compute statuses in memory
    const allContracts = await db.mSAmcContract.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalAmount: true,
        totalRevenue: true,
        status: true,
      },
    });

    // Compute statuses
    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let totalAnnualRevenue = 0;
    let totalRevenueCollected = 0;
    const upcomingRenewals: {
      id: string;
      clientName: string;
      contractCode: string;
      endDate: Date;
      totalAmount: number;
    }[] = [];

    for (const contract of allContracts) {
      const endMs = new Date(contract.endDate).getTime();
      let computedStatus: string;

      if (endMs <= nowMs) {
        computedStatus = "EXPIRED";
      } else if (endMs <= thirtyDaysMs) {
        computedStatus = "EXPIRING_SOON";
      } else {
        computedStatus = "ACTIVE";
      }

      // If the stored status differs, fire-and-forget update
      if (computedStatus !== contract.status && contract.status !== "CANCELLED") {
        db.mSAmcContract
          .update({ where: { id: contract.id }, data: { status: computedStatus } })
          .catch(() => {});
      }

      // Use stored status if CANCELLED, otherwise computed
      const effectiveStatus = contract.status === "CANCELLED" ? "CANCELLED" : computedStatus;

      switch (effectiveStatus) {
        case "ACTIVE":
          activeCount++;
          break;
        case "EXPIRING_SOON":
          expiringSoonCount++;
          break;
        case "EXPIRED":
          expiredCount++;
          break;
      }

      // Track upcoming renewals: contracts ending in 30-60 days (ACTIVE only, not expired or expiring soon)
      if (endMs > thirtyDaysMs && endMs <= sixtyDaysMs && effectiveStatus === "ACTIVE") {
        // We need more fields for the renewal list, so fetch those separately
        upcomingRenewals.push({
          id: contract.id,
          clientName: "", // Will be populated below
          contractCode: "", // Will be populated below
          endDate: contract.endDate,
          totalAmount: contract.totalAmount,
        });
      }
    }

    // Annual revenue: sum of totalAmount for ACTIVE + EXPIRING_SOON
    const revenueContracts = allContracts.filter((c) => {
      const endMs = new Date(c.endDate).getTime();
      const computed = endMs <= nowMs ? "EXPIRED" : endMs <= thirtyDaysMs ? "EXPIRING_SOON" : "ACTIVE";
      const effective = c.status === "CANCELLED" ? "CANCELLED" : computed;
      return effective === "ACTIVE" || effective === "EXPIRING_SOON";
    });
    totalAnnualRevenue = revenueContracts.reduce((sum, c) => sum + c.totalAmount, 0);

    // Total revenue collected
    totalRevenueCollected = allContracts.reduce((sum, c) => sum + c.totalRevenue, 0);

    // Fetch details for upcoming renewals (30-60 day window)
    if (upcomingRenewals.length > 0) {
      const renewalIds = upcomingRenewals.map((r) => r.id);
      const renewalDetails = await db.mSAmcContract.findMany({
        where: { id: { in: renewalIds }, businessId, isActive: true },
        select: {
          id: true,
          clientName: true,
          contractCode: true,
          endDate: true,
          totalAmount: true,
        },
        orderBy: { endDate: "asc" },
      });

      // Map back
      const detailMap = new Map(renewalDetails.map((d) => [d.id, d]));
      for (const r of upcomingRenewals) {
        const detail = detailMap.get(r.id);
        if (detail) {
          r.clientName = detail.clientName;
          r.contractCode = detail.contractCode;
        }
      }
    }

    return NextResponse.json({
      totalActiveContracts: activeCount,
      totalExpiringSoon: expiringSoonCount,
      totalExpired: expiredCount,
      totalAnnualRevenue,
      totalRevenueCollected,
      upcomingRenewals: upcomingRenewals.sort(
        (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      ),
    });
  } catch (error) {
    console.error("AMC summary error:", error);
    return NextResponse.json({ error: "Failed to get AMC summary" }, { status: 500 });
  }
}