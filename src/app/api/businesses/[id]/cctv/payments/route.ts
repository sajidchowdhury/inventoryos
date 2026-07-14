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
    return NextResponse.json({ error: "Payment type is required (customer_payment, supplier_payment, customer_discount, supplier_discount)" }, { status: 400 });
  }

  // Map discount types to internal type for ledger recognition
  // customer_discount / supplier_discount are stored as the same type
  // but with notes prefix for ledger display
  let storedType = body.type;
  let notes = body.notes || null;
  if (body.type === "customer_discount") {
    storedType = "customer_payment"; // discount reduces customer due
    notes = `[DISCOUNT] ${body.notes || "Discount adjusted"}`;
  } else if (body.type === "supplier_discount") {
    storedType = "supplier_payment"; // discount reduces what we owe
    notes = `[DISCOUNT] ${body.notes || "Discount adjusted"}`;
  }

  const payment = await db.cCTVPayment.create({
    data: {
      businessId,
      type: storedType,
      customerId: body.customerId || null,
      supplierId: body.supplierId || null,
      amount: parseFloat(body.amount),
      paymentMethod: body.paymentMethod || "cash",
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      notes,
    },
  });

  return NextResponse.json({ success: true, payment }, { status: 201 });
}
