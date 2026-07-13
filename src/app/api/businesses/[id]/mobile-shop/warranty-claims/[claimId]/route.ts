// GET/PUT/DELETE /api/businesses/[id]/mobile-shop/warranty-claims/[claimId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

// Terminal statuses that cannot transition further
const TERMINAL_STATUSES = ["REJECTED", "COMPLETED", "CANCELLED"];

// GET: Get single claim with serial item details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: businessId, claimId } = await params;

    const claim = await db.mSWarrantyClaim.findFirst({
      where: { id: claimId, businessId, isActive: true },
      include: {
        serialItem: {
          include: {
            product: {
              select: { name: true, brand: true },
            },
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Get warranty claim error:", error);
    return NextResponse.json({ error: "Failed to get warranty claim" }, { status: 500 });
  }
}

// PUT: Update claim status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: businessId, claimId } = await params;
    const body = await req.json();
    const { status, resolutionNotes, jobCardId } = body as {
      status?: string;
      resolutionNotes?: string;
      jobCardId?: string;
    };

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    // Fetch existing claim
    const existing = await db.mSWarrantyClaim.findFirst({
      where: { id: claimId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${existing.status} to ${status}`,
        },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status,
      resolutionNotes: resolutionNotes ?? undefined,
      jobCardId: jobCardId ?? undefined,
    };

    // Set timestamps based on new status
    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
    }
    if (status === "COMPLETED" || status === "REJECTED") {
      updateData.completedAt = new Date();
    }

    const updated = await db.mSWarrantyClaim.update({
      where: { id: claimId },
      data: updateData,
      include: {
        serialItem: {
          include: {
            product: {
              select: { name: true, brand: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update warranty claim error:", error);
    return NextResponse.json({ error: "Failed to update warranty claim" }, { status: 500 });
  }
}

// DELETE: Soft-delete claim (set isActive = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: businessId, claimId } = await params;

    // Fetch existing claim
    const existing = await db.mSWarrantyClaim.findFirst({
      where: { id: claimId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Warranty claim not found" }, { status: 404 });
    }

    // Only allow soft-delete for PENDING or REJECTED claims
    if (!["PENDING", "REJECTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot delete claim with status ${existing.status}. Only PENDING or REJECTED claims can be deleted.` },
        { status: 400 }
      );
    }

    await db.mSWarrantyClaim.update({
      where: { id: claimId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete warranty claim error:", error);
    return NextResponse.json({ error: "Failed to delete warranty claim" }, { status: 500 });
  }
}