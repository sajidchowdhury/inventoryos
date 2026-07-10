// ── GET/PUT/DELETE /api/super-admin/report-scheduling/occasions/[id] ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const occasion = await db.reportOccasion.findUnique({
    where: { id },
    include: { holidayCalendar: { orderBy: { date: "asc" } } },
  });
  if (!occasion) return NextResponse.json({ error: "Occasion not found" }, { status: 404 });
  return NextResponse.json({ success: true, occasion });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = ["name", "type", "datePattern", "fixedMonth", "fixedDay", "weeklyDayOfWeek", "impactWeight", "durationDays", "leadDays", "description", "isActive"];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const occasion = await db.reportOccasion.update({ where: { id }, data });
    return NextResponse.json({ success: true, occasion });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update occasion" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  // Refuse delete if occasion has holiday calendar entries
  const count = await db.holidayCalendar.count({ where: { occasionId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: occasion has ${count} holiday calendar entries. Deactivate it instead.` },
      { status: 400 }
    );
  }
  await db.reportOccasion.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
