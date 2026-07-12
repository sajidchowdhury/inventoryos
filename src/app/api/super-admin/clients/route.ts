// GET /api/super-admin/clients
// P4: Lists all businesses with subscription stage badges + revenue info.
// Supports filtering by stage, tier, payment status + search by name/phone.
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

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const stage = url.searchParams.get("stage"); // active/expiring_soon/read_only/data_wiped
    const tier = url.searchParams.get("tier"); // free/pro/pro_ai
    const search = url.searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (stage) where.subscriptionStage = stage;
    if (tier) where.subscriptionTier = tier;
    if (search) {
      // TODO (Phase 2A): restore mode:"insensitive" for proper case-insensitive search.
      // It was removed temporarily during the SQLite-to-PostgreSQL migration.
      // See InventoryOS_Architecture_Roadmap.docx Problem 2.
      where.OR = [
        { name: { contains: search } },
        { user: { phone: { contains: search } } },
      ];
    }

    const businesses = await db.business.findMany({
      where,
      orderBy: { subscriptionEnd: "asc" },
      select: {
        id: true,
        name: true,
        shopCode: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionStage: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        dataSoftDeletedAt: true,
        createdAt: true,
        user: { select: { phone: true, name: true } },
        businessType: { select: { name: true, slug: true } },
        _count: { select: { paymentTransactions: true, subscriptionInvoices: true } },
      },
      take: 500,
    });

    // ── Enrich with tier price + last payment info ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const clients = await Promise.all(
      businesses.map(async (b) => {
        const tierConfig = getTierConfig(b.subscriptionTier);
        const lastPayment = await db.paymentTransaction.findFirst({
          where: { businessId: b.id, status: "matched" },
          orderBy: { matchedAt: "desc" },
          select: { id: true, amount: true, method: true, matchedAt: true },
        });

        const matchedThisMonth = await db.paymentTransaction.aggregate({
          where: {
            businessId: b.id,
            status: "matched",
            matchedAt: { gte: monthStart },
          },
          _sum: { amount: true },
        });

        return {
          ...b,
          tierLabel: tierConfig.label,
          monthlyAmount: tierConfig.price,
          lastPayment: lastPayment || null,
          receivedThisMonth: matchedThisMonth._sum.amount ?? 0,
        };
      })
    );

    // ── Summary ──
    const summary = {
      total: clients.length,
      active: clients.filter((c) => c.subscriptionStage === "active").length,
      expiringSoon: clients.filter((c) => c.subscriptionStage === "expiring_soon").length,
      readOnly: clients.filter((c) => c.subscriptionStage === "read_only").length,
      dataWiped: clients.filter((c) => c.subscriptionStage === "data_wiped").length,
    };

    return NextResponse.json({ success: true, clients, summary });
  } catch (error) {
    console.error("Clients list error:", error);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }
}
