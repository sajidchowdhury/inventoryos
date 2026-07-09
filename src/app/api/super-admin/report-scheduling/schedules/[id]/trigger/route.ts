// ── POST /api/super-admin/report-scheduling/schedules/[id]/trigger ──
// Manually trigger a schedule — generates reports for all target businesses.
// For Phase B testing, this runs synchronously for the first business and
// returns immediately. In Phase D, this will create pending rows for the
// report-generator-worker to pick up.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../../_shared";
import { generateReport } from "@/lib/report-generator";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: scheduleId } = await params;
    const body = await req.json().catch(() => ({}));
    const singleBusinessId = body.businessId; // Optional: trigger for just one business

    // Load the schedule
    const schedule = await db.reportSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Determine target businesses
    let targetBusinessIds: string[] = [];
    if (singleBusinessId) {
      targetBusinessIds = [singleBusinessId];
    } else if (schedule.targetClientMode === "all") {
      const businesses = await db.business.findMany({
        where: { isActive: true, subscriptionTier: "pro_ai" },
        select: { id: true },
      });
      targetBusinessIds = businesses.map((b) => b.id);
    } else {
      targetBusinessIds = JSON.parse(schedule.targetClientIds || "[]");
    }

    if (targetBusinessIds.length === 0) {
      return NextResponse.json({ error: "No target businesses found for this schedule" }, { status: 400 });
    }

    // For Phase B: generate reports synchronously for up to 3 businesses
    // (to avoid timeout). In Phase D, this will create pending rows for the worker.
    const businessesToProcess = targetBusinessIds.slice(0, 3);
    const results: any[] = [];

    for (const businessId of businessesToProcess) {
      try {
        const result = await generateReport({
          businessId,
          scheduleId,
          reportPeriodDays: schedule.reportPeriodDays,
          considerSeasons: schedule.considerSeasons,
          considerEpidemics: schedule.considerEpidemics,
        });
        results.push({
          businessId,
          success: result.success,
          reportId: result.reportId,
          fallbackUsed: result.fallbackUsed,
          errorMessage: result.errorMessage,
          aiTokensUsed: result.aiTokensUsed,
          aiCostEstimate: result.aiCostEstimate,
        });
      } catch (err) {
        results.push({
          businessId,
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Update schedule's lastRunAt
    await db.reportSchedule.update({
      where: { id: scheduleId },
      data: { lastRunAt: new Date() },
    });

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      success: true,
      scheduleId,
      totalTarget: targetBusinessIds.length,
      processed: businessesToProcess.length,
      succeeded,
      failed,
      results,
      message: targetBusinessIds.length > 3
        ? `Processed first 3 of ${targetBusinessIds.length} businesses. In Phase D, all will be processed by the background worker.`
        : `Processed all ${targetBusinessIds.length} businesses.`,
    });
  } catch (error) {
    console.error("[trigger] failed:", error);
    return NextResponse.json({ error: "Failed to trigger schedule" }, { status: 500 });
  }
}
