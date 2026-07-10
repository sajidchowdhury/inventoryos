// ── GET/POST /api/super-admin/report-scheduling/epidemics ──
// List epidemic alerts or declare a new one.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
      where.startDate = { lte: new Date() };
      where.endDate = { gte: new Date() };
    } else if (!includeInactive) {
      where.isActive = true;
    }

    const epidemics = await db.epidemicAlert.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    });
    return NextResponse.json({ success: true, epidemics });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load epidemics" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, diseaseType, severity, impactWeight, affectedCategories, affectedProducts, startDate, endDate, notes } = body;

    if (!name || !diseaseType || !startDate || !endDate) {
      return NextResponse.json({ error: "name, diseaseType, startDate, and endDate are required" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    const epidemic = await db.epidemicAlert.create({
      data: {
        name,
        slug,
        diseaseType,
        severity: severity || "moderate",
        impactWeight: impactWeight ?? 2.0,
        affectedCategories: JSON.stringify(affectedCategories || []),
        affectedProducts: JSON.stringify(affectedProducts || []),
        startDate: start,
        endDate: end,
        isActive: true,
        declaredBy: session.superAdmin.username,
        notes: notes || null,
      },
    });
    return NextResponse.json({ success: true, epidemic }, { status: 201 });
  } catch (error) {
    console.error("[epidemics] POST failed:", error);
    return NextResponse.json({ error: "Failed to declare epidemic" }, { status: 500 });
  }
}
