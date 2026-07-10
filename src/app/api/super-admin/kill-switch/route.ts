// ── GET /api/super-admin/kill-switch ──
// List active kill-switches + recent history.
// Auth: super-admin Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveKillSwitches, getKillSwitchHistory } from "@/lib/ai-kill-switch";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        superAdminId: true, expiresAt: true,
        superAdmin: { select: { id: true, isActive: true, username: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [active, history] = await Promise.all([
      getActiveKillSwitches(),
      getKillSwitchHistory(20),
    ]);
    return NextResponse.json({ success: true, active, history });
  } catch (error) {
    console.error("[kill-switch] GET failed:", error);
    return NextResponse.json({ error: "Failed to load kill-switch data" }, { status: 500 });
  }
}
