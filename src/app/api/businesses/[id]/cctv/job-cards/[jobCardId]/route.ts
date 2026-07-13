// GET/PUT /api/businesses/[id]/cctv/job-cards/[jobCardId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobCardId: string }> }
) {
  try {
    const { id: businessId, jobCardId } = await params;

    const jobCard = await db.mSJobCard.findFirst({
      where: { id: jobCardId, businessId, isActive: true },
      include: {
        serialItem: {
          include: {
            product: { select: { id: true, name: true, brand: true, imageUrl: true, sellPrice: true } },
          },
        },
        parts: {
          where: { isActive: true },
          include: {
            serialItem: {
              select: {
                id: true, serialNumber: true, imei: true, status: true, costPrice: true,
                product: { select: { id: true, name: true, brand: true, imageUrl: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        outsourcedVendor: {
          select: { id: true, name: true, phone: true, address: true, specialization: true },
        },
      },
    });

    if (!jobCard) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }

    // Get status history from serial item history (if linked)
    let statusHistory: { status: string; date: string; notes?: string }[] = [];
    if (jobCard.serialItemId) {
      const history = await db.mSSerialItemHistory.findMany({
        where: { serialItemId: jobCard.serialItemId, businessId },
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, event: true, notes: true, createdAt: true },
      });
      statusHistory = history.map((h) => ({
        status: h.toStatus,
        date: h.createdAt.toISOString(),
        notes: h.notes || undefined,
      }));
    }

    return NextResponse.json({ ...jobCard, statusHistory });
  } catch (error) {
    console.error("Get job card error:", error);
    return NextResponse.json({ error: "Failed to get job card" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobCardId: string }> }
) {
  try {
    const { id: businessId, jobCardId } = await params;
    const body = await req.json();

    const existing = await db.mSJobCard.findFirst({
      where: { id: jobCardId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }

    const updatable = [
      "jobType", "customerName", "customerPhone", "conditionNotes",
      "reportedFault", "diagnosis", "repairNotes", "estimatedCost",
      "finalCost", "laborCharge", "assignedToId", "assignedToName",
      "priority", "internalNotes", "vendorId", "vendorName", "vendorPhone",
      "vendorCost", "expectedReturn", "photoUrls",
    ];

    const data: Record<string, unknown> = {};
    for (const key of updatable) {
      if (body[key] !== undefined) {
        data[key] = typeof body[key] === "string" ? (body[key] as string).trim() || null : body[key];
      }
    }

    const updated = await db.mSJobCard.update({
      where: { id: jobCardId },
      data,
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
    console.error("Update job card error:", error);
    return NextResponse.json({ error: "Failed to update job card" }, { status: 500 });
  }
}