// GET /api/businesses/[id]/cctv/reports/sales-report?from=&to=&customerId=&paymentMethod=
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const customerId = searchParams.get("customerId");
  const paymentMethod = searchParams.get("paymentMethod");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const startDate = new Date(from);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(to);
  endDate.setHours(23, 59, 59, 999);

  const where: any = {
    businessId,
    saleDate: { gte: startDate, lte: endDate },
  };
  if (customerId) where.customerId = customerId;
  if (paymentMethod && paymentMethod !== "all") {
    // Filter by payment method on the linked payment record
  }

  const sales = await db.cCTVSale.findMany({
    where,
    include: {
      items: { select: { id: true, productName: true, quantity: true, sellPrice: true, serialNumber: true } },
    },
    orderBy: { saleDate: "desc" },
  });

  // If paymentMethod filter, fetch matching payments and filter sales
  let filteredSales = sales;
  if (paymentMethod && paymentMethod !== "all") {
    const payments = await db.cCTVPayment.findMany({
      where: { businessId, type: "sale", paymentMethod, paymentDate: { gte: startDate, lte: endDate } },
      select: { referenceId: true },
    });
    const saleIds = new Set(payments.map((p) => p.referenceId));
    filteredSales = sales.filter((s) => saleIds.has(s.id));
  }

  const totalAmount = filteredSales.reduce((s, x) => s + x.totalAmount, 0);
  const totalPaid = filteredSales.reduce((s, x) => s + x.paidAmount, 0);
  const totalDue = filteredSales.reduce((s, x) => s + x.dueAmount, 0);

  // Payment method breakdown
  const allPayments = await db.cCTVPayment.findMany({
    where: { businessId, type: "sale", paymentDate: { gte: startDate, lte: endDate } },
    select: { paymentMethod: true, amount: true },
  });
  const methodBreakdown: Record<string, number> = {};
  for (const p of allPayments) {
    methodBreakdown[p.paymentMethod] = (methodBreakdown[p.paymentMethod] || 0) + p.amount;
  }

  // Top products in this period
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      const key = item.productName;
      if (!productSales[key]) productSales[key] = { name: key, qty: 0, revenue: 0 };
      productSales[key].qty += item.quantity;
      productSales[key].revenue += item.sellPrice * item.quantity;
    }
  }
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return NextResponse.json({
    success: true,
    summary: {
      count: filteredSales.length,
      totalAmount,
      totalPaid,
      totalDue,
      methodBreakdown,
    },
    sales: filteredSales,
    topProducts,
  });
}
