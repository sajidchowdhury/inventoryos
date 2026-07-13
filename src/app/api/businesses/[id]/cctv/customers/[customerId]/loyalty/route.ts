// GET/POST /api/businesses/[id]/cctv/customers/[customerId]/loyalty
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Tier calculation helper
function calculateTier(
  totalSpent: number,
  config: { tierBronze: number; tierSilver: number; tierGold: number; tierPlatinum: number },
): string {
  if (totalSpent >= config.tierPlatinum) return "PLATINUM";
  if (totalSpent >= config.tierGold) return "GOLD";
  if (totalSpent >= config.tierSilver) return "SILVER";
  return "BRONZE";
}

// Default thresholds when no config found
const DEFAULT_THRESHOLDS = {
  tierBronze: 0,
  tierSilver: 50000,
  tierGold: 200000,
  tierPlatinum: 500000,
};

// GET: Get loyalty transactions for a customer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> },
) {
  try {
    const { id: businessId, customerId } = await params;
    const url = new URL(req.url);
    const type = url.searchParams.get("type")?.trim() || "";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

    // Fetch customer with loyalty fields
    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
      select: { id: true, loyaltyPoints: true, loyaltyTier: true, totalSpent: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Build where clause for transactions
    const where: Record<string, unknown> = { customerId, businessId };
    if (type) {
      where.type = type;
    }

    const transactions = await db.mSLoyaltyTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      transactions,
      customer: {
        loyaltyPoints: customer.loyaltyPoints,
        loyaltyTier: customer.loyaltyTier,
      },
    });
  } catch (error) {
    console.error("Get loyalty transactions error:", error);
    return NextResponse.json({ error: "Failed to fetch loyalty transactions" }, { status: 500 });
  }
}

// POST: Manual points adjustment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> },
) {
  try {
    const { id: businessId, customerId } = await params;
    const body = await req.json();

    const { points, description, createdById } = body as {
      points: number;
      description: string;
      createdById?: string;
    };

    // Validate points
    if (points === undefined || points === null || typeof points !== "number") {
      return NextResponse.json({ error: "Points value is required" }, { status: 400 });
    }

    if (points === 0) {
      return NextResponse.json({ error: "Points must not be zero" }, { status: 400 });
    }

    if (!description || !description.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // Validate customer exists and is active
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId, isActive: true },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      // Calculate new balance
      const newBalance = customer.loyaltyPoints + points;
      if (newBalance < 0) {
        throw new Error("INSUFFICIENT_POINTS");
      }

      // Get loyalty config for tier thresholds
      const config = await tx.cCTVLoyaltyConfig.findFirst({
        where: { businessId },
      });

      const thresholds = config
        ? {
            tierBronze: config.tierBronze,
            tierSilver: config.tierSilver,
            tierGold: config.tierGold,
            tierPlatinum: config.tierPlatinum,
          }
        : DEFAULT_THRESHOLDS;

      // Recalculate tier based on totalSpent
      const newTier = calculateTier(customer.totalSpent, thresholds);

      // Update customer
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: newBalance,
          loyaltyTier: newTier,
        },
      });

      // Create loyalty transaction
      const transaction = await tx.cCTVLoyaltyTransaction.create({
        data: {
          businessId,
          customerId,
          type: "ADJUST",
          points,
          balanceAfter: newBalance,
          description: description.trim(),
          createdById: createdById || null,
        },
      });

      return { customer: updatedCustomer, transaction };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Customer not found or inactive" }, { status: 404 });
    }
    if (msg === "INSUFFICIENT_POINTS") {
      return NextResponse.json({ error: "Adjustment would result in negative balance" }, { status: 400 });
    }

    console.error("Loyalty adjustment error:", error);
    return NextResponse.json({ error: "Failed to adjust loyalty points" }, { status: 500 });
  }
}