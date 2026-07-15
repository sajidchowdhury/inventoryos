// GET/POST /api/businesses/[id]/mobile-shop/commission-rules
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const rules = await db.mSCommissionRule.findMany({
      where: { businessId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(rules);
  } catch (error) {
    console.error("List commission rules error:", error);
    return NextResponse.json({ error: "Failed to list rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { name, ruleType, jobType, fixedAmount, percentRate, sortOrder } = body;

    if (!name?.trim() || !ruleType) {
      return NextResponse.json({ error: "Name and rule type are required" }, { status: 400 });
    }
    if (!["FIXED_PER_TYPE", "PERCENT_LABOR", "PERCENT_PROFIT"].includes(ruleType)) {
      return NextResponse.json({ error: "Invalid rule type" }, { status: 400 });
    }
    if (ruleType === "FIXED_PER_TYPE" && (!jobType || fixedAmount == null)) {
      return NextResponse.json({ error: "Job type and fixed amount required for FIXED_PER_TYPE" }, { status: 400 });
    }
    if (percentRate != null && (percentRate < 0 || percentRate > 100)) {
      return NextResponse.json({ error: "Percent rate must be 0-100" }, { status: 400 });
    }

    const rule = await db.mSCommissionRule.create({
      data: {
        businessId,
        name: name.trim(),
        ruleType,
        jobType: jobType || null,
        fixedAmount: fixedAmount ?? null,
        percentRate: percentRate ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Create commission rule error:", error);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}