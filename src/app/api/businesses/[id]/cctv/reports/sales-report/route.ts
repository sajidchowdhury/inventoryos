// GET /api/businesses/[id]/cctv/reports/sales-report?from=&to=&customerId=&paymentMethod=
// SR-2: methodBreakdown now respects the sale filter (customerId/paymentMethod)
//   so the breakdown matches the filtered sales.
// SR-3: accepts ?groupBy=day|week|month to bucket sales by time period.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const customerId = searchParams.get("customerId");
  const paymentMethod = searchParams.get("paymentMethod");
  // SR-3: optional time bucketing. Default = no bucketing (flat list).
  const groupBy = searchParams.get("groupBy"); // "day" | "week" | "month" | null

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

  const totalAmount = filteredSales.reduce((s, x) => s + Number(x.totalAmount), 0);
  const totalPaid = filteredSales.reduce((s, x) => s + Number(x.paidAmount), 0);
  const totalDue = filteredSales.reduce((s, x) => s + Number(x.dueAmount), 0);

  // SR-2: Payment method breakdown — now respects the customerId filter.
  // Previously summed ALL payments in the date range regardless of the
  // sale filter. Now we sum only payments linked to the filtered sales.
  const filteredSaleIds = new Set(filteredSales.map((s) => s.id));
  const allPayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "sale",
      paymentDate: { gte: startDate, lte: endDate },
      // SR-2: if customerId is set, only count payments for sales that
      // belong to that customer (i.e., referenceId in filteredSaleIds).
      // If no customerId filter, filteredSaleIds is all sales — no
      // extra constraint needed.
      ...(customerId ? { referenceId: { in: Array.from(filteredSaleIds) } } : {}),
    },
    select: { paymentMethod: true, amount: true },
  });
  const methodBreakdown: Record<string, number> = {};
  for (const p of allPayments) {
    methodBreakdown[p.paymentMethod] = (methodBreakdown[p.paymentMethod] || 0) + Number(p.amount);
  }

  // Top products in this period
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const sale of filteredSales) {
    for (const item of sale.items) {
      const key = item.productName;
      if (!productSales[key]) productSales[key] = { name: key, qty: 0, revenue: 0 };
      productSales[key].qty += item.quantity;
      productSales[key].revenue += Number(item.sellPrice) * item.quantity;
    }
  }
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // SR-3: time-bucketed aggregation. Returns `buckets` alongside the flat
  // `sales` list so the UI can choose which to render. Each bucket sums
  // count + totalAmount + totalPaid + totalDue for that period.
  let buckets: { period: string; count: number; totalAmount: number; totalPaid: number; totalDue: number }[] | undefined;
  if (groupBy) {
    const bucketMap = new Map<string, { count: number; totalAmount: number; totalPaid: number; totalDue: number }>();
    const bucketKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      if (groupBy === "month") return `${y}-${m}`;
      if (groupBy === "week") {
        // ISO week: get the Monday of the week
        const tmp = new Date(d);
        tmp.setHours(0, 0, 0, 0);
        tmp.setDate(tmp.getDate() - ((tmp.getDay() + 6) % 7));
        return tmp.toISOString().split("T")[0];
      }
      return `${y}-${m}-${day}`; // day
    };
    for (const s of filteredSales) {
      const key = bucketKey(new Date(s.saleDate));
      if (!bucketMap.has(key)) bucketMap.set(key, { count: 0, totalAmount: 0, totalPaid: 0, totalDue: 0 });
      const b = bucketMap.get(key)!;
      b.count++;
      b.totalAmount += Number(s.totalAmount);
      b.totalPaid += Number(s.paidAmount);
      b.totalDue += Number(s.dueAmount);
    }
    buckets = Array.from(bucketMap.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

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
    // SR-3: only present when ?groupBy= is set
    ...(buckets ? { buckets } : {}),
  });
}
