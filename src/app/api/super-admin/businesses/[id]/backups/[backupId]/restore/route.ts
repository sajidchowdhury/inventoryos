// POST /api/super-admin/businesses/[id]/backups/[backupId]/restore
// Restore a tenant's data from a specific backup.
//
// SUPER-ADMIN ONLY — never exposed to client admin panels or main software.
//
// SAFETY:
//   1. The helper (deserializeTenant) auto-creates a "pre-restore" backup
//      first, so a bad restore can always be rolled back.
//   2. The wipe + re-insert runs in a single db.$transaction — the DB is
//      never left in a half-restored state.
//   3. Optional request body: { "confirmName": "Client Name" }
//      The API verifies this matches the business name before proceeding.
//      The frontend enforces this too, but the API enforces it as a second
//      line of defense against misclicks.
//
// Request body:
//   { "confirmName": string }  // must match business.name
//
// Response:
//   200 { success: true, preRestoreBackupId, recordsRestored }
//   400 { error: "Name does not match — restore aborted" }
//   401 { error: "Unauthorized" }
//   404 { error: "Backup not found" }
//   500 { success: false, errorMessage }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deserializeTenant } from "@/lib/backup";
import { checkTenantRestore } from "@/lib/backup-rate-limit";

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
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId, backupId } = await params;

  // Verify the backup exists and belongs to this business
  const backup = await db.tenantBackup.findFirst({
    where: { id: backupId, businessId },
    select: { id: true, fileName: true },
  });
  if (!backup) {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }

  // Get business name for confirmation check
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Parse body and verify confirmName matches business.name
  let confirmName = "";
  try {
    const body = await req.json();
    confirmName = String(body.confirmName || "").trim();
  } catch {
    // No body — fail
  }

  if (confirmName !== business.name.trim()) {
    return NextResponse.json({
      error: `Confirmation name does not match. Type "${business.name}" exactly to confirm restore.`,
      expectedName: business.name,
    }, { status: 400 });
  }

  // Rate limit: max 1 tenant restore per 60s per business (prevents panic-clicking)
  const rateLimit = checkTenantRestore(businessId);
  if (!rateLimit.allowed) {
    return NextResponse.json({
      error: `Rate limited — please wait ${rateLimit.retryAfterSeconds}s before restoring this client again.`,
    }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  try {
    const result = await deserializeTenant(backupId, businessId, session.superAdmin.username);

    if (result.success) {
      return NextResponse.json({
        success: true,
        preRestoreBackupId: result.preRestoreBackupId,
        recordsRestored: result.recordsRestored,
      });
    } else {
      return NextResponse.json({
        success: false,
        errorMessage: result.errorMessage,
        preRestoreBackupId: result.preRestoreBackupId,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[backup-restore] failed:", error);
    return NextResponse.json({
      success: false,
      errorMessage: `Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
