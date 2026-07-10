// ── GET/POST /api/super-admin/report-scheduling/holiday-calendar ──
// List holidays (optionally filtered by year) or add a new holiday occurrence.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const upcoming = searchParams.get("upcoming") === "true";
    const unconfirmed = searchParams.get("unconfirmed") === "true";

    const where: any = {};
    if (year) where.year = parseInt(year, 10);
    if (upcoming) where.date = { gte: new Date() };
    if (unconfirmed) where.isConfirmed = false;

    const holidays = await db.holidayCalendar.findMany({
      where,
      include: { occasion: true },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ success: true, holidays });
  } catch (error) {
    console.error("[holiday-calendar] GET failed:", error);
    return NextResponse.json({ error: "Failed to load holiday calendar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { occasionId, date, isConfirmed, notes } = body;

    if (!occasionId || !date) {
      return NextResponse.json({ error: "occasionId and date are required" }, { status: 400 });
    }

    // Verify the occasion exists
    const occasion = await db.reportOccasion.findUnique({ where: { id: occasionId } });
    if (!occasion) {
      return NextResponse.json({ error: "Occasion not found" }, { status: 404 });
    }

    const dateObj = new Date(date);
    const year = dateObj.getFullYear();

    const holiday = await db.holidayCalendar.upsert({
      where: { occasionId_date: { occasionId, date: dateObj } },
      update: { isConfirmed: isConfirmed ?? false, notes: notes || null },
      create: {
        occasionId,
        date: dateObj,
        isConfirmed: isConfirmed ?? false,
        year,
        notes: notes || null,
      },
    });
    return NextResponse.json({ success: true, holiday }, { status: 201 });
  } catch (error) {
    console.error("[holiday-calendar] POST failed:", error);
    return NextResponse.json({ error: "Failed to add holiday" }, { status: 500 });
  }
}
