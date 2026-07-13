// GET/PUT /api/businesses/[id]/mobile-shop/customers/[customerId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Single customer with detailed CCTV stats
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Run all stat queries in parallel
    const [msSalesCount, msTotalSpentResult, emiPlansResult, recentSales, activeEmiPlans, loyaltyConfig] =
      await Promise.all([
        // Count of MSSale for this customer
        db.mSSale.count({
          where: { businessId, customerId, isActive: true },
        }),

        // Sum of MSSale.totalDue for this customer
        db.mSSale.aggregate({
          where: { businessId, customerId, isActive: true },
          _sum: { totalDue: true },
        }),

        // Count of MSEmiPlan matching customerPhone
        db.mSEmiPlan.count({
          where: { businessId, customerPhone: customer.phone || "", isActive: true },
        }),

        // Last 5 MSSale records
        db.mSSale.findMany({
          where: { businessId, customerId, isActive: true },
          select: {
            id: true,
            saleCode: true,
            totalDue: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),

        // Active MSEmiPlan records with summary
        db.mSEmiPlan.findMany({
          where: {
            businessId,
            customerPhone: customer.phone || "",
            isActive: true,
            status: "ACTIVE",
          },
          select: {
            id: true,
            productName: true,
            remainingAmount: true,
            monthlyPayment: true,
            status: true,
            months: true,
            paidInstallments: true,
          },
        }),

        // Latest loyalty config for tier calculation
        db.mSLoyaltyConfig.findFirst({
          where: { businessId, isActive: true },
        }),
      ]);

    // Sum active EMI remaining amount
    const activeEmiRemainingAmount = activeEmiPlans.reduce(
      (sum, plan) => sum + plan.remainingAmount,
      0
    );

    // Tier calculation based on loyalty config
    let nextTier: string | null = null;
    let nextTierThreshold: number | null = null;
    if (loyaltyConfig) {
      const spent = customer.totalSpent;
      if (spent < loyaltyConfig.tierSilver) {
        nextTier = "SILVER";
        nextTierThreshold = loyaltyConfig.tierSilver;
      } else if (spent < loyaltyConfig.tierGold) {
        nextTier = "GOLD";
        nextTierThreshold = loyaltyConfig.tierGold;
      } else if (spent < loyaltyConfig.tierPlatinum) {
        nextTier = "PLATINUM";
        nextTierThreshold = loyaltyConfig.tierPlatinum;
      }
    }

    return NextResponse.json({
      ...customer,
      stats: {
        msSalesCount,
        msTotalSpent: msTotalSpentResult._sum.totalDue || 0,
        emiPlansCount: emiPlansResult,
        activeEmiRemainingAmount,
      },
      recentSales,
      activeEmiPlans,
      loyaltyConfig: loyaltyConfig || null,
      tierProgress: {
        currentTier: customer.loyaltyTier,
        nextTier,
        nextTierThreshold,
        currentTotalSpent: customer.totalSpent,
      },
    });
  } catch (error) {
    console.error("Get CCTV customer detail error:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

// PUT: Update customer
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> }
) {
  try {
    const { id: businessId, customerId } = await params;
    const body = await req.json();

    const existing = await db.customer.findFirst({
      where: { id: customerId, businessId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check duplicate phone if changing
    if (body.phone && body.phone !== existing.phone) {
      const dup = await db.customer.findFirst({
        where: { businessId, phone: body.phone, isActive: true, NOT: { id: customerId } },
      });
      if (dup) {
        return NextResponse.json(
          { error: `Phone ${body.phone} already in use by another customer` },
          { status: 400 }
        );
      }
    }

    const customer = await db.customer.update({
      where: { id: customerId },
      data: {
        name: body.name !== undefined ? (body.name?.trim() || existing.name) : existing.name,
        phone: body.phone !== undefined ? (body.phone?.trim() || null) : existing.phone,
        email: body.email !== undefined ? (body.email?.trim() || null) : existing.email,
        address: body.address !== undefined ? (body.address?.trim() || null) : existing.address,
        preferredPaymentMethod:
          body.preferredPaymentMethod !== undefined
            ? (body.preferredPaymentMethod?.trim() || null)
            : existing.preferredPaymentMethod,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : existing.notes,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Update CCTV customer error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}