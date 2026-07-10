// ── GET/PUT/DELETE /api/super-admin/report-scheduling/epidemics/[id] ──
// Includes a special "dismiss" action via PUT { isActive: false }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const epidemic = await db.epidemicAlert.findUnique({ where: { id } });
  if (!epidemic) return NextResponse.json({ error: "Epidemic alert not found" }, { status: 404 });
  return NextResponse.json({ success: true, epidemic });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = ["name", "diseaseType", "severity", "impactWeight", "affectedCategories", "affectedProducts", "startDate", "endDate", "isActive", "notes"];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === "affectedCategories" || key === "affectedProducts") {
          data[key] = JSON.stringify(body[key]);
        } else if (key === "startDate" || key === "endDate") {
          data[key] = new Date(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }
    const epidemic = await db.epidemicAlert.update({ where: { id }, data });
    return NextResponse.json({ success: true, epidemic });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update epidemic" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.epidemicAlert.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
