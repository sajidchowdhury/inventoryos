// GET /api/super-admin/clients/[id]
// P4: Client detail — subscription timeline + payment history + expected/received.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTierConfig } from "@/lib/feature-gate";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: { id: true, superAdminId: true, expiresAt: true, superAdmin: { select: { id: true, isActive: true } } },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;

  try {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true, name: true, shopCode: true, address: true, phone: true,
        subscriptionTier: true, subscriptionStatus: true, subscriptionStage: true,
        subscriptionStart: true, subscriptionEnd: true,
        gracePeriodEnd: true, dataWipeDate: true, dataSoftDeletedAt: true, dataPurgeDate: true,
        aiEnabled: true, ownerEmail: true, ownerWhatsapp: true,
        createdAt: true,
        user: { select: { phone: true, name: true } },
        businessType: { select: { name: true, slug: true } },
        _count: {
          select: {
            products: true, sales: true, businessUsers: true,
            customers: true, suppliers: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const tierConfig = getTierConfig(business.subscriptionTier);

    // ── Payment history ──
    const payments = await db.paymentTransaction.findMany({
      where: { businessId },
      orderBy: { submittedAt: "desc" },
      take: 30,
      select: {
        id: true, method: true, trxId: true, amount: true, status: true,
        submittedAt: true, matchedAt: true, matchedBy: true, notes: true,
      },
    });

    // ── Invoices ──
    const invoices = await db.subscriptionInvoice.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    // ── Revenue summary ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalReceived = await db.paymentTransaction.aggregate({
      where: { businessId, status: "matched" },
      _sum: { amount: true },
    });

    const receivedThisMonth = await db.paymentTransaction.aggregate({
      where: { businessId, status: "matched", matchedAt: { gte: monthStart } },
      _sum: { amount: true },
    });

    // ── Business-specific data based on type ──
    let businessStats: any = {};

    if (business.businessType.slug === "cctv-shop") {
      const [cctvProducts, cctvSales, cctvCustomers, cctvRepairs] = await Promise.all([
        db.cCTVProduct.count({ where: { businessId } }),
        db.cCTVSale.count({ where: { businessId } }),
        db.cCTVCustomer.count({ where: { businessId } }),
        db.cCTVRepair.count({ where: { businessId } }),
      ]);

      const cctvSalesData = await db.cCTVSale.aggregate({
        where: { businessId },
        _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
      });

      // Get recent products (what client is using)
      const recentProducts = await db.cCTVProduct.findMany({
        where: { businessId },
        select: { id: true, name: true, brand: true, stock: true, sellPrice: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      businessStats = {
        products: cctvProducts,
        sales: cctvSales,
        customers: cctvCustomers,
        repairs: cctvRepairs,
        totalSalesAmount: cctvSalesData._sum.totalAmount ?? 0,
        totalPaid: cctvSalesData._sum.paidAmount ?? 0,
        totalDue: cctvSalesData._sum.dueAmount ?? 0,
        recentProducts,
      };
    } else if (business.businessType.slug === "pharmacy") {
      const [pharmProducts, pharmSales, pharmCustomers] = await Promise.all([
        db.product.count({ where: { businessId } }),
        db.sale.count({ where: { businessId } }),
        db.customer.count({ where: { businessId } }),
      ]);

      const pharmSalesData = await db.sale.aggregate({
        where: { businessId },
        _sum: { totalAmount: true, paidAmount: true },
      });

      const recentProducts = await db.product.findMany({
        where: { businessId },
        select: { id: true, name: true, brand: true, stock: true, sellingPrice: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      businessStats = {
        products: pharmProducts,
        sales: pharmSales,
        customers: pharmCustomers,
        totalSalesAmount: pharmSalesData._sum.totalAmount ?? 0,
        totalPaid: pharmSalesData._sum.paidAmount ?? 0,
        recentProducts,
      };
    }

    return NextResponse.json({
      success: true,
      client: {
        ...business,
        tierLabel: tierConfig.label,
        monthlyAmount: business.customMonthlyFee ? Number(business.customMonthlyFee) : tierConfig.price,
        annualAmount: tierConfig.annualPrice,
        customMonthlyFee: business.customMonthlyFee ? Number(business.customMonthlyFee) : null,
      },
      payments,
      invoices,
      revenue: {
        totalReceived: totalReceived._sum.amount ?? 0,
        receivedThisMonth: receivedThisMonth._sum.amount ?? 0,
        expectedMonthly: business.customMonthlyFee ? Number(business.customMonthlyFee) : tierConfig.price,
      },
      businessStats,
    });
  } catch (error) {
    console.error("Client detail error:", error);
    return NextResponse.json({ error: "Failed to load client" }, { status: 500 });
  }
}

// PATCH /api/super-admin/clients/[id]
// Update custom monthly fee or other fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: businessId } = await params;
  const body = await req.json();

  try {
    const updateData: Record<string, unknown> = {};

    if (body.customMonthlyFee !== undefined) {
      // null means reset to tier default, number means custom price
      updateData.customMonthlyFee = body.customMonthlyFee === null ? null : parseFloat(body.customMonthlyFee);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.business.update({
      where: { id: businessId },
      data: updateData,
    });

    return NextResponse.json({ success: true, business: updated });
  } catch (error) {
    console.error("Client update error:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}
