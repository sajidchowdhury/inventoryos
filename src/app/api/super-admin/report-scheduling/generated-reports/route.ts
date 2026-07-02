// ── GET /api/super-admin/report-scheduling/generated-reports ──
// List generated reports with filters.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get("scheduleId");
    const businessId = searchParams.get("businessId");
    const status = searchParams.get("status");
    const businessTypeId = searchParams.get("businessTypeId"); // Phase 6
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const where: any = {};
    if (scheduleId) where.scheduleId = scheduleId;
    if (businessId) where.businessId = businessId;
    if (status) where.generationStatus = status;
    // Phase 6: filter by business type via the business relation
    if (businessTypeId) {
      where.business = { businessTypeId };
    }

    const [reports, total] = await Promise.all([
      db.generatedReport.findMany({
        where,
        include: {
          business: { select: { name: true, subscriptionTier: true } },
          schedule: { select: { name: true } },
        },
        orderBy: { reportDate: "desc" },
        take: limit,
        skip: offset,
      }),
      db.generatedReport.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      reports,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[generated-reports] GET failed:", error);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }
}
