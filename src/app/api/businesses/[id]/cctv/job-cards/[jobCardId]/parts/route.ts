// GET/POST /api/businesses/[id]/cctv/job-cards/[jobCardId]/parts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; jobCardId: string }> }) {
  try {
    const { id: businessId, jobCardId } = await params;

    const parts = await db.mSJobCardPart.findMany({
      where: { jobCardId, businessId, isActive: true },
      include: {
        serialItem: {
          select: {
            id: true,
            serialNumber: true,
            imei: true,
            status: true,
            costPrice: true,
            product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(parts);
  } catch (error) {
    console.error("List job card parts error:", error);
    return NextResponse.json({ error: "Failed to list parts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; jobCardId: string }> }) {
  try {
    const { id: businessId, jobCardId } = await params;
    const body = await req.json();
    const { serialItemId, quantity = 1, notes } = body;

    if (!serialItemId) {
      return NextResponse.json({ error: "Serial item ID is required" }, { status: 400 });
    }

    // Validate job card exists
    const jobCard = await db.mSJobCard.findFirst({
      where: { id: jobCardId, businessId, isActive: true },
    });
    if (!jobCard) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }

    // Validate serial item: exists, belongs to business, is IN_STOCK
    const serialItem = await db.mSSerialItem.findFirst({
      where: { id: serialItemId, businessId, isActive: true },
      include: { product: { select: { name: true, brand: true } } },
    });
    if (!serialItem) {
      return NextResponse.json({ error: "Serial item not found" }, { status: 404 });
    }
    if (serialItem.status !== "IN_STOCK") {
      return NextResponse.json(
        { error: `Serial item is not in stock (current: ${serialItem.status})` },
        { status: 400 },
      );
    }

    // Check duplicate (same serial item already on this job card)
    const existing = await db.mSJobCardPart.findFirst({
      where: { jobCardId, serialItemId, isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: "This part is already added to this job card" }, { status: 409 });
    }

    // Transaction: create part, update serial item status, create history
    const part = await db.$transaction(async (tx) => {
      const created = await tx.cCTVJobCardPart.create({
        data: {
          businessId,
          jobCardId,
          serialItemId,
          unitCost: serialItem.costPrice ?? null,
          quantity: Math.max(1, Math.floor(quantity)),
          notes: notes?.trim() || null,
        },
        include: {
          serialItem: {
            select: {
              id: true,
              serialNumber: true,
              imei: true,
              status: true,
              costPrice: true,
              product: { select: { id: true, name: true, brand: true, imageUrl: true } },
            },
          },
        },
      });

      await tx.cCTVSerialItem.update({
        where: { id: serialItemId },
        data: { status: "CONSUMED" },
      });

      await tx.cCTVSerialItemHistory.create({
        data: {
          businessId,
          serialItemId,
          fromStatus: "IN_STOCK",
          toStatus: "CONSUMED",
          event: "CONSUMED",
          referenceId: jobCardId,
          referenceType: "JOB_CARD",
          notes: `Used in job ${jobCard.jobCode}`,
        },
      });

      return created;
    });

    return NextResponse.json(part, { status: 201 });
  } catch (error) {
    console.error("Add job card part error:", error);
    return NextResponse.json({ error: "Failed to add part" }, { status: 500 });
  }
}