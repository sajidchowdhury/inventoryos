// GET/PUT/DELETE /api/businesses/[id]/cctv/loyalty-offers/[offerId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_OFFER_TYPES = ["DOUBLE_POINTS", "BONUS_POINTS"];

// GET: Get single offer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  try {
    const { id: businessId, offerId } = await params;

    const offer = await db.mSLoyaltyOffer.findFirst({
      where: { id: offerId, businessId },
      include: {
        config: { select: { id: true } },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(offer);
  } catch (error) {
    console.error("Get loyalty offer error:", error);
    return NextResponse.json({ error: "Failed to fetch loyalty offer" }, { status: 500 });
  }
}

// PUT: Update offer
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  try {
    const { id: businessId, offerId } = await params;
    const body = await req.json();

    const {
      name,
      offerType,
      multiplier,
      bonusPoints,
      startDate,
      endDate,
      description,
      isActive,
    } = body as {
      name?: string;
      offerType?: string;
      multiplier?: number;
      bonusPoints?: number;
      startDate?: string;
      endDate?: string;
      description?: string;
      isActive?: boolean;
    };

    // Validate offerType if provided
    if (offerType && !VALID_OFFER_TYPES.includes(offerType)) {
      return NextResponse.json(
        { error: `offerType must be one of ${VALID_OFFER_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate dates if provided
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return NextResponse.json({ error: "startDate must be a valid date" }, { status: 400 });
      }
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return NextResponse.json({ error: "endDate must be a valid date" }, { status: 400 });
      }
    }

    // Cross-validate dates against existing or each other
    if (start && end && end <= start) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    // Validate offer-type-specific fields
    if (offerType === "DOUBLE_POINTS" && multiplier !== undefined && multiplier <= 0) {
      return NextResponse.json({ error: "multiplier must be greater than 0" }, { status: 400 });
    }

    if (offerType === "BONUS_POINTS" && (bonusPoints !== undefined && bonusPoints <= 0)) {
      return NextResponse.json({ error: "bonusPoints must be > 0 for BONUS_POINTS type" }, { status: 400 });
    }

    // Check offer exists
    const existing = await db.mSLoyaltyOffer.findFirst({
      where: { id: offerId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Cross-validate with existing date if only one new date provided
    if (start && !end && new Date(existing.endDate) <= start) {
      return NextResponse.json({ error: "startDate must be before the existing endDate" }, { status: 400 });
    }
    if (end && !start && end <= new Date(existing.startDate)) {
      return NextResponse.json({ error: "endDate must be after the existing startDate" }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (offerType !== undefined) updateData.offerType = offerType;
    if (multiplier !== undefined) updateData.multiplier = multiplier;
    if (bonusPoints !== undefined) updateData.bonusPoints = bonusPoints;
    if (start !== undefined) updateData.startDate = start;
    if (end !== undefined) updateData.endDate = end;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedOffer = await db.mSLoyaltyOffer.update({
      where: { id: offerId },
      data: updateData,
      include: {
        config: { select: { id: true } },
      },
    });

    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error("Update loyalty offer error:", error);
    return NextResponse.json({ error: "Failed to update loyalty offer" }, { status: 500 });
  }
}

// DELETE: Soft-delete (set isActive = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> },
) {
  try {
    const { id: businessId, offerId } = await params;

    // Check offer exists
    const existing = await db.mSLoyaltyOffer.findFirst({
      where: { id: offerId, businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    await db.mSLoyaltyOffer.update({
      where: { id: offerId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete loyalty offer error:", error);
    return NextResponse.json({ error: "Failed to delete loyalty offer" }, { status: 500 });
  }
}