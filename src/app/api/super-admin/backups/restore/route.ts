// POST /api/super-admin/backups/restore
// Restore the full database from an uploaded pg_dump custom-format file.
//
// SUPER-ADMIN ONLY — never exposed to client admin panels or main software.
//
// SAFETY:
//   1. The helper (runSystemRestore) auto-creates a "pre-restore" backup first.
//   2. The helper validates PGDMP magic bytes — rejects fake/corrupt files.
//   3. The API requires a "confirmPhrase" form field that must equal "RESTORE ALL".
//      The frontend enforces this too, but the API enforces it as a second
//      line of defense against misclicks.
//
// Request: multipart/form-data with:
//   - file: the .sql file (pg_dump custom format)
//   - confirmPhrase: must equal "RESTORE ALL" (case-sensitive, exact match)
//
// Response:
//   200 { success: true, preRestoreBackupId }
//   400 { error: "Confirmation phrase does not match..." | "No file uploaded" }
//   401 { error: "Unauthorized" }
//   500 { success: false, errorMessage }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSystemRestore, SYSTEM_BACKUP_DIR } from "@/lib/backup";
import { checkSystemRestore } from "@/lib/backup-rate-limit";
import { promises as fs } from "fs";
import path from "path";

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

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const confirmPhrase = (formData.get("confirmPhrase") as string || "").trim();

    // Safety check 1: confirmation phrase must match exactly
    if (confirmPhrase !== "RESTORE ALL") {
      return NextResponse.json({
        error: 'Confirmation phrase does not match. Type "RESTORE ALL" exactly to confirm.',
      }, { status: 400 });
    }

    // Safety check 2: file must be present
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded. Select a .sql backup file." }, { status: 400 });
    }

    // Safety check 3: file size sanity (reject > 5GB)
    if (file.size > 5 * 1024 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (>5GB). Refusing to restore." }, { status: 400 });
    }

    // Safety check 4: rate limit — max 1 system restore per 5 min (global, most dangerous op)
    const rateLimit = checkSystemRestore();
    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: `Rate limited — system restore is limited to 1 per 5 minutes. Please wait ${rateLimit.retryAfterSeconds}s and try again.`,
      }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    }

    // Save the uploaded file to /backups/db/uploads/ (temp location)
    const uploadsDir = path.join(SYSTEM_BACKUP_DIR, "uploads");
    await fs.mkdir(uploadsDir, { recursive: true, mode: 0o700 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const tempFileName = `uploaded_${timestamp}.sql`;
    const tempFilePath = path.join(uploadsDir, tempFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempFilePath, buffer, { mode: 0o600 });

    // Safety check 5: magic bytes validation (done inside runSystemRestore)
    const result = await runSystemRestore(tempFilePath, session.superAdmin.username);

    // Clean up the uploaded temp file (we don't keep it around)
    try {
      await fs.unlink(tempFilePath);
    } catch {
      // ignore
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        preRestoreBackupId: result.preRestoreBackupId,
      });
    } else {
      return NextResponse.json({
        success: false,
        errorMessage: result.errorMessage,
        preRestoreBackupId: result.preRestoreBackupId,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[system-backup-restore] failed:", error);
    return NextResponse.json({
      success: false,
      errorMessage: `Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
