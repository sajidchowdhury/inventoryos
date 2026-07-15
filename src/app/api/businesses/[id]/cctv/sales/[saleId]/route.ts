// GET /api/businesses/[id]/cctv/sales/[saleId]
// Returns a single sale with all items + customer info for invoice printing
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeDecimals } from "@/lib/decimal-serializer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; saleId: string }> }) {
  const { id: businessId, saleId } = await params;

  const sale = await db.cCTVSale.findFirst({
    where: { id: saleId, businessId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  // Get customer info if linked
  let customer = null;
  if (sale.customerId) {
    customer = await db.cCTVCustomer.findUnique({
      where: { id: sale.customerId },
      select: { id: true, name: true, phone: true, address: true },
    });
  }

  // Get business info
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, phone: true, address: true },
  });

  // Calculate previous due (all previous sales' due minus payments)
  let previousDue = 0;
  if (sale.customerId) {
    const prevSales = await db.cCTVSale.findMany({
      where: {
        businessId,
        customerId: sale.customerId,
        id: { not: saleId },
      },
      select: { totalAmount: true, paidAmount: true },
    });
    previousDue = prevSales.reduce((s, x) => s + Number(x.totalAmount) - Number(x.paidAmount), 0);
  }

  return NextResponse.json({
    success: true,
    sale: serializeDecimals(sale),
    customer: serializeDecimals(customer),
    business,
    previousDue,
  });
}
