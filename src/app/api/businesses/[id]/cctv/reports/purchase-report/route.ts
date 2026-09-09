// GET /api/businesses/[id]/cctv/reports/purchase-report?from=&to=&supplierId=&paymentMethod=
// PR-2: accepts ?paymentMethod= filter (asymmetric with Sales Report previously).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const supplierId = searchParams.get("supplierId");
  // PR-2: payment method filter — mirrors the Sales Report's filter.
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
    purchaseDate: { gte: startDate, lte: endDate },
  };
  if (supplierId) where.supplierId = supplierId;

  const purchases = await db.cCTVPurchase.findMany({
    where,
    include: {
      items: { select: { id: true, productName: true, quantity: true, costPrice: true, serialNumbers: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { purchaseDate: "desc" },
  });

  // PR-2: if paymentMethod filter, fetch matching supplier payments and
  // filter purchases to those paid via that method. A purchase may have
  // multiple payments; we include it if ANY payment matches the method.
  let filteredPurchases = purchases;
  if (paymentMethod && paymentMethod !== "all") {
    const payments = await db.cCTVPayment.findMany({
      where: {
        businessId,
        type: "purchase",
        paymentMethod,
        paymentDate: { gte: startDate, lte: endDate },
      },
      select: { referenceId: true },
    });
    const purchaseIds = new Set(payments.map((p) => p.referenceId));
    filteredPurchases = purchases.filter((p) => purchaseIds.has(p.id));
  }

  const totalAmount = filteredPurchases.reduce((s, x) => s + Number(x.totalAmount), 0);
  const totalPaid = filteredPurchases.reduce((s, x) => s + Number(x.paidAmount), 0);
  const totalDue = filteredPurchases.reduce((s, x) => s + Number(x.dueAmount), 0);

  // Top purchased products
  const productPurchases: Record<string, { name: string; qty: number; cost: number }> = {};
  for (const pur of filteredPurchases) {
    for (const item of pur.items) {
      const key = item.productName;
      if (!productPurchases[key]) productPurchases[key] = { name: key, qty: 0, cost: 0 };
      productPurchases[key].qty += item.quantity;
      productPurchases[key].cost += Number(item.costPrice) * item.quantity;
    }
  }
  const topProducts = Object.values(productPurchases).sort((a, b) => b.cost - a.cost).slice(0, 10);

  // Supplier breakdown
  const supplierBreakdown: Record<string, number> = {};
  for (const pur of filteredPurchases) {
    const key = pur.supplierName || "Unknown";
    supplierBreakdown[key] = (supplierBreakdown[key] || 0) + Number(pur.totalAmount);
  }

  // PR-2: payment method breakdown (mirrors Sales Report)
  const filteredPurchaseIds = new Set(filteredPurchases.map((p) => p.id));
  const methodPayments = await db.cCTVPayment.findMany({
    where: {
      businessId,
      type: "purchase",
      paymentDate: { gte: startDate, lte: endDate },
      ...(supplierId ? { referenceId: { in: Array.from(filteredPurchaseIds) } } : {}),
    },
    select: { paymentMethod: true, amount: true },
  });
  const methodBreakdown: Record<string, number> = {};
  for (const p of methodPayments) {
    methodBreakdown[p.paymentMethod] = (methodBreakdown[p.paymentMethod] || 0) + Number(p.amount);
  }

  return NextResponse.json({
    success: true,
    summary: {
      count: filteredPurchases.length,
      totalAmount,
      totalPaid,
      totalDue,
      supplierBreakdown,
      methodBreakdown, // PR-2
    },
    purchases: filteredPurchases,
    topProducts,
  });
}
