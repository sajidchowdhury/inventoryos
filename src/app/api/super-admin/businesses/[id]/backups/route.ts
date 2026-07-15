// POST /api/super-admin/businesses/[id]/backups
// Create a new tenant-wise backup (JSON export of all rows for this business).
// Auto-rotates to keep only the last 7 backups per business.
//
// SUPER-ADMIN ONLY — never exposed to client admin panels or main software.
//
// Request body:
//   { "reason"?: "manual" | "pre-restore" | "pre-delete" }  // defaults to "manual"
//
// Response:
//   200 { success: true, backup: { id, fileName, fileSizeKb, recordCount, tableCount, createdAt } }
//   401 { error: "Unauthorized" }
//   404 { error: "Business not found" }
//   500 { error: "Failed to create backup" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeTenant, getAvailableDiskSpaceMb, MIN_DISK_SPACE_MB } from "@/lib/backup";
import { checkTenantBackupCreate } from "@/lib/backup-rate-limit";

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
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;

  // Verify business exists
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Parse optional reason from body
  let reason: "manual" | "pre-restore" | "pre-delete" = "manual";
  try {
    const body = await req.json();
    if (body.reason && ["manual", "pre-restore", "pre-delete"].includes(body.reason)) {
      reason = body.reason;
    }
  } catch {
    // No body or invalid JSON — use default "manual"
  }

  // Pre-flight disk space check
  const freeMb = await getAvailableDiskSpaceMb();
  if (freeMb < MIN_DISK_SPACE_MB) {
    return NextResponse.json({
      error: `Insufficient disk space: ${freeMb}MB free (need at least ${MIN_DISK_SPACE_MB}MB)`,
    }, { status: 507 });
  }

  // Rate limit: max 1 tenant backup create per 10s per business (prevents double-clicks)
  const rateLimit = checkTenantBackupCreate(businessId);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      error: `Rate limited — please wait ${rateLimit.retryAfterSeconds}s before creating another backup for this client.`,
    }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  try {
    const result = await serializeTenant(businessId, session.superAdmin.username, reason);

    // Fetch the created DB record so we can return its id
    const record = await db.tenantBackup.findFirst({
      where: { businessId, fileName: result.fileName },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, fileName: true, fileSizeKb: true,
        recordCount: true, tableCount: true, reason: true, createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      backup: record,
    });
  } catch (error) {
    console.error("[backup-create] failed:", error);
    return NextResponse.json({
      error: `Failed to create backup: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}

// GET /api/super-admin/businesses/[id]/backups
// List the last 7 backups for this business (for the history modal).
//
// Response:
//   200 { success: true, backups: [...], business: { id, name } }
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;

  const [business, backups] = await Promise.all([
    db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    }),
    db.tenantBackup.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 7,
      select: {
        id: true, fileName: true, fileSizeKb: true,
        recordCount: true, tableCount: true, reason: true,
        createdBy: true, createdAt: true,
      },
    }),
  ]);

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    business,
    backups,
  });
}
