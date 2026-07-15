// GET /api/businesses/[id]/cctv/reports/due-collection
// Shows all customers with outstanding dues + aging (how long overdue)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  const customers = await db.cCTVCustomer.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, openingBalance: true, createdAt: true },
  });

  const now = new Date();
  const result = [];

  for (const c of customers) {
    const sales = await db.cCTVSale.findMany({
      where: { businessId, customerId: c.id },
      select: { id: true, saleDate: true, totalAmount: true, paidAmount: true, dueAmount: true, invoiceNo: true },
      orderBy: { saleDate: "asc" },
    });

    const totalPurchases = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const totalPaid = sales.reduce((s, x) => s + Number(x.paidAmount), 0);
    const balance = Number(c.openingBalance) + totalPurchases - totalPaid;

    if (balance > 0) {
      // Find oldest unpaid sale for aging
      const unpaidSales = sales.filter((s) => s.dueAmount > 0);
      let oldestDueDate: Date | null = null;
      if (unpaidSales.length > 0) {
        oldestDueDate = new Date(unpaidSales[0].saleDate);
      }

      let agingDays = 0;
      if (oldestDueDate) {
        agingDays = Math.floor((now.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      result.push({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance,
        openingBalance: Number(c.openingBalance),
        totalPurchases,
        totalPaid,
        unpaidSalesCount: unpaidSales.length,
        oldestDueDate: oldestDueDate?.toISOString().split("T")[0] || null,
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
    },
    customers: result,
  });
}
