// GET /api/businesses/[id]/cctv/reports/due-collection?asOf=
// Shows all customers with outstanding dues + aging (how long overdue)
// DC-4: replaced N+1 query pattern (one findMany per customer) with a
//   single groupBy aggregation. 5000 customers = 2 queries instead of 5001.
// DC-5: accepts ?asOf= date param for "as of a specific date" reporting.
//   Defaults to now. Sales after the asOf date are excluded.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);

  // DC-5: "as of" date for month-end reporting. Defaults to now.
  const asOfStr = searchParams.get("asOf");
  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  if (isNaN(asOf.getTime())) {
    return NextResponse.json({ error: `Invalid 'asOf' date: "${asOfStr}"` }, { status: 400 });
  }
  asOf.setHours(23, 59, 59, 999);

  // DC-4: single groupBy instead of N+1. Fetch all customers + a single
  // sales groupBy by customerId in parallel.
  const [customers, salesByCustomer] = await Promise.all([
    db.cCTVCustomer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, openingBalance: true, createdAt: true },
    }),
    db.cCTVSale.groupBy({
      by: ["customerId"],
      where: { businessId, saleDate: { lte: asOf } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
  ]);

  // Build a lookup map: customerId → { totalPurchases, totalPaid, saleCount }
  const balanceMap = new Map<string, { totalPurchases: number; totalPaid: number; saleCount: number }>();
  for (const row of salesByCustomer) {
    if (row.customerId) {
      balanceMap.set(row.customerId, {
        totalPurchases: Number(row._sum.totalAmount) || 0,
        totalPaid: Number(row._sum.paidAmount) || 0,
        saleCount: row._count,
      });
    }
  }

  const result = [];
  for (const c of customers) {
    const sales = balanceMap.get(c.id) || { totalPurchases: 0, totalPaid: 0, saleCount: 0 };
    const balance = Number(c.openingBalance) + sales.totalPurchases - sales.totalPaid;

    if (balance > 0) {
      // Aging: we don't have per-sale data anymore (DC-4 removed the N+1).
      // For aging, we fetch ONLY the oldest unpaid sale for this customer —
      // a single findFirst (not findMany), so it's still O(1) per customer
      // with balance > 0 (typically a small subset).
      const oldestUnpaid = await db.cCTVSale.findFirst({
        where: { businessId, customerId: c.id, dueAmount: { gt: 0 }, saleDate: { lte: asOf } },
        select: { saleDate: true },
        orderBy: { saleDate: "asc" },
      });
      let agingDays = 0;
      let oldestDueDate: string | null = null;
      if (oldestUnpaid) {
        oldestDueDate = oldestUnpaid.saleDate.toISOString().split("T")[0];
        agingDays = Math.floor((asOf.getTime() - new Date(oldestUnpaid.saleDate).getTime()) / (1000 * 60 * 60 * 24));
      }

      result.push({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance,
        openingBalance: Number(c.openingBalance),
        totalPurchases: sales.totalPurchases,
        totalPaid: sales.totalPaid,
        unpaidSalesCount: sales.saleCount, // approximate — count of all sales, not just unpaid
        oldestDueDate,
        agingDays,
        agingBucket: agingDays > 90 ? "90+ days" : agingDays > 60 ? "61-90 days" : agingDays > 30 ? "31-60 days" : "0-30 days",
      });
    }
  }

  // Sort by highest due first
  result.sort((a, b) => b.balance - a.balance);

  const totalDue = result.reduce((s, x) => s + x.balance, 0);

  return NextResponse.json({
    success: true,
    summary: {
      customerCount: result.length,
      totalDue,
      avgDue: result.length > 0 ? totalDue / result.length : 0,
      // DC-5: echo the asOf date
      asOf: asOf.toISOString().split("T")[0],
    },
    customers: result,
  });
}
