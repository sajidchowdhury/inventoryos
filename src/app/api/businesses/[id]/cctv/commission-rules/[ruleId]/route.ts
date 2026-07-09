// PUT/DELETE /api/businesses/[id]/cctv/commission-rules/[ruleId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: businessId, ruleId } = await params;
    const body = await req.json();

    const existing = await db.cCTVCommissionRule.findFirst({
      where: { id: ruleId, businessId },
    });
    if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.ruleType !== undefined) data.ruleType = String(body.ruleType);
    if (body.jobType !== undefined) data.jobType = body.jobType || null;
    if (body.fixedAmount !== undefined) data.fixedAmount = body.fixedAmount ?? null;
    if (body.percentRate !== undefined) data.percentRate = body.percentRate ?? null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const updated = await db.cCTVCommissionRule.update({
      where: { id: ruleId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update commission rule error:", error);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: businessId, ruleId } = await params;
    const existing = await db.cCTVCommissionRule.findFirst({
      where: { id: ruleId, businessId },
    });
    if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

    await db.cCTVCommissionRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete commission rule error:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}