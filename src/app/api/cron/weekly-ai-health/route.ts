// ── POST /api/cron/weekly-ai-health ──
// Phase 5: Sends the weekly AI health summary email to all notification recipients.
// Triggered by an external scheduler (Vercel Cron, systemd timer, k8s CronJob)
// at 06:00 UTC every Monday.
//
// Auth: callers must send EITHER:
//   - `x-cron-secret: <CRON_SECRET>` header (for external schedulers), OR
//   - `Authorization: Bearer <superAdminToken>` header (for manual trigger from /admin)
//
// GET returns schedule metadata so operators can confirm the endpoint exists.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  runWeeklyAiHealthJob,
  CRON_JOB_SCHEDULES,
  CRON_JOB_NAMES,
} from "@/lib/cron-jobs";

const JOB_NAME = CRON_JOB_NAMES.WEEKLY_AI_HEALTH;
const DEFAULT_PLACEHOLDER_VALUES = new Set([
  "",
  "change-me",
  "changeme",
  "placeholder",
  "your-secret-here",
  "replace-me",
]);

/**
 * Verify either the cron secret OR a super-admin Bearer token.
 * Returns null on success, or an error response on failure.
 */
async function verifyAuth(req: NextRequest): Promise<NextResponse | null> {
  // ── Try cron secret first ──
  const configured = process.env.CRON_SECRET;
  const suppliedSecret = req.headers.get("x-cron-secret");
  if (configured && !DEFAULT_PLACEHOLDER_VALUES.has(configured) && suppliedSecret === configured) {
    return null; // auth success via cron secret
  }

  // ── Fall back to super-admin Bearer token ──
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const token = match[1].trim();
    try {
      const session = await db.superAdminSession.findUnique({
        where: { token },
        select: {
          superAdminId: true, expiresAt: true,
          superAdmin: { select: { isActive: true } },
        },
      });
      if (session && session.superAdmin.isActive && session.expiresAt.getTime() > Date.now()) {
        return null; // auth success via super-admin token
      }
    } catch {
      // fall through to unauthorized
    }
  }

  // ── Neither auth method succeeded ──
  if (!configured || DEFAULT_PLACEHOLDER_VALUES.has(configured)) {
    return NextResponse.json(
      { error: "Auth required: send x-cron-secret header (CRON_SECRET not configured) OR Authorization: Bearer <superAdminToken>" },
      { status: 401 }
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// ── POST: run the job ──
export async function POST(req: NextRequest) {
  try {
    const authError = await verifyAuth(req);
    if (authError) return authError;

    const startedAt = new Date().toISOString();
    await runWeeklyAiHealthJob();
    const finishedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      job: JOB_NAME,
      startedAt,
      finishedAt,
      schedule: CRON_JOB_SCHEDULES[JOB_NAME].schedule,
      message: "Weekly AI health email sent to all notification recipients (or logged if no recipients configured).",
    });
  } catch (error) {
    console.error("[cron] weekly-ai-health failed:", error);
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
      auth: "x-cron-secret header OR Authorization: Bearer <superAdminToken>",
    });
  } catch (error) {
    console.error("[cron] weekly-ai-health GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
