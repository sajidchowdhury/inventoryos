// ── POST /api/cron/report-schedule-checker ──
// Phase C: Checks all active report schedules and creates pending reports for due ones.
// Triggered by an external scheduler every 15 minutes.
//
// Auth: x-cron-secret header OR super-admin Bearer token (same as other cron endpoints).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  runReportScheduleCheckerJob,
  CRON_JOB_SCHEDULES,
  CRON_JOB_NAMES,
} from "@/lib/cron-jobs";

const JOB_NAME = CRON_JOB_NAMES.REPORT_SCHEDULE_CHECKER;
const DEFAULT_PLACEHOLDER_VALUES = new Set([
  "", "change-me", "changeme", "placeholder", "your-secret-here", "replace-me",
]);

async function verifyAuth(req: NextRequest): Promise<NextResponse | null> {
  // Try cron secret
  const configured = process.env.CRON_SECRET;
  const suppliedSecret = req.headers.get("x-cron-secret");
  if (configured && !DEFAULT_PLACEHOLDER_VALUES.has(configured) && suppliedSecret === configured) {
    return null;
  }

  // Fall back to super-admin Bearer token
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const token = match[1].trim();
    try {
      const session = await db.superAdminSession.findUnique({
        where: { token },
        select: { superAdminId: true, expiresAt: true, superAdmin: { select: { isActive: true } } },
      });
      if (session && session.superAdmin.isActive && session.expiresAt.getTime() > Date.now()) {
        return null;
      }
    } catch {}
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  try {
    const authError = await verifyAuth(req);
    if (authError) return authError;

    const startedAt = new Date().toISOString();
    await runReportScheduleCheckerJob();
    const finishedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      job: JOB_NAME,
      startedAt,
      finishedAt,
      schedule: CRON_JOB_SCHEDULES[JOB_NAME].schedule,
      message: "Schedule checker complete. Pending reports created for due schedules.",
    });
  } catch (error) {
    console.error("[cron] report-schedule-checker failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, job: JOB_NAME, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    job: JOB_NAME,
    schedule: CRON_JOB_SCHEDULES[JOB_NAME].schedule,
    description: CRON_JOB_SCHEDULES[JOB_NAME].description,
    method: "POST",
    auth: "x-cron-secret header OR Authorization: Bearer <superAdminToken>",
  });
}
