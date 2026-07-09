// POST /api/businesses/[id]/cctv/job-cards/[jobCardId]/status
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

    const jobCard = await db.cCTVJobCard.findFirst({
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

    // Build update data with appropriate timestamp
    const updateData: Record<string, unknown> = { status: newStatus };
    const timestampField = STATUS_TIMESTAMPS[newStatus];
    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    // If DELIVERED, set deliveredAt and link serial item back to IN_STOCK or RETURNED
    if (newStatus === "DELIVERED") {
      updateData.deliveredAt = new Date();
      if (jobCard.serialItemId) {
        await db.cCTVSerialItem.update({
          where: { id: jobCard.serialItemId },
          data: { status: "RETURNED" },
        });
        await db.cCTVSerialItemHistory.create({
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
    }

    // If OUTSOURCED, set timestamp
    if (newStatus === "OUTSOURCED") {
      updateData.outsourcedAt = new Date();
    }

    // If CANCELLED, return serial item to IN_STOCK
    if (newStatus === "CANCELLED" && jobCard.serialItemId) {
      const item = await db.cCTVSerialItem.findFirst({
        where: { id: jobCard.serialItemId, businessId, status: "IN_REPAIR" },
      });
      if (item) {
        await db.cCTVSerialItem.update({
          where: { id: jobCard.serialItemId },
          data: { status: "IN_STOCK" },
        });
        await db.cCTVSerialItemHistory.create({
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

    const updated = await db.cCTVJobCard.update({
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