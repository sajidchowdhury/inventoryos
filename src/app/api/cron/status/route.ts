// ── GET /api/cron/status ──
// Returns the status of all cron jobs: latest run, total runs, recent failures.
//
// Auth: callers must authenticate via EITHER:
//   - `x-cron-secret: <CRON_SECRET>` header (machine-to-machine), OR
//   - `Authorization: Bearer <superAdminToken>` (super-admin dashboard)
//
// If CRON_SECRET is unset or a default placeholder, only the super-admin
// Bearer token path is accepted (we don't refuse the request entirely — the
// super admin should still be able to inspect job status while bootstrapping).

import { NextRequest, NextResponse } from "next/server";
import { getCronJobStatuses, CRON_JOB_SCHEDULES } from "@/lib/cron-jobs";
import { db } from "@/lib/db";

const DEFAULT_PLACEHOLDER_VALUES = new Set([
  "",
  "change-me",
  "changeme",
  "placeholder",
  "your-secret-here",
  "replace-me",
]);

/**
 * Verify the request is authorized by EITHER the cron secret OR a super-admin
 * session token. Returns true if authorized, false otherwise.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  // ── Path 1: x-cron-secret header ──
  const configured = process.env.CRON_SECRET;
  const suppliedSecret = req.headers.get("x-cron-secret");
  if (
    configured &&
    !DEFAULT_PLACEHOLDER_VALUES.has(configured) &&
    suppliedSecret &&
    suppliedSecret === configured
  ) {
    return true;
  }

  // ── Path 2: Bearer super-admin token ──
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const token = match[1].trim();
    try {
      const session = await db.superAdminSession.findUnique({
        where: { token },
        select: {
          id: true,
          expiresAt: true,
          superAdmin: { select: { id: true, isActive: true } },
        },
      });
      if (
        session &&
        session.superAdmin.isActive &&
        session.expiresAt.getTime() > Date.now()
      ) {
        return true;
      }
    } catch (err) {
      console.error("[cron/status] super-admin session lookup failed:", err);
    }
  }

  return false;
}

// ── GET: job statuses ──
export async function GET(req: NextRequest) {
  try {
    const ok = await isAuthorized(req);
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const statuses = await getCronJobStatuses();

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      jobs: statuses,
      schedules: CRON_JOB_SCHEDULES,
    });
  } catch (error) {
    console.error("[cron/status] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron job statuses" },
      { status: 500 }
    );
  }
}
