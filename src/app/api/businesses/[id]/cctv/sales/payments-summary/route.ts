// GET /api/businesses/[id]/cctv/sales/payments-summary
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);

    const fromParam = url.searchParams.get("from")?.trim() || "";
    const toParam = url.searchParams.get("to")?.trim() || "";

    // Default to current month if no dates provided
    const now = new Date();
    const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch all active sales within date range
    const sales = await db.cCTVSale.findMany({
      where: {
        businessId,
        isActive: true,
        createdAt: { gte: from, lte: to },
      },
      select: {
        subtotal: true,
        discountAmount: true,
        totalDue: true,
        status: true,
        payments: {
          where: { isActive: true },
          select: { method: true, amount: true },
        },
      },
    });

    let totalSales = 0;
    let totalRevenue = 0;
    let totalDiscount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let partiallyPaidCount = 0;

    const paymentMethodBreakdown: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      BKASH: 0,
      NAGAD: 0,
      ROCKET: 0,
    };

    for (const sale of sales) {
      totalSales += 1;
      totalRevenue += sale.totalDue;
      totalDiscount += sale.discountAmount;

      if (sale.status === "PAID") paidCount += 1;
      else if (sale.status === "PARTIALLY_PAID") partiallyPaidCount += 1;
      else pendingCount += 1;

      for (const payment of sale.payments) {
        if (payment.method in paymentMethodBreakdown) {
          paymentMethodBreakdown[payment.method] += payment.amount;
        }
      }
    }

    return NextResponse.json({
      totalSales,
      totalRevenue,
      totalDiscount,
      paidCount,
      pendingCount,
      partiallyPaidCount,
      paymentMethodBreakdown,
    });
  } catch (error) {
    console.error("Payments summary error:", error);
    return NextResponse.json({ error: "Failed to get payments summary" }, { status: 500 });
  }
}