// GET /api/super-admin/backups/audit-log
// List recent backup/restore actions from BackupAuditLog.
//
// SUPER-ADMIN ONLY — never exposed to client admin panels or main software.
//
// Query params:
//   ?limit=20  — max 100, default 20
//   ?scope=    — 'tenant' | 'system' | undefined (all)
//   ?action=   — 'backup' | 'restore' | undefined (all)
//
// Response:
//   200 { success: true, logs: [...] }
//   401 { error: "Unauthorized" }
//   500 { error: "Failed to fetch audit log" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const scope = url.searchParams.get("scope"); // 'tenant' | 'system' | null
    const action = url.searchParams.get("action"); // 'backup' | 'restore' | null

    const where: { scope?: string; action?: string } = {};
    if (scope && ["tenant", "system"].includes(scope)) where.scope = scope;
    if (action && ["backup", "restore"].includes(action)) where.action = action;

    const logs = await db.backupAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        scope: true,
        businessId: true,
        fileName: true,
        status: true,
        durationMs: true,
        recordCount: true,
        fileSizeKb: true,
        errorMessage: true,
        triggeredBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("[audit-log] failed:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
