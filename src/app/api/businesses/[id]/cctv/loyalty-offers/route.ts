// GET/POST /api/businesses/[id]/cctv/loyalty-offers
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_OFFER_TYPES = ["DOUBLE_POINTS", "BONUS_POINTS"];

// Default config values used for auto-initialization
const DEFAULT_CONFIG = {
  earnRatePoints: 1,
  earnRateAmount: 100,
  redeemPointsRequired: 100,
  redeemRateValue: 10,
  tierBronze: 0,
  tierSilver: 50000,
  tierGold: 200000,
  tierPlatinum: 500000,
  isActive: true,
};

// GET: List loyalty offers
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const activeParam = url.searchParams.get("active");
    const currentParam = url.searchParams.get("current");

    const where: Record<string, unknown> = { businessId };

    // Filter by active status
    if (activeParam !== null && activeParam !== "") {
      where.isActive = activeParam === "true";
    }

    // Filter by current (active now)
    if (currentParam === "true") {
      where.isActive = true;
      where.startDate = { lte: new Date() };
      where.endDate = { gte: new Date() };
    }

    const offers = await db.cCTVLoyaltyOffer.findMany({
      where,
      include: {
        config: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(offers);
  } catch (error) {
    console.error("List loyalty offers error:", error);
    return NextResponse.json({ error: "Failed to list loyalty offers" }, { status: 500 });
  }
}

// POST: Create a loyalty offer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      name,
      offerType,
      multiplier,
      bonusPoints,
      startDate,
      endDate,
      description,
    } = body as {
      name: string;
      offerType: string;
      multiplier?: number;
      bonusPoints?: number;
      startDate: string;
      endDate: string;
      description?: string;
    };

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Offer name is required" }, { status: 400 });
    }

    if (!offerType || !VALID_OFFER_TYPES.includes(offerType)) {
      return NextResponse.json(
        { error: `offerType must be one of ${VALID_OFFER_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (!startDate) {
      return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    }

    if (!endDate) {
      return NextResponse.json({ error: "endDate is required" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: "startDate must be a valid date" }, { status: 400 });
    }

    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: "endDate must be a valid date" }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    // Validate offer-type-specific fields
    if (offerType === "DOUBLE_POINTS" && multiplier !== undefined && multiplier <= 0) {
      return NextResponse.json({ error: "multiplier must be greater than 0" }, { status: 400 });
    }

    if (offerType === "BONUS_POINTS" && (bonusPoints === undefined || bonusPoints <= 0)) {
      return NextResponse.json({ error: "bonusPoints is required and must be > 0 for BONUS_POINTS type" }, { status: 400 });
    }

    // Find or create loyalty config (auto-init if missing)
    let config = await db.cCTVLoyaltyConfig.findUnique({
      where: { businessId },
    });

    if (!config) {
      config = await db.cCTVLoyaltyConfig.create({
        data: {
          businessId,
          ...DEFAULT_CONFIG,
        },
      });
    }

    // Create offer
    const offer = await db.cCTVLoyaltyOffer.create({
      data: {
        businessId,
        configId: config.id,
        name: name.trim(),
        offerType,
        multiplier: multiplier && multiplier > 0 ? multiplier : 2,
        bonusPoints: offerType === "BONUS_POINTS" ? bonusPoints : null,
        startDate: start,
        endDate: end,
        description: description?.trim() || null,
        isActive: true,
      },
      include: {
        config: { select: { id: true } },
      },
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error("Create loyalty offer error:", error);
    return NextResponse.json({ error: "Failed to create loyalty offer" }, { status: 500 });
  }
}