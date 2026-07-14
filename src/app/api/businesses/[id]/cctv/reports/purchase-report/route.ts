// GET /api/businesses/[id]/cctv/reports/purchase-report?from=&to=&supplierId=
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const supplierId = searchParams.get("supplierId");

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

  const totalAmount = purchases.reduce((s, x) => s + x.totalAmount, 0);
  const totalPaid = purchases.reduce((s, x) => s + x.paidAmount, 0);
  const totalDue = purchases.reduce((s, x) => s + x.dueAmount, 0);

  // Top purchased products
  const productPurchases: Record<string, { name: string; qty: number; cost: number }> = {};
  for (const pur of purchases) {
    for (const item of pur.items) {
      const key = item.productName;
      if (!productPurchases[key]) productPurchases[key] = { name: key, qty: 0, cost: 0 };
      productPurchases[key].qty += item.quantity;
      productPurchases[key].cost += item.costPrice * item.quantity;
    }
  }
  const topProducts = Object.values(productPurchases).sort((a, b) => b.cost - a.cost).slice(0, 10);

  // Supplier breakdown
  const supplierBreakdown: Record<string, number> = {};
  for (const pur of purchases) {
    const key = pur.supplierName || "Unknown";
    supplierBreakdown[key] = (supplierBreakdown[key] || 0) + pur.totalAmount;
  }

  return NextResponse.json({
    success: true,
    summary: {
      count: purchases.length,
      totalAmount,
      totalPaid,
      totalDue,
      supplierBreakdown,
    },
    purchases,
    topProducts,
  });
}
