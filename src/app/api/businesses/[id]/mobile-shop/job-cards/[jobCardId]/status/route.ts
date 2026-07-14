// POST /api/businesses/[id]/mobile-shop/job-cards/[jobCardId]/status
// Advance job card through its status lifecycle
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Valid transitions: from → [to, to, ...]
const VALID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ["DIAGNOSING", "CANCELLED"],
  DIAGNOSING: ["AWAITING_PARTS", "IN_PROGRESS", "OUTSOURCED", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["TESTING", "AWAITING_PARTS"],
  TESTING: ["READY_FOR_DELIVERY", "IN_PROGRESS"],
  READY_FOR_DELIVERY: ["DELIVERED"],
  OUTSOURCED: ["TESTING", "IN_PROGRESS"],
};

const STATUS_TIMESTAMPS: Record<string, string> = {
  DIAGNOSING: "diagnosedAt",
  IN_PROGRESS: "startedAt",
  TESTING: "testedAt",
  READY_FOR_DELIVERY: "readyAt",
  DELIVERED: "deliveredAt",
  OUTSOURCED: "outsourcedAt",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobCardId: string }> }
) {
  try {
    const { id: businessId, jobCardId } = await params;
    const body = await req.json();
    const { status: newStatus, notes } = body;

    if (!newStatus) {
      return NextResponse.json({ error: "New status is required" }, { status: 400 });
    }

    const jobCard = await db.mSJobCard.findFirst({
      where: { id: jobCardId, businessId, isActive: true },
    });
    if (!jobCard) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[jobCard.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Cannot transition from ${jobCard.status} to ${newStatus}. Allowed: ${allowed?.join(", ") || "none"}`,
      }, { status: 409 });
    }

    // 2D: Require OTP verified before DELIVERED
    if (newStatus === "DELIVERED" && !jobCard.otpVerified) {
      return NextResponse.json({
        error: "OTP must be verified before marking as delivered. Please generate and verify the delivery OTP first.",
        needOtp: true,
      }, { status: 403 });
    }

    // Build update data with appropriate timestamp
    const updateData: Record<string, unknown> = { status: newStatus };
    const timestampField = STATUS_TIMESTAMPS[newStatus];
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    // If DELIVERED, set deliveredAt, link serial item back, and auto-calculate commission
    if (newStatus === "DELIVERED") {
      updateData.deliveredAt = new Date();
      if (jobCard.serialItemId) {
        await db.mSSerialItem.update({
          where: { id: jobCard.serialItemId },
          data: { status: "RETURNED" },
        });
        await db.mSSerialItemHistory.create({
          data: {
            businessId,
            serialItemId: jobCard.serialItemId,
            fromStatus: "IN_REPAIR",
            toStatus: "RETURNED",
            event: "REPAIR_COMPLETE",
            referenceId: jobCardId,
            referenceType: "JOB_CARD",
            notes: notes || `Delivered to ${jobCard.customerName}`,
          },
        });
      }

      // Auto-calculate commission (Phase 2C)
      if (jobCard.assignedToName) {
        const technician = await db.mSTechnician.findFirst({
          where: { businessId, displayName: jobCard.assignedToName, isActive: true },
        });
        if (technician) {
          // Check if commission already exists for this job
          const existingComm = await db.mSCommissionRecord.findFirst({
            where: { jobCardId, businessId },
          });
          if (!existingComm) {
            // Calculate parts cost
            const parts = await db.mSJobCardPart.findMany({
              where: { jobCardId, businessId, isActive: true },
              select: { unitCost: true, quantity: true },
            });
            const partsCost = parts.reduce((s, p) => s + (p.unitCost ?? 0) * p.quantity, 0);
            const profitMargin = (jobCard.finalCost ?? 0) - partsCost - (jobCard.laborCharge ?? 0);

            // Find matching commission rule
            const rules = await db.mSCommissionRule.findMany({
              where: { businessId, isActive: true },
              orderBy: { sortOrder: "asc" },
            });
            let commissionAmount = 0;
            let matchedRuleId: string | null = null;
            let matchedRuleType = "NONE";

            for (const rule of rules) {
              if (rule.ruleType === "FIXED_PER_TYPE" && rule.jobType === jobCard.jobType && rule.fixedAmount != null) {
                commissionAmount = rule.fixedAmount;
                matchedRuleId = rule.id;
                matchedRuleType = rule.ruleType;
                break;
              }
              if (rule.ruleType === "PERCENT_LABOR" && rule.percentRate != null && (jobCard.laborCharge ?? 0) > 0) {
                commissionAmount = (jobCard.laborCharge ?? 0) * (rule.percentRate / 100);
                matchedRuleId = rule.id;
                matchedRuleType = rule.ruleType;
                break;
              }
              if (rule.ruleType === "PERCENT_PROFIT" && rule.percentRate != null && profitMargin > 0) {
                commissionAmount = profitMargin * (rule.percentRate / 100);
                matchedRuleId = rule.id;
                matchedRuleType = rule.ruleType;
                break;
              }
            }

            if (commissionAmount > 0) {
              const month = new Date().toISOString().slice(0, 7);
              await db.mSCommissionRecord.create({
                data: {
                  businessId,
                  technicianId: technician.id,
                  jobCardId,
                  ruleId: matchedRuleId,
                  commissionAmount: Math.round(commissionAmount),
                  ruleType: matchedRuleType,
                  jobType: jobCard.jobType,
                  laborCharge: jobCard.laborCharge,
                  partsCost,
                  profitMargin,
                  month,
                },
              });
            }
          }
        }
      }
    }

    // If OUTSOURCED, set timestamp
    if (newStatus === "OUTSOURCED") {
      updateData.outsourcedAt = new Date();
    }

    // If CANCELLED, return serial item to IN_STOCK
    if (newStatus === "CANCELLED" && jobCard.serialItemId) {
      const item = await db.mSSerialItem.findFirst({
        where: { id: jobCard.serialItemId, businessId, status: "IN_REPAIR" },
      });
      if (item) {
        await db.mSSerialItem.update({
          where: { id: jobCard.serialItemId },
          data: { status: "IN_STOCK" },
        });
        await db.mSSerialItemHistory.create({
          data: {
            businessId,
            serialItemId: jobCard.serialItemId,
            fromStatus: "IN_REPAIR",
            toStatus: "IN_STOCK",
            event: "REPAIR_COMPLETE",
            referenceId: jobCardId,
            referenceType: "JOB_CARD",
            notes: notes || `Job card ${jobCard.jobCode} cancelled`,
          },
        });
      }
    }

    const updated = await db.mSJobCard.update({
      where: { id: jobCardId },
      data: updateData,
      include: {
        serialItem: {
          select: {
            id: true, serialNumber: true, imei: true, status: true, grade: true,
            product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update job card status error:", error);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}