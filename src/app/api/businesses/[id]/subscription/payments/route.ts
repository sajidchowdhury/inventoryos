// GET /api/businesses/[id]/subscription/payments
// P3: Returns the user's payment history (pending + matched + rejected).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    const payments = await db.paymentTransaction.findMany({
      where: { businessId },
      orderBy: { submittedAt: "desc" },
      take: 50,
      select: {
        id: true,
        method: true,
        trxId: true,
        amount: true,
        status: true,
        submittedAt: true,
        matchedAt: true,
        matchedBy: true,
        notes: true,
      },
    });

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Payment history error:", error);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}
