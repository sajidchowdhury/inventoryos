// ── GET/POST /api/super-admin/report-scheduling/seasons ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const seasons = await db.reportSeason.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ startMonth: "asc" }],
    });
    return NextResponse.json({ success: true, seasons });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load seasons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, startMonth, startDay, endMonth, endDay, impactWeight, affectedCategories, description } = body;

    if (!name || !startMonth || !endMonth) {
      return NextResponse.json({ error: "name, startMonth, and endMonth are required" }, { status: 400 });
    }
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
      return NextResponse.json({ error: "Months must be 1-12" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const season = await db.reportSeason.create({
      data: {
        name,
        slug,
        startMonth,
        startDay: startDay ?? 1,
        endMonth,
        endDay: endDay ?? 28,
        impactWeight: impactWeight ?? 1.0,
        affectedCategories: JSON.stringify(affectedCategories || []),
        description: description || null,
        isActive: true,
      },
    });
    return NextResponse.json({ success: true, season }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create season" }, { status: 500 });
  }
}
