// GET /api/businesses/[id]/mobile-shop/emi-plans/[emiPlanId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; emiPlanId: string }> }) {
  try {
    const { id: businessId, emiPlanId } = await params;

    const plan = await db.mSEmiPlan.findFirst({
      where: { id: emiPlanId, businessId, isActive: true },
      include: {
        installments: {
          orderBy: { installmentNo: "asc" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "EMI plan not found" }, { status: 404 });
    }

    // Compute overdueCount
    const overdueCount = plan.installments.filter((inst) => inst.status === "OVERDUE").length;

    // Compute nextDueDate: next PENDING installment dueDate
    const now = new Date();
    const nextPending = plan.installments.find((inst) => inst.status === "PENDING" && new Date(inst.dueDate) >= now);
    const nextDueDate = nextPending ? nextPending.dueDate : null;

    return NextResponse.json({
      ...plan,
      overdueCount,
      nextDueDate,
    });
  } catch (error) {
    console.error("Get EMI plan error:", error);
    return NextResponse.json({ error: "Failed to get EMI plan" }, { status: 500 });
  }
}