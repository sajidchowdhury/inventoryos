// POST /api/businesses/[id]/mobile-shop/customers/[customerId]/redeem
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> },
) {
  try {
    const { id: businessId, customerId } = await params;
    const body = await req.json();

    const { points } = body as { points: number };

    // Validate points
    if (!points || typeof points !== "number" || points <= 0) {
      return NextResponse.json({ error: "Points must be a positive number" }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // Validate customer exists and is active
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId, isActive: true },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      // Validate customer has enough points
      if (customer.loyaltyPoints < points) {
        throw new Error("INSUFFICIENT_POINTS");
      }

      // Get loyalty config
      const config = await tx.cCTVLoyaltyConfig.findFirst({
        where: { businessId, isActive: true },
      });

      if (!config) {
        throw new Error("CONFIG_NOT_FOUND");
      }

      // Calculate redemption units
      const units = Math.floor(points / config.redeemPointsRequired);
      if (units === 0) {
        throw new Error("NOT_ENOUGH_TO_REDEEM");
      }

      const pointsToRedeem = units * config.redeemPointsRequired;
      const discountValue = units * config.redeemRateValue;
      const remainingPoints = customer.loyaltyPoints - pointsToRedeem;

      // Deduct points from customer
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: remainingPoints,
        },
      });

      // Create REDEEM transaction
      const transaction = await tx.cCTVLoyaltyTransaction.create({
        data: {
          businessId,
          customerId,
          type: "REDEEM",
          points: -pointsToRedeem,
          balanceAfter: remainingPoints,
          description: `Redeemed ${pointsToRedeem} points for ${discountValue} BDT discount`,
        },
      });

      return {
        pointsRedeemed: pointsToRedeem,
        discountValue,
        remainingPoints,
        transaction,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json({ error: "Customer not found or inactive" }, { status: 404 });
    }
    if (msg === "INSUFFICIENT_POINTS") {
      return NextResponse.json(
        { error: `Customer does not have enough loyalty points` },
        { status: 400 },
      );
    }
    if (msg === "CONFIG_NOT_FOUND") {
      return NextResponse.json(
        { error: "Loyalty program is not configured or not active" },
        { status: 400 },
      );
    }
    if (msg === "NOT_ENOUGH_TO_REDEEM") {
      return NextResponse.json(
        { error: "Not enough points to redeem. Points must be at least the redemption threshold." },
        { status: 400 },
      );
    }

    console.error("Loyalty redeem error:", error);
    return NextResponse.json({ error: "Failed to redeem loyalty points" }, { status: 500 });
  }
}