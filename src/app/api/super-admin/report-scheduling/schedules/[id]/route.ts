// ── GET/PUT/DELETE /api/super-admin/report-scheduling/schedules/[id] ──
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const schedule = await db.reportSchedule.findUnique({ where: { id } });
  if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  return NextResponse.json({ success: true, schedule });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = ["name", "description", "frequency", "dayOfWeek", "dayOfMonth", "startDate", "endDate",
      "occasions", "considerSeasons", "considerEpidemics", "targetClientMode", "targetClientIds",
      "deliveryChannels", "reportPeriodDays", "isActive"];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "occasions" || key === "targetClientIds" || key === "deliveryChannels") {
          data[key] = JSON.stringify(body[key]);
        } else if (key === "startDate" || key === "endDate") {
          data[key] = body[key] ? new Date(body[key]) : null;
        } else {
          data[key] = body[key];
        }
      }
    }
    const schedule = await db.reportSchedule.update({ where: { id }, data });
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.reportSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
