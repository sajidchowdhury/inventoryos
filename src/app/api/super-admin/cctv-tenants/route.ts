// GET /api/super-admin/cctv-tenants
// AP-5: Lists all CCTV-type businesses with subscription stage, last
// payment date, and data volume. Filters by the "cctv-shop" business
// type slug so a super-admin focused on CCTV sees only CCTV tenants.
//
// Auth: super-admin Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true, superAdminId: true, expiresAt: true,
        superAdmin: { select: { id: true, isActive: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // AP-5: find the CCTV business type by slug
    const cctvType = await db.businessType.findUnique({
      where: { slug: "cctv-shop" },
      select: { id: true },
    });
    if (!cctvType) {
      return NextResponse.json({ success: true, tenants: [], count: 0, message: "CCTV business type not found" });
    }

    // Fetch all CCTV businesses with related counts
    const businesses = await db.business.findMany({
      where: { businessTypeId: cctvType.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            businessUsers: true,
          },
        },
        businessType: { select: { name: true, slug: true } },
        user: { select: { phone: true, name: true } },
      },
    });

    // AP-5: fetch CCTV-specific data volume counts per business.
    // We use groupBy on the CCTV models to avoid N+1.
    const businessIds = businesses.map((b) => b.id);

    const [cctvProducts, cctvSales, cctvCustomers, cctvRepairs, cctvExpenses, lastPayments] = await Promise.all([
      db.cCTVProduct.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: true }),
      db.cCTVSale.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: true, _sum: { totalAmount: true } }),
      db.cCTVCustomer.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: true }),
      db.cCTVRepair.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: true }),
      db.cCTVExpense.groupBy({ by: ["businessId"], where: { businessId: { in: businessIds } }, _count: true, _sum: { amount: true } }),
      // AP-5: last payment per business (for the "last payment date" column)
      // PaymentTransaction has `status` and `matchedAt` (not `verifiedAt`).
      // A "matched" status means it was verified.
      db.paymentTransaction.findMany({
        where: { businessId: { in: businessIds }, status: "matched" },
        orderBy: { matchedAt: "desc" },
        select: { businessId: true, matchedAt: true, amount: true },
        take: 500,
      }),
    ]);

    // Build lookup maps
    const productMap = new Map(cctvProducts.map((r) => [r.businessId, r._count]));
    const salesMap = new Map(cctvSales.map((r) => [r.businessId, { count: r._count, revenue: Number(r._sum.totalAmount) || 0 }]));
    const customerMap = new Map(cctvCustomers.map((r) => [r.businessId, r._count]));
    const repairMap = new Map(cctvRepairs.map((r) => [r.businessId, r._count]));
    const expenseMap = new Map(cctvExpenses.map((r) => [r.businessId, { count: r._count, total: Number(r._sum.amount) || 0 }]));

    // Last payment: keep only the most recent per business
    const lastPaymentMap = new Map<string, { date: string; amount: number }>();
    for (const p of lastPayments) {
      if (!lastPaymentMap.has(p.businessId) && p.matchedAt) {
        lastPaymentMap.set(p.businessId, {
          date: p.matchedAt.toISOString().split("T")[0],
          amount: Number(p.amount) || 0,
        });
      }
    }

    // Assemble the tenant list
    const tenants = businesses.map((biz) => {
      const sales = salesMap.get(biz.id) || { count: 0, revenue: 0 };
      const expenses = expenseMap.get(biz.id) || { count: 0, total: 0 };
      const lastPay = lastPaymentMap.get(biz.id);
      return {
        id: biz.id,
        name: biz.name,
        phone: biz.phone,
        shopCode: biz.shopCode,
        address: biz.address,
        owner: biz.user ? { phone: biz.user.phone, name: biz.user.name } : null,
        userCount: biz._count.businessUsers,
        subscription: {
          tier: biz.subscriptionTier,
          status: biz.subscriptionStatus,
          stage: biz.subscriptionStage,
          start: biz.subscriptionStart,
          end: biz.subscriptionEnd,
        },
        dataVolume: {
          products: productMap.get(biz.id) || 0,
          sales: sales.count,
          salesRevenue: sales.revenue,
          customers: customerMap.get(biz.id) || 0,
          repairs: repairMap.get(biz.id) || 0,
          expenses: expenses.count,
          expenseTotal: expenses.total,
        },
        lastPayment: lastPay || null,
        createdAt: biz.createdAt.toISOString().split("T")[0],
      };
    });

    // Summary stats
    const summary = {
      totalTenants: tenants.length,
      active: tenants.filter((t) => t.subscription.stage === "active").length,
      expiringSoon: tenants.filter((t) => t.subscription.stage === "expiring_soon").length,
      readOnly: tenants.filter((t) => t.subscription.stage === "read_only").length,
      dataWiped: tenants.filter((t) => t.subscription.stage === "data_wiped").length,
      totalRevenue: tenants.reduce((s, t) => s + t.dataVolume.salesRevenue, 0),
      totalExpense: tenants.reduce((s, t) => s + t.dataVolume.expenseTotal, 0),
    };

    return NextResponse.json({ success: true, tenants, count: tenants.length, summary });
  } catch (error) {
    console.error("[cctv-tenants] GET failed:", error);
    return NextResponse.json({ error: "Failed to load CCTV tenants" }, { status: 500 });
  }
}
