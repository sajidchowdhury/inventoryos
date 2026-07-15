// POST /api/super-admin/backups
// Create a new system-wide backup (pg_dump of the entire database).
// Auto-rotates to keep only the last 10 system backups.
//
// SUPER-ADMIN ONLY — never exposed to client admin panels or main software.
//
// Request body:
//   { "reason"?: "manual" | "pre-restore" | "scheduled" }  // defaults to "manual"
//
// Response:
//   200 { success: true, backup: { ... } }
//   401 { error: "Unauthorized" }
//   500 { error: "Failed to create backup" }
//   507 { error: "Insufficient disk space..." }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSystemDump, getAvailableDiskSpaceMb, MIN_DISK_SPACE_MB } from "@/lib/backup";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        superAdminId: true,
        expiresAt: true,
        superAdmin: { select: { id: true, isActive: true, username: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function POST(
  req: NextRequest,
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let reason: "manual" | "pre-restore" | "scheduled" = "manual";
  try {
    const body = await req.json();
    if (body.reason && ["manual", "pre-restore", "scheduled"].includes(body.reason)) {
      reason = body.reason;
    }
  } catch {
    // No body — use default "manual"
  }

  const freeMb = await getAvailableDiskSpaceMb();
  if (freeMb < MIN_DISK_SPACE_MB) {
    return NextResponse.json({
      error: `Insufficient disk space: ${freeMb}MB free (need at least ${MIN_DISK_SPACE_MB}MB)`,
    }, { status: 507 });
  }

  try {
    const result = await runSystemDump(session.superAdmin.username, reason);

    const record = await db.systemBackup.findFirst({
      where: { fileName: result.fileName },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, fileName: true, fileSizeKb: true,
        format: true, reason: true, createdBy: true, createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      backup: record,
    });
  } catch (error) {
    console.error("[system-backup-create] failed:", error);
    return NextResponse.json({
      error: `Failed to create system backup: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}

// GET /api/super-admin/backups
// List the last 10 system backups (for the dashboard card).
export async function GET(
  req: NextRequest,
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backups = await db.systemBackup.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true, fileName: true, fileSizeKb: true,
      format: true, reason: true, createdBy: true, createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    backups,
  });
}
