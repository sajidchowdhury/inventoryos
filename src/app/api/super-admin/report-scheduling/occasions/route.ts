// ── GET/POST /api/super-admin/report-scheduling/occasions ──
// List all occasions or create a new custom occasion.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const typeFilter = searchParams.get("type");

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (typeFilter) where.type = typeFilter;

    const occasions = await db.reportOccasion.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ success: true, occasions });
  } catch (error) {
    console.error("[occasions] GET failed:", error);
    return NextResponse.json({ error: "Failed to load occasions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, datePattern, fixedMonth, fixedDay, weeklyDayOfWeek, impactWeight, durationDays, leadDays, description } = body;

    if (!name || !type || !datePattern) {
      return NextResponse.json({ error: "name, type, and datePattern are required" }, { status: 400 });
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Validate date-pattern-specific fields
    if (datePattern === "fixed_date" && (!fixedMonth || !fixedDay)) {
      return NextResponse.json({ error: "fixed_date requires fixedMonth and fixedDay" }, { status: 400 });
    }
    if (datePattern === "recurring_weekly" && weeklyDayOfWeek === undefined) {
      return NextResponse.json({ error: "recurring_weekly requires weeklyDayOfWeek (0-6)" }, { status: 400 });
    }

    const occasion = await db.reportOccasion.create({
      data: {
        name,
        slug,
        type,
        datePattern,
        fixedMonth: fixedMonth || null,
        fixedDay: fixedDay || null,
        weeklyDayOfWeek: weeklyDayOfWeek ?? null,
        impactWeight: impactWeight ?? 1.0,
        durationDays: durationDays ?? 1,
        leadDays: leadDays ?? 0,
        description: description || null,
        isActive: true,
      },
    });
    return NextResponse.json({ success: true, occasion }, { status: 201 });
  } catch (error) {
    console.error("[occasions] POST failed:", error);
    return NextResponse.json({ error: "Failed to create occasion" }, { status: 500 });
  }
}
