// GET /api/businesses/[id]/cctv/amc-contracts/[contractId] → get detail
// PUT /api/businesses/[id]/cctv/amc-contracts/[contractId] → update
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const { id: businessId, contractId } = await params;

    const contract = await db.cCTVAmcContract.findFirst({
      where: { id: contractId, businessId, isActive: true },
      include: {
        visits: {
          where: { isActive: true },
          orderBy: { visitDate: "desc" },
        },
        _count: { select: { visits: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Compute days remaining
    const now = new Date();
    const end = new Date(contract.endDate);
    const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);

    return NextResponse.json({ ...contract, daysRemaining });
  } catch (error) {
    console.error("Get AMC contract error:", error);
    return NextResponse.json({ error: "Failed to get AMC contract" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  try {
    const { id: businessId, contractId } = await params;
    const body = await req.json();

    const existing = await db.cCTVAmcContract.findFirst({
      where: { id: contractId, businessId, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const {
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      coverageType,
      startDate,
      endDate,
      totalAmount,
      paymentFrequency,
      paymentAmount,
      visitsIncluded,
      slaTerms,
      responseHours,
      notes,
    } = body;

    // Compute payment amount if totalAmount or frequency changed
    let computedPaymentAmount = paymentAmount;
    if (totalAmount && paymentFrequency) {
      const freq = paymentFrequency;
      if (freq === "MONTHLY") computedPaymentAmount = totalAmount / 12;
      else if (freq === "QUARTERLY") computedPaymentAmount = totalAmount / 4;
      else computedPaymentAmount = totalAmount;
    }

    const updateData: Record<string, unknown> = {};
    if (clientName !== undefined) updateData.clientName = clientName.trim();
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone?.trim() || null;
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail?.trim() || null;
    if (clientAddress !== undefined) updateData.clientAddress = clientAddress?.trim() || null;
    if (coverageType !== undefined) updateData.coverageType = coverageType;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (totalAmount !== undefined) updateData.totalAmount = Number(totalAmount);
    if (paymentFrequency !== undefined) updateData.paymentFrequency = paymentFrequency;
    if (computedPaymentAmount !== undefined) updateData.paymentAmount = Number(computedPaymentAmount);
    if (visitsIncluded !== undefined) updateData.visitsIncluded = Number(visitsIncluded);
    if (slaTerms !== undefined) updateData.slaTerms = slaTerms?.trim() || null;
    if (responseHours !== undefined) updateData.responseHours = Number(responseHours);
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    // Recompute status if dates changed
    if (endDate !== undefined) {
      const now = new Date();
      const end = new Date(endDate);
      const EXPIRING_DAYS = 90;
      const endMs = end.getTime();
      const nowMs = now.getTime();
      if (endMs <= nowMs) updateData.status = "EXPIRED";
      else if (endMs <= nowMs + EXPIRING_DAYS * MS_PER_DAY) updateData.status = "EXPIRING_SOON";
      else updateData.status = "ACTIVE";
    }

    const updated = await db.cCTVAmcContract.update({
      where: { id: contractId },
      data: updateData,
      include: { _count: { select: { visits: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update AMC contract error:", error);
    return NextResponse.json({ error: "Failed to update AMC contract" }, { status: 500 });
  }
}