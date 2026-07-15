// PUT/DELETE /api/businesses/[id]/mobile-shop/amc-contracts/[contractId]/visits/[visitId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PUT: Update a visit
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string; visitId: string }> }
) {
  try {
    const { id: businessId, contractId, visitId } = await params;
    const body = await req.json();

    // Verify visit belongs to contract and business
    const existing = await db.mSAmcVisit.findFirst({
      where: { id: visitId, contractId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "AMC visit not found" }, { status: 404 });
    }

    const {
      visitDate,
      technicianName,
      technicianId,
      visitType,
      workPerformed,
      partsReplaced,
      partsCost,
      findings,
      visitNotes,
      customerSignOff,
    } = body as {
      visitDate?: string;
      technicianName?: string;
      technicianId?: string;
      visitType?: string;
      workPerformed?: string;
      partsReplaced?: string;
      partsCost?: number;
      findings?: string;
      visitNotes?: string;
      customerSignOff?: boolean;
    };

    // Validate visitType if provided
    if (visitType && !["SCHEDULED", "EMERGENCY", "RENEWAL"].includes(visitType)) {
      return NextResponse.json(
        { error: "visitType must be SCHEDULED, EMERGENCY, or RENEWAL" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (visitDate !== undefined) updateData.visitDate = new Date(visitDate);
    if (technicianName !== undefined) updateData.technicianName = technicianName?.trim() || null;
    if (technicianId !== undefined) updateData.technicianId = technicianId || null;
    if (visitType !== undefined) updateData.visitType = visitType;
    if (workPerformed !== undefined) updateData.workPerformed = workPerformed?.trim() || null;
    if (partsReplaced !== undefined) updateData.partsReplaced = partsReplaced || null;
    if (partsCost !== undefined) updateData.partsCost = partsCost;
    if (findings !== undefined) updateData.findings = findings?.trim() || null;
    if (visitNotes !== undefined) updateData.visitNotes = visitNotes?.trim() || null;
    if (customerSignOff !== undefined) updateData.customerSignOff = customerSignOff;

    const updated = await db.mSAmcVisit.update({
      where: { id: visitId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update AMC visit error:", error);
    return NextResponse.json({ error: "Failed to update AMC visit" }, { status: 500 });
  }
}

// DELETE: Soft-delete visit (isActive=false) and decrement contract's totalVisitsUsed
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string; visitId: string }> }
) {
  try {
    const { id: businessId, contractId, visitId } = await params;

    // Verify visit belongs to contract and business
    const existing = await db.mSAmcVisit.findFirst({
      where: { id: visitId, contractId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "AMC visit not found" }, { status: 404 });
    }

    // Soft-delete and decrement totalVisitsUsed in a transaction
    await db.$transaction(async (tx) => {
      await tx.cCTVAmcVisit.update({
        where: { id: visitId },
        data: { isActive: false },
      });

      // Decrement contract's totalVisitsUsed (ensure it doesn't go below 0)
      const contract = await tx.cCTVAmcContract.findUnique({
        where: { id: contractId },
        select: { totalVisitsUsed: true },
      });

      if (contract && contract.totalVisitsUsed > 0) {
        await tx.cCTVAmcContract.update({
          where: { id: contractId },
          data: {
            totalVisitsUsed: {
              decrement: 1,
            },
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete AMC visit error:", error);
    return NextResponse.json({ error: "Failed to delete AMC visit" }, { status: 500 });
  }
}