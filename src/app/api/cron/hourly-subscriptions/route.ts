// ── POST /api/cron/hourly-subscriptions ──
// Triggered by an external scheduler at the top of every hour.
// Auto-suspends businesses whose subscriptionEnd has passed.
//
// Auth: callers must send `x-cron-secret: <CRON_SECRET>` header.
//   - CRON_SECRET env var must be set to a non-default value (we refuse the
//     placeholder "change-me" so a forgotten env var never opens this route).
//
// GET returns schedule metadata so operators can confirm the endpoint exists.

import { NextRequest, NextResponse } from "next/server";
import {
  runHourlySubscriptionsJob,
  CRON_JOB_SCHEDULES,
  CRON_JOB_NAMES,
} from "@/lib/cron-jobs";

const JOB_NAME = CRON_JOB_NAMES.HOURLY_SUBSCRIPTIONS;
const DEFAULT_PLACEHOLDER_VALUES = new Set([
  "",
  "change-me",
  "changeme",
  "placeholder",
  "your-secret-here",
  "replace-me",
]);

/**
 * Validate the x-cron-secret header against process.env.CRON_SECRET.
 * Returns an error response if missing, default-placeholder, or mismatched.
 */
function verifyCronSecret(req: NextRequest): NextResponse | null {
  const configured = process.env.CRON_SECRET;
  if (!configured || DEFAULT_PLACEHOLDER_VALUES.has(configured)) {
    console.error(
      "[cron] CRON_SECRET is not configured (or is a default placeholder). Refusing to run."
    );
    return NextResponse.json(
      { error: "Cron secret is not configured on the server." },
      { status: 503 }
    );
  }

  const supplied = req.headers.get("x-cron-secret");
  if (!supplied || supplied !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ── POST: run the job ──
export async function POST(req: NextRequest) {
  try {
    const authError = verifyCronSecret(req);
    if (authError) return authError;

    const startedAt = new Date().toISOString();
    await runHourlySubscriptionsJob();
    const finishedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      job: JOB_NAME,
      startedAt,
      finishedAt,
      schedule: CRON_JOB_SCHEDULES[JOB_NAME].schedule,
    });
  } catch (error) {
    console.error("[cron] hourly-subscriptions failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, job: JOB_NAME, error: message },
      { status: 500 }
    );
  }
}

// ── GET: schedule info (no auth — purely informational) ──
export async function GET() {
  try {
    return NextResponse.json({
      job: JOB_NAME,
      schedule: CRON_JOB_SCHEDULES[JOB_NAME].schedule,
      description: CRON_JOB_SCHEDULES[JOB_NAME].description,
      method: "POST",
      auth: "x-cron-secret header required for POST",
    });
  } catch (error) {
    console.error("[cron] hourly-subscriptions GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
