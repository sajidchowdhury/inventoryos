// ── POST /api/super-admin/trigger-cron/[jobName] ──
// Manually trigger a cron job from the super-admin dashboard (useful for
// backfilling missed runs or testing a deployment).
//
// Auth: callers must authenticate via `Authorization: Bearer <superAdminToken>`.
//
// Path params:
//   jobName — one of: "nightly-stats", "hourly-subscriptions", "daily-maintenance"
//
// GET returns the job config (schedule + description) without running anything.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  runNightlyStatsJob,
  runHourlySubscriptionsJob,
  runDailyMaintenanceJob,
  CRON_JOB_SCHEDULES,
  CRON_JOB_NAMES,
  type CronJobName,
} from "@/lib/cron-jobs";

const JOB_RUNNERS: Record<CronJobName, () => Promise<void>> = {
  [CRON_JOB_NAMES.NIGHTLY_STATS]: runNightlyStatsJob,
  [CRON_JOB_NAMES.HOURLY_SUBSCRIPTIONS]: runHourlySubscriptionsJob,
  [CRON_JOB_NAMES.DAILY_MAINTENANCE]: runDailyMaintenanceJob,
};

/**
 * Verify the Bearer token belongs to an active, non-expired super-admin session.
 * Returns the session row (with superAdmin relation) on success, null otherwise.
 */
async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true,
        superAdminId: true,
        expiresAt: true,
        createdAt: true,
        superAdmin: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (
      !session ||
      !session.superAdmin.isActive ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch (err) {
    console.error("[super-admin] session lookup failed:", err);
    return null;
  }
}

// ── POST: run the requested job ──
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobName: string }> }
) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobName } = await params;
    const runner = JOB_RUNNERS[jobName as CronJobName];
    if (!runner) {
      return NextResponse.json(
        {
          error: `Unknown job name "${jobName}"`,
          validJobs: Object.values(CRON_JOB_NAMES),
        },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();
    const trigger = {
      superAdminId: session.superAdminId,
      username: session.superAdmin.username,
      fullName: session.superAdmin.fullName,
    };

    await runner();
    const finishedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      job: jobName,
      startedAt,
      finishedAt,
      triggeredBy: trigger,
      schedule: CRON_JOB_SCHEDULES[jobName as CronJobName].schedule,
    });
  } catch (error) {
    console.error("[super-admin] trigger-cron failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── GET: job config (no execution) ──
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobName: string }> }
) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobName } = await params;
    const config = CRON_JOB_SCHEDULES[jobName as CronJobName];
    if (!config) {
      return NextResponse.json(
        {
          error: `Unknown job name "${jobName}"`,
          validJobs: Object.values(CRON_JOB_NAMES),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      job: jobName,
      schedule: config.schedule,
      description: config.description,
      triggerEndpoint: "POST",
    });
  } catch (error) {
    console.error("[super-admin] trigger-cron GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch job config" },
      { status: 500 }
    );
  }
}
