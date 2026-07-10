// POST /api/payment/ssl/cancel
// P5: SSL Commerz cancel callback. User cancelled the payment.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tranId = formData.get("tran_id") as string;

    if (tranId) {
      await db.paymentTransaction.updateMany({
        where: { trxId: tranId, status: "pending", method: "ssl_commerz" },
        data: { status: "rejected", notes: "User cancelled SSL Commerz payment" },
      });
    }

    return NextResponse.redirect(new URL("/subscription?ssl=cancelled", req.url));
  } catch (error) {
    console.error("[ssl-cancel] callback error:", error);
    return NextResponse.redirect(new URL("/subscription?ssl=error", req.url));
  }
}
