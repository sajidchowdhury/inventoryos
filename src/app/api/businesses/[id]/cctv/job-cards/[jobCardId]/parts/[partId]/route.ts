// DELETE /api/businesses/[id]/cctv/job-cards/[jobCardId]/parts/[partId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; jobCardId: string; partId: string }> },
) {
  try {
    const { id: businessId, jobCardId, partId } = await params;

    // Validate part exists
    const part = await db.mSJobCardPart.findFirst({
      where: { id: partId, jobCardId, businessId, isActive: true },
    });
    if (!part) {
      return NextResponse.json({ error: "Part not found" }, { status: 404 });
    }

    // Validate job card exists (for the code in history note)
    const jobCard = await db.mSJobCard.findFirst({
      where: { id: jobCardId, businessId, isActive: true },
      select: { jobCode: true },
    });
    if (!jobCard) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }

    // Transaction: soft-delete part, restore serial item, create history
    await db.$transaction(async (tx) => {
      await tx.cCTVJobCardPart.update({
        where: { id: partId },
        data: { isActive: false },
      });

      // Only restore if the serial item is currently CONSUMED
      const serialItem = await tx.cCTVSerialItem.findFirst({
        where: { id: part.serialItemId },
      });
      if (serialItem && serialItem.status === "CONSUMED") {
        await tx.cCTVSerialItem.update({
          where: { id: part.serialItemId },
          data: { status: "IN_STOCK" },
        });

        await tx.cCTVSerialItemHistory.create({
          data: {
            businessId,
            serialItemId: part.serialItemId,
            fromStatus: "CONSUMED",
            toStatus: "IN_STOCK",
            event: "CONSUMED",
            referenceId: jobCardId,
            referenceType: "JOB_CARD",
            notes: `Removed from job ${jobCard.jobCode}`,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove job card part error:", error);
    return NextResponse.json({ error: "Failed to remove part" }, { status: 500 });
  }
}