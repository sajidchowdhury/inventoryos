// POST /api/payment/ssl/fail
// P5: SSL Commerz failure callback. Marks the payment as rejected.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tranId = formData.get("tran_id") as string;

    if (tranId) {
      await db.paymentTransaction.updateMany({
        where: { trxId: tranId, status: "pending", method: "ssl_commerz" },
        data: { status: "rejected", notes: "SSL Commerz payment failed" },
      });
    }

    return NextResponse.redirect(new URL("/subscription?ssl=failed", req.url));
  } catch (error) {
    console.error("[ssl-fail] callback error:", error);
    return NextResponse.redirect(new URL("/subscription?ssl=error", req.url));
  }
}
