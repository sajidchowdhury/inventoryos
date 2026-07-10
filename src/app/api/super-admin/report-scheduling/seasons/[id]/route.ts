// ── GET/PUT/DELETE /api/super-admin/report-scheduling/seasons/[id] ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const season = await db.reportSeason.findUnique({ where: { id } });
  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
  return NextResponse.json({ success: true, season });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = ["name", "startMonth", "startDay", "endMonth", "endDay", "impactWeight", "affectedCategories", "description", "isActive"];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "affectedCategories") {
          data[key] = JSON.stringify(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }
    const season = await db.reportSeason.update({ where: { id }, data });
    return NextResponse.json({ success: true, season });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update season" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.reportSeason.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
