// POST /api/businesses/[id]/subscription/pay/ssl
// P5: Initiate an SSL Commerz payment session.
// Returns a GatewayPageURL that the client redirects to.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentConfig } from "@/lib/payment-config";
import { initiateSslPayment } from "@/lib/ssl-commerz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;

  try {
    const body = await req.json();
    const { billingPeriod } = body as { billingPeriod?: string };

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, subscriptionTier: true, ownerEmail: true, user: { select: { phone: true } } },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const config = await getPaymentConfig();
    if (!config.sslActive || !config.sslStoreId) {
      return NextResponse.json({ error: "Card payments are not enabled. Use bKash or Nagad instead." }, { status: 400 });
    }

    // Determine amount based on tier + billing period
    const period: "month" | "year" = billingPeriod === "year" ? "year" : "month";
    let amount: number;
    if (business.subscriptionTier === "pro") {
      amount = period === "year" ? config.proAnnual : config.proMonthly;
    } else if (business.subscriptionTier === "pro_ai") {
      amount = period === "year" ? config.proAiAnnual : config.proAiMonthly;
    } else {
      return NextResponse.json({ error: "Free tier does not require payment" }, { status: 400 });
    }

    const result = await initiateSslPayment({
      businessId: business.id,
      businessName: business.name,
      amount,
      billingPeriod: period,
      tier: business.subscriptionTier,
      customerPhone: business.user.phone,
      customerEmail: business.ownerEmail || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Create a pending PaymentTransaction for tracking
    await db.paymentTransaction.create({
      data: {
        businessId,
        method: "ssl_commerz",
        trxId: result.tranId!,
        amount,
        status: "pending",
        notes: `SSL Commerz ${period} payment`,
      },
    });

    return NextResponse.json({
      success: true,
      gatewayUrl: result.gatewayUrl,
      tranId: result.tranId,
      amount,
      billingPeriod: period,
    });
  } catch (error) {
    console.error("SSL payment initiation error:", error);
    return NextResponse.json({ error: "Failed to initiate payment" }, { status: 500 });
  }
}
