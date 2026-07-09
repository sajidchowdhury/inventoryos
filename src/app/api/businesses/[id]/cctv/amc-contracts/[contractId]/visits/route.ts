// GET /api/businesses/[id]/cctv/amc-contracts/[contractId]/visits → list visits
// POST /api/businesses/[id]/cctv/amc-contracts/[contractId]/visits → create visit
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const { id: businessId, contractId } = await params;

    const visits = await db.cCTVAmcVisit.findMany({
      where: { contractId, businessId, isActive: true },
      orderBy: { visitDate: "desc" },
    });

    return NextResponse.json(visits);
  } catch (error) {
    console.error("List AMC visits error:", error);
    return NextResponse.json({ error: "Failed to list visits" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const { id: businessId, contractId } = await params;
    const body = await req.json();

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
    } = body;

    if (!visitDate) {
      return NextResponse.json({ error: "Visit date is required" }, { status: 400 });
    }

    const visit = await db.cCTVAmcVisit.create({
      data: {
        businessId,
        contractId,
        visitDate: new Date(visitDate),
        technicianName: technicianName?.trim() || null,
        technicianId: technicianId || null,
        visitType: visitType || "SCHEDULED",
        workPerformed: workPerformed?.trim() || null,
        partsReplaced: partsReplaced?.trim() || null,
        partsCost: Number(partsCost) || 0,
        findings: findings?.trim() || null,
        visitNotes: visitNotes?.trim() || null,
      },
    });

    // Increment totalVisitsUsed on the contract
    await db.cCTVAmcContract.update({
      where: { id: contractId },
      data: { totalVisitsUsed: { increment: 1 } },
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    console.error("Create AMC visit error:", error);
    return NextResponse.json({ error: "Failed to create visit" }, { status: 500 });
  }
}