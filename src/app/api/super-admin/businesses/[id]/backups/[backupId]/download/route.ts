// GET /api/super-admin/businesses/[id]/backups/[backupId]/download
// Download a specific tenant backup JSON file.
//
// SUPER-ADMIN ONLY — never exposed to client admin panels or main software.
//
// Streams the file with Content-Disposition: attachment so the browser
// downloads it instead of rendering it inline.
//
// Response:
//   200 — binary stream (application/json, attachment)
//   401 { error: "Unauthorized" }
//   404 { error: "Backup not found" }
//   500 { error: "Failed to read backup file" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { promises as fs } from "fs";

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
        superAdmin: { select: { id: true, isActive: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId, backupId } = await params;

  // Find the backup record
  const backup = await db.tenantBackup.findFirst({
    where: {
      id: backupId,
      businessId,
    },
    select: { id: true, fileName: true, filePath: true },
  });

  if (!backup) {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }

  try {
    // Verify file exists on disk
    await fs.access(backup.filePath);
    const fileBuffer = await fs.readFile(backup.filePath);

    // Return as a downloadable attachment
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error) {
    console.error("[backup-download] failed:", error);
    return NextResponse.json({
      error: `Backup file not readable on server: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
