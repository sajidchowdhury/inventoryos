// ── GET / PUT /api/super-admin/kill-switch/thresholds ──
// Read and update the 4 kill-switch trigger thresholds.
// Auth: super-admin Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAllThresholds,
  updateKillSwitchThreshold,
  KILL_SWITCH_DEFAULTS,
  type KillSwitchTrigger,
} from "@/lib/ai-kill-switch";

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

const VALID_TRIGGERS: KillSwitchTrigger[] = [
  "per_pharmacy_monthly", "per_pharmacy_24h", "platform_monthly", "zai_error_rate",
];

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const thresholds = await getAllThresholds();
    return NextResponse.json({ success: true, thresholds, defaults: KILL_SWITCH_DEFAULTS });
  } catch (error) {
    console.error("[kill-switch/thresholds] GET failed:", error);
    return NextResponse.json({ error: "Failed to load thresholds" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { trigger, threshold, isActive } = body;
    if (!trigger || !VALID_TRIGGERS.includes(trigger)) {
      return NextResponse.json({ error: `Invalid trigger. Must be one of: ${VALID_TRIGGERS.join(", ")}` }, { status: 400 });
    }
    if (typeof threshold !== "number" || threshold < 0) {
      return NextResponse.json({ error: "Threshold must be a non-negative number" }, { status: 400 });
    }
    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
    }
    const updated = await updateKillSwitchThreshold(
      trigger as KillSwitchTrigger, threshold, isActive, session.superAdmin.username
    );
    return NextResponse.json({ success: true, threshold: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
