// GET/POST /api/businesses/[id]/discount-rules
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_TYPES = ["percent", "flat"];
const VALID_CONDITIONS = ["none", "min_quantity", "min_amount", "customer_tag", "schedule_type", "time_based"];
const VALID_SCOPES = ["all", "category", "product", "schedule_type"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const activeOnly = url.searchParams.get("active") === "true";

    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.isActive = true;

    const rules = await db.discountRule.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error("Get discount rules error:", error);
    return NextResponse.json({ error: "Failed to fetch discount rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Rule name is required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }
    const value = parseFloat(body.value);
    if (isNaN(value) || value <= 0) {
      return NextResponse.json({ error: "value must be a positive number" }, { status: 400 });
    }
    if (body.type === "percent" && value > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100%" }, { status: 400 });
    }
    if (!VALID_CONDITIONS.includes(body.conditionType || "none")) {
      return NextResponse.json({ error: `conditionType must be one of: ${VALID_CONDITIONS.join(", ")}` }, { status: 400 });
    }
    if (!VALID_SCOPES.includes(body.scope || "all")) {
      return NextResponse.json({ error: `scope must be one of: ${VALID_SCOPES.join(", ")}` }, { status: 400 });
    }

    const rule = await db.discountRule.create({
      data: {
        businessId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        type: body.type,
        value,
        conditionType: body.conditionType || "none",
        conditionValue: body.conditionValue?.toString() || null,
        scope: body.scope || "all",
        scopeValue: body.scopeValue?.toString() || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive !== false,
        priority: parseInt(body.priority) || 0,
      },
    });

    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (error) {
    console.error("Create discount rule error:", error);
    return NextResponse.json({ error: "Failed to create discount rule" }, { status: 500 });
  }
}
