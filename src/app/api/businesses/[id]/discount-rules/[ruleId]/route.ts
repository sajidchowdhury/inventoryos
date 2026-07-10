// GET/PUT/DELETE /api/businesses/[id]/discount-rules/[ruleId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_TYPES = ["percent", "flat"];
const VALID_CONDITIONS = ["none", "min_quantity", "min_amount", "customer_tag", "schedule_type", "time_based"];
const VALID_SCOPES = ["all", "category", "product", "schedule_type"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { id: businessId, ruleId } = await params;
    const rule = await db.discountRule.findFirst({
      where: { id: ruleId, businessId },
    });
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Get discount rule error:", error);
    return NextResponse.json({ error: "Failed to fetch rule" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { id: businessId, ruleId } = await params;
    const body = await req.json();

    const existing = await db.discountRule.findFirst({
      where: { id: ruleId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Validate if provided
    if (body.type && !VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (body.value !== undefined) {
      const value = parseFloat(body.value);
      if (isNaN(value) || value <= 0) {
        return NextResponse.json({ error: "value must be positive" }, { status: 400 });
      }
      if ((body.type || existing.type) === "percent" && value > 100) {
        return NextResponse.json({ error: "Percentage cannot exceed 100%" }, { status: 400 });
      }
    }

    const rule = await db.discountRule.update({
      where: { id: ruleId },
      data: {
        name: body.name !== undefined ? body.name.trim() : existing.name,
        description: body.description !== undefined ? (body.description?.trim() || null) : existing.description,
        type: body.type || existing.type,
        value: body.value !== undefined ? parseFloat(body.value) : existing.value,
        conditionType: body.conditionType || existing.conditionType,
        conditionValue: body.conditionValue !== undefined ? (body.conditionValue?.toString() || null) : existing.conditionValue,
        scope: body.scope || existing.scope,
        scopeValue: body.scopeValue !== undefined ? (body.scopeValue?.toString() || null) : existing.scopeValue,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : existing.startDate,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : existing.endDate,
        isActive: body.isActive !== undefined ? !!body.isActive : existing.isActive,
        priority: body.priority !== undefined ? parseInt(body.priority) : existing.priority,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Update discount rule error:", error);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const { id: businessId, ruleId } = await params;
    const existing = await db.discountRule.findFirst({
      where: { id: ruleId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await db.discountRule.delete({ where: { id: ruleId } });

    return NextResponse.json({
      success: true,
      message: `Rule "${existing.name}" deleted (was used ${existing.timesUsed} times)`,
    });
  } catch (error) {
    console.error("Delete discount rule error:", error);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
