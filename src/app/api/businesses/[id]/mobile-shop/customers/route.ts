// GET/POST /api/businesses/[id]/mobile-shop/customers
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: List customers for this business with CCTV stats
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const tier = url.searchParams.get("tier")?.trim() || "";
    const sortBy = url.searchParams.get("sortBy")?.trim() || "createdAt";
    const sortDir = url.searchParams.get("sortDir")?.trim() || "desc";

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (tier) {
      where.loyaltyTier = tier;
    }

    // Validate sort field to prevent injection
    const allowedSortFields = ["createdAt", "updatedAt", "name", "totalSpent", "loyaltyPoints", "visitCount"];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const orderDirection: "asc" | "desc" = sortDir === "asc" ? "asc" : "desc";

    const customers = await db.customer.findMany({
      where,
      include: {
        _count: {
          select: { sales: true },
        },
      },
      orderBy: { [orderField]: orderDirection },
    });

    // Compute CCTV-specific stats in bulk
    const customerIds = customers.map((c) => c.id);

    let msStatsMap: Record<string, { msSalesCount: number; msTotalSpent: number }> = {};

    if (customerIds.length > 0) {
      const msStats = await db.mSSale.groupBy({
        by: ["customerId"],
        where: { businessId, customerId: { in: customerIds }, isActive: true },
        _sum: { totalDue: true },
        _count: true,
      });

      for (const stat of msStats) {
        if (stat.customerId) {
          msStatsMap[stat.customerId] = {
            msSalesCount: stat._count,
            msTotalSpent: stat._sum.totalDue || 0,
          };
        }
      }
    }

    // Merge CCTV stats into each customer
    const enriched = customers.map((c) => ({
      ...c,
      msSalesCount: msStatsMap[c.id]?.msSalesCount || 0,
      msTotalSpent: msStatsMap[c.id]?.msTotalSpent || 0,
    }));

    // Count customers with outstanding balance
    // A customer has a balance if any of their sales have totalDue > sum(payments.amount)
    let customersWithBalance = 0;
    if (customerIds.length > 0) {
      // Get all sales with payments for these customers
      const salesWithPayments = await db.mSSale.findMany({
        where: { businessId, isActive: true, customerId: { in: customerIds } },
        select: {
          customerId: true,
          totalDue: true,
          payments: { where: { isActive: true }, select: { amount: true } },
        },
      });

      const balanceSet = new Set<string>();
      for (const sale of salesWithPayments) {
        if (!sale.customerId) continue;
        const paid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
        if (sale.totalDue - paid > 0.01) {
          balanceSet.add(sale.customerId);
        }
      }
      customersWithBalance = balanceSet.size;
    }

    return NextResponse.json({
      customers: enriched,
      customersWithBalance,
    });
  } catch (error) {
    console.error("List CCTV customers error:", error);
    return NextResponse.json({ error: "Failed to list customers" }, { status: 500 });
  }
}

// POST: Create or lookup a customer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const { name, phone, email, address } = body as {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone?.trim() || null;
    const trimmedEmail = email?.trim() || null;
    const trimmedAddress = address?.trim() || null;

    // If phone is provided, try to find existing customer by businessId + phone
    if (trimmedPhone) {
      const existing = await db.customer.findFirst({
        where: { businessId, phone: trimmedPhone, isActive: true },
      });

      if (existing) {
        // Upsert-like: update name/email/address if provided
        const updated = await db.customer.update({
          where: { id: existing.id },
          data: {
            ...(trimmedName && trimmedName !== existing.name ? { name: trimmedName } : {}),
            ...(trimmedEmail && trimmedEmail !== existing.email ? { email: trimmedEmail } : {}),
            ...(trimmedAddress && trimmedAddress !== existing.address ? { address: trimmedAddress } : {}),
          },
        });

        return NextResponse.json(updated, { status: 200 });
      }
    }

    // Create new customer with loyalty defaults
    const customer = await db.customer.create({
      data: {
        businessId,
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        address: trimmedAddress,
        loyaltyPoints: 0,
        loyaltyTier: "BRONZE",
        totalSpent: 0,
        visitCount: 0,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Create CCTV customer error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}