// ── GET /api/super-admin/report-scheduling/generated-reports/[id] ──
// Get full report content (all 4 sections parsed from JSON).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await db.generatedReport.findUnique({
      where: { id },
      include: {
        business: { select: { name: true, ownerEmail: true, ownerWhatsapp: true } },
        schedule: { select: { name: true, frequency: true } },
        deliveries: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Parse JSON fields
    return NextResponse.json({
      success: true,
      report: {
        ...report,
        spikePredictions: report.spikePredictions ? JSON.parse(report.spikePredictions) : [],
        topItems: report.topItems ? JSON.parse(report.topItems) : [],
        stockRisks: report.stockRisks ? JSON.parse(report.stockRisks) : [],
        appliedInfluences: report.appliedInfluences ? JSON.parse(report.appliedInfluences) : {},
      },
    });
  } catch (error) {
    console.error("[generated-reports/[id]] GET failed:", error);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}
