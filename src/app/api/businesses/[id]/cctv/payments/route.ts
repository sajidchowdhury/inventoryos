// POST /api/businesses/[id]/cctv/payments
// Record a payment — customer payment or supplier payment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // customer_payment, supplier_payment
  const partyId = searchParams.get("partyId");

  const where: Record<string, unknown> = { businessId };
  if (type) where.type = type;
  if (partyId) {
    where.OR = [
      { customerId: partyId },
      { supplierId: partyId },
    ];
  }

  const payments = await db.cCTVPayment.findMany({
    where,
    orderBy: { paymentDate: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, payments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const body = await req.json();

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json({ error: "Payment type is required (customer_payment or supplier_payment)" }, { status: 400 });
  }

  const payment = await db.cCTVPayment.create({
    data: {
      businessId,
      type: body.type, // customer_payment, supplier_payment
      customerId: body.customerId || null,
      supplierId: body.supplierId || null,
      amount: parseFloat(body.amount),
      paymentMethod: body.paymentMethod || "cash",
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ success: true, payment }, { status: 201 });
}
