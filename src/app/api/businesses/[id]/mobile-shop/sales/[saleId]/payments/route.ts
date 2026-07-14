// POST /api/businesses/[id]/mobile-shop/sales/[saleId]/payments
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_METHODS = ["CASH", "CARD", "BKASH", "NAGAD", "ROCKET"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; saleId: string }> },
) {
  try {
    const { id: businessId, saleId } = await params;
    const body = await req.json();

    const { method, amount, referenceNumber, receivedBy, notes } = body as {
      method: string;
      amount: number;
      referenceNumber?: string;
      receivedBy?: string;
      notes?: string;
    };

    // Validate method
    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json(
        { error: `Invalid payment method. Must be one of ${VALID_METHODS.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Payment amount must be greater than 0" }, { status: 400 });
    }

    const payment = await db.$transaction(async (tx) => {
      // Check sale exists, is active, and not already PAID
      const sale = await tx.cCTVSale.findFirst({
        where: { id: saleId, businessId, isActive: true },
      });

      if (!sale) {
        throw new Error("NOT_FOUND");
      }

      if (sale.status === "PAID") {
        throw new Error("ALREADY_PAID");
      }

      // Create the payment
      const newPayment = await tx.cCTVPayment.create({
        data: {
          businessId,
          saleId,
          method,
          amount,
          referenceNumber: referenceNumber?.trim() || null,
          receivedBy: receivedBy?.trim() || null,
          notes: notes?.trim() || null,
          isActive: true,
        },
      });

      // Recalculate sale status from all active payments
      const allPayments = await tx.cCTVPayment.findMany({
        where: { saleId, businessId, isActive: true },
        select: { amount: true },
      });

      const paymentSum = allPayments.reduce((sum, p) => sum + p.amount, 0);
      let status = "PENDING";
      let completedAt: Date | null = null;

      if (paymentSum >= sale.totalDue) {
        status = "PAID";
        completedAt = new Date();
      } else if (paymentSum > 0) {
        status = "PARTIALLY_PAID";
      }

      await tx.cCTVSale.update({
        where: { id: saleId },
        data: { status, completedAt },
      });

      return newPayment;
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }
    if (msg === "ALREADY_PAID") {
      return NextResponse.json({ error: "Sale is already fully paid" }, { status: 400 });
    }

    console.error("Add payment error:", error);
    return NextResponse.json({ error: "Failed to add payment" }, { status: 500 });
  }
}