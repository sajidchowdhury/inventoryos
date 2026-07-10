// ── POST /api/super-admin/kill-switch/[id]/reset ──
// Reset (deactivate) a kill-switch. Super-admin only.
// Body: { notes?: string } — optional note about why it was reset.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetKillSwitch } from "@/lib/ai-kill-switch";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const notes = body.notes || `Reset by ${session.superAdmin.username}`;

    // Verify the kill-switch exists and is active
    const ks = await db.killSwitch.findUnique({ where: { id } });
    if (!ks) {
      return NextResponse.json({ error: "Kill-switch not found" }, { status: 404 });
    }
    if (!ks.isActive) {
      return NextResponse.json({ error: "Kill-switch is already inactive" }, { status: 400 });
    }

    await resetKillSwitch(id, session.superAdmin.username, notes);
    return NextResponse.json({ success: true, message: "Kill-switch reset successfully" });
  } catch (error) {
    console.error("[kill-switch/reset] failed:", error);
    return NextResponse.json({ error: "Failed to reset kill-switch" }, { status: 500 });
  }
}
