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

    return NextResponse.json({
      success: true,
      client: {
        ...business,
        tierLabel: tierConfig.label,
        monthlyAmount: tierConfig.price,
        annualAmount: tierConfig.annualPrice,
      },
      payments,
      invoices,
      revenue: {
        totalReceived: totalReceived._sum.amount ?? 0,
        receivedThisMonth: receivedThisMonth._sum.amount ?? 0,
        expectedMonthly: tierConfig.price,
      },
    });
  } catch (error) {
    console.error("Client detail error:", error);
    return NextResponse.json({ error: "Failed to load client" }, { status: 500 });
  }
}
