// ── POST /api/cron/subscription-lifecycle ──
// P2: Transitions businesses through the 4-stage subscription lifecycle.
// Triggered daily at 02:00 UTC by an external scheduler.
//
// Auth: x-cron-secret header OR Authorization: Bearer <superAdminToken>

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  runSubscriptionLifecycleJob,
  CRON_JOB_SCHEDULES,
  CRON_JOB_NAMES,
} from "@/lib/cron-jobs";

const JOB_NAME = CRON_JOB_NAMES.SUBSCRIPTION_LIFECYCLE;
const DEFAULT_PLACEHOLDER_VALUES = new Set([
  "", "change-me", "changeme", "placeholder", "your-secret-here", "replace-me",
]);

async function verifyAuth(req: NextRequest): Promise<NextResponse | null> {
  const configured = process.env.CRON_SECRET;
  const suppliedSecret = req.headers.get("x-cron-secret");
  if (configured && !DEFAULT_PLACEHOLDER_VALUES.has(configured) && suppliedSecret === configured) {
    return null;
  }
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
    } catch { /* fall through */ }
  }
  if (!configured || DEFAULT_PLACEHOLDER_VALUES.has(configured)) {
    return NextResponse.json(
      { error: "Auth required: send x-cron-secret header OR Authorization: Bearer <superAdminToken>" },
      { status: 401 }
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  try {
    const authError = await verifyAuth(req);
    if (authError) return authError;

    const startedAt = new Date().toISOString();
    await runSubscriptionLifecycleJob();
    const finishedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      job: JOB_NAME,
      startedAt,
      finishedAt,
      schedule: CRON_JOB_SCHEDULES[JOB_NAME].schedule,
      message: "Subscription lifecycle job completed. Businesses transitioned through 4 stages.",
    });
  } catch (error) {
    console.error("[cron] subscription-lifecycle failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, job: JOB_NAME, error: message }, { status: 500 });
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
