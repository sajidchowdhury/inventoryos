// GET/PUT /api/businesses/[id]/cctv/loyalty-config
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

// GET: Get loyalty config for this business (auto-init if missing)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    let config = await db.cCTVLoyaltyConfig.findUnique({
      where: { businessId },
      include: {
        _count: {
          select: { offers: true },
        },
      },
    });

    // Auto-initialize if not found
    if (!config) {
      config = await db.cCTVLoyaltyConfig.create({
        data: {
          businessId,
          ...DEFAULT_CONFIG,
        },
        include: {
          _count: {
            select: { offers: true },
          },
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Get loyalty config error:", error);
    return NextResponse.json({ error: "Failed to fetch loyalty config" }, { status: 500 });
  }
}

// PUT: Update loyalty config
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      earnRatePoints,
      earnRateAmount,
      redeemPointsRequired,
      redeemRateValue,
      tierBronze,
      tierSilver,
      tierGold,
      tierPlatinum,
      isActive,
    } = body as {
      earnRatePoints?: number;
      earnRateAmount?: number;
      redeemPointsRequired?: number;
      redeemRateValue?: number;
      tierBronze?: number;
      tierSilver?: number;
      tierGold?: number;
      tierPlatinum?: number;
      isActive?: boolean;
    };

    // Validate numeric fields if provided
    if (earnRatePoints !== undefined && (earnRatePoints < 1 || !Number.isInteger(earnRatePoints))) {
      return NextResponse.json({ error: "earnRatePoints must be a positive integer" }, { status: 400 });
    }
    if (earnRateAmount !== undefined && (earnRateAmount <= 0)) {
      return NextResponse.json({ error: "earnRateAmount must be greater than 0" }, { status: 400 });
    }
    if (redeemPointsRequired !== undefined && (redeemPointsRequired < 1 || !Number.isInteger(redeemPointsRequired))) {
      return NextResponse.json({ error: "redeemPointsRequired must be a positive integer" }, { status: 400 });
    }
    if (redeemRateValue !== undefined && redeemRateValue <= 0) {
      return NextResponse.json({ error: "redeemRateValue must be greater than 0" }, { status: 400 });
    }
    if (tierSilver !== undefined && tierSilver < 0) {
      return NextResponse.json({ error: "tierSilver must be >= 0" }, { status: 400 });
    }
    if (tierGold !== undefined && tierGold < 0) {
      return NextResponse.json({ error: "tierGold must be >= 0" }, { status: 400 });
    }
    if (tierPlatinum !== undefined && tierPlatinum < 0) {
      return NextResponse.json({ error: "tierPlatinum must be >= 0" }, { status: 400 });
    }

    // Find existing config by businessId
    const existing = await db.cCTVLoyaltyConfig.findUnique({
      where: { businessId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Loyalty config not found. Use GET to auto-initialize." }, { status: 404 });
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (earnRatePoints !== undefined) updateData.earnRatePoints = earnRatePoints;
    if (earnRateAmount !== undefined) updateData.earnRateAmount = earnRateAmount;
    if (redeemPointsRequired !== undefined) updateData.redeemPointsRequired = redeemPointsRequired;
    if (redeemRateValue !== undefined) updateData.redeemRateValue = redeemRateValue;
    if (tierBronze !== undefined) updateData.tierBronze = tierBronze;
    if (tierSilver !== undefined) updateData.tierSilver = tierSilver;
    if (tierGold !== undefined) updateData.tierGold = tierGold;
    if (tierPlatinum !== undefined) updateData.tierPlatinum = tierPlatinum;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedConfig = await db.cCTVLoyaltyConfig.update({
      where: { businessId },
      data: updateData,
      include: {
        _count: {
          select: { offers: true },
        },
      },
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error("Update loyalty config error:", error);
    return NextResponse.json({ error: "Failed to update loyalty config" }, { status: 500 });
  }
}