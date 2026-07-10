// POST /api/businesses/[id]/cctv/emi-plans/[emiPlanId]/collect
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; emiPlanId: string }> }) {
  try {
    const { id: businessId, emiPlanId } = await params;
    const body = await req.json();

    const { installmentId, amount, receivedBy, notes } = body as {
      installmentId?: string;
      amount?: number;
      receivedBy?: string;
      notes?: string;
    };

    if (!installmentId) {
      return NextResponse.json({ error: "installmentId is required" }, { status: 400 });
    }

    // Validate plan exists and is ACTIVE
    const plan = await db.cCTVEmiPlan.findFirst({
      where: { id: emiPlanId, businessId, isActive: true, status: "ACTIVE" },
      include: {
        installments: {
          orderBy: { installmentNo: "asc" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "EMI plan not found or not active" }, { status: 404 });
    }

    // Validate installment belongs to this plan and is collectible
    const installment = plan.installments.find((inst) => inst.id === installmentId);
    if (!installment) {
      return NextResponse.json({ error: "Installment not found or does not belong to this plan" }, { status: 404 });
    }
    if (installment.status !== "PENDING" && installment.status !== "OVERDUE") {
      return NextResponse.json({ error: `Installment status is ${installment.status}, cannot collect` }, { status: 400 });
    }

    const payAmount = amount != null ? amount : installment.dueAmount;

    // Cannot overpay
    if (payAmount > installment.dueAmount) {
      return NextResponse.json(
        { error: `Amount (${payAmount}) exceeds due amount (${installment.dueAmount})` },
        { status: 400 },
      );
    }

    // Execute in transaction
    const updatedInstallment = await db.$transaction(async (tx) => {
      // 1. Update installment
      const updated = await tx.cCTVEmiInstallment.update({
        where: { id: installmentId },
        data: {
          status: "PAID",
          paidAmount: payAmount,
          paidAt: new Date(),
          receivedBy: receivedBy?.trim() || null,
          notes: notes?.trim() || null,
        },
      });

      // 2. Update plan summary
      const updatedPlan = await tx.cCTVEmiPlan.update({
        where: { id: emiPlanId },
        data: {
          paidInstallments: { increment: 1 },
          paidAmount: { increment: payAmount },
          remainingAmount: { decrement: payAmount },
        },
        include: {
          installments: {
            select: { status: true },
          },
        },
      });

      // 3. Check if all installments are now PAID
      const allPaid = updatedPlan.installments.every((inst) => inst.status === "PAID");
      if (allPaid) {
        await tx.cCTVEmiPlan.update({
          where: { id: emiPlanId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      }

      return updated;
    });

    return NextResponse.json(updatedInstallment);
  } catch (error) {
    console.error("Collect installment error:", error);
    return NextResponse.json({ error: "Failed to collect installment" }, { status: 500 });
  }
}