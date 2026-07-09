// GET /api/businesses/[id]/cctv/technicians/[techId]/performance
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; techId: string }> },
) {
  try {
    const { id: businessId, techId } = await params;

    const tech = await db.cCTVTechnician.findFirst({
      where: { id: techId, businessId, isActive: true },
    });
    if (!tech) return NextResponse.json({ error: "Technician not found" }, { status: 404 });

    // All job cards assigned to this technician
    const jobCards = await db.cCTVJobCard.findMany({
      where: { businessId, assignedToName: tech.displayName, isActive: true },
      select: {
        id: true, status: true, jobType: true,
        receivedAt: true, deliveredAt: true,
        satisfactionRating: true,
      },
    });

    const completedJobs = jobCards.filter((j) => j.status === "DELIVERED" && j.deliveredAt);
    const totalJobs = jobCards.length;

    // Average TAT (hours)
    let avgTatHours = 0;
    if (completedJobs.length > 0) {
      const totalMs = completedJobs.reduce((sum, j) => {
        return sum + (j.deliveredAt!.getTime() - j.receivedAt.getTime());
      }, 0);
      avgTatHours = totalMs / (completedJobs.length * 3600 * 1000);
    }
    const avgTatLabel = avgTatHours < 1
      ? `${Math.round(avgTatHours * 60)}m`
      : avgTatHours < 24
        ? `${Math.round(avgTatHours)}h`
        : `${(avgTatHours / 24).toFixed(1)}d`;

    // Total commission
    const commissions = await db.cCTVCommissionRecord.findMany({
      where: { businessId, technicianId: techId },
      select: { commissionAmount: true },
    });
    const totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);

    // Average satisfaction rating
    const ratedJobs = completedJobs.filter((j) => j.satisfactionRating != null);
    const avgRating = ratedJobs.length > 0
      ? ratedJobs.reduce((s, j) => s + j.satisfactionRating!, 0) / ratedJobs.length
      : null;

    // Job type breakdown
    const jobTypeBreakdown: Record<string, number> = {};
    for (const j of jobCards) {
      jobTypeBreakdown[j.jobType] = (jobTypeBreakdown[j.jobType] || 0) + 1;
    }

    return NextResponse.json({
      totalJobs,
      completedJobs: completedJobs.length,
      avgTatHours: Math.round(avgTatHours * 10) / 10,
      avgTatLabel,
      totalCommission: Math.round(totalCommission),
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      jobTypeBreakdown,
    });
  } catch (error) {
    console.error("Get technician performance error:", error);
    return NextResponse.json({ error: "Failed to get performance" }, { status: 500 });
  }
}