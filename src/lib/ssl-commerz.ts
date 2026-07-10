// src/lib/ssl-commerz.ts
// ── InventoryOS: SSL Commerz Gateway Integration (P5) ──
//
// Initiates SSL Commerz EasyCheckout payment sessions + verifies transactions
// on callback. Uses the SSL Commerz REST API (v4 format).
//
// Sandbox: https://sandbox-securepay.sslcommerz.com/gwprocess/v4/api/v3
// Production: https://securepay.sslcommerz.com/gwprocess/v4/api/v3
//
// Flow:
//   1. User taps "Pay with Card" → POST /subscription/pay/ssl → this module
//      calls SSL Commerz's session creation API → returns GatewayPageURL
//   2. User is redirected to SSL Commerz's hosted checkout page
//   3. After payment, SSL Commerz sends POST callbacks to /success, /fail, /cancel
//   4. On success callback, this module verifies the transaction via SSL Commerz's
//      validation API → if valid, extends subscription (same as manual match)

import { getPaymentConfig } from "@/lib/payment-config";

const SANDBOX_BASE = "https://sandbox-securepay.sslcommerz.com";
const PRODUCTION_BASE = "https://securepay.sslcommerz.com";

function getBaseUrl(mode: "sandbox" | "production"): string {
  return mode === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

export interface SslSessionResult {
  success: boolean;
  gatewayUrl?: string;
  tranId?: string;
  error?: string;
}

/**
 * Initiate an SSL Commerz payment session.
 * Returns the GatewayPageURL that the client redirects to.
 */
export async function initiateSslPayment(params: {
  businessId: string;
  businessName: string;
  amount: number;
  billingPeriod: "month" | "year";
  tier: string;
  customerPhone: string;
  customerEmail?: string;
}): Promise<SslSessionResult> {
  const config = await getPaymentConfig();

  if (!config.sslStoreId || !config.sslStorePasswd) {
    return {
      success: false,
      error: "SSL Commerz is not configured. Contact the administrator.",
    };
  }

  const tranId = `SSL-${params.businessId.slice(-8)}-${Date.now()}`;
  const baseUrl = getBaseUrl(config.sslMode);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const requestBody = new URLSearchParams({
    store_id: config.sslStoreId,
    store_passwd: config.sslStorePasswd,
    total_amount: String(params.amount),
    currency: "BDT",
    tran_id: tranId,
    success_url: `${appUrl}/api/payment/ssl/success`,
    fail_url: `${appUrl}/api/payment/ssl/fail`,
    cancel_url: `${appUrl}/api/payment/ssl/cancel`,
    cus_name: params.businessName,
    cus_email: params.customerEmail || "customer@inventoryos.app",
    cus_phone: params.customerPhone,
    cus_add1: "Bangladesh",
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    product_name: `InventoryOS ${params.tier} (${params.billingPeriod})`,
    product_category: "Software Subscription",
    product_profile: "non-physical-goods",
    ship_name: params.businessName,
    ship_add1: "Bangladesh",
    ship_city: "Dhaka",
    ship_country: "Bangladesh",
    type: "json",
  });

  try {
    const res = await fetch(`${baseUrl}/gwprocess/v4/api/v3`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    const data = await res.json();

    if (data.status === "SUCCESS" && data.GatewayPageURL) {
      return {
        success: true,
        gatewayUrl: data.GatewayPageURL,
        tranId,
      };
    }

    return {
      success: false,
      error: data.failedreason || "SSL Commerz session creation failed",
    };
  } catch (error) {
    console.error("[ssl-commerz] initiate error:", error);
    return {
      success: false,
      error: "Failed to connect to SSL Commerz. Please try again.",
    };
  }
}

export interface SslVerificationResult {
  valid: boolean;
  tranId: string;
  amount: number;
  status: string;
  error?: string;
}

/**
 * Verify an SSL Commerz transaction after the success callback.
 * Calls SSL Commerz's transaction validation API.
 */
export async function verifySslTransaction(
  tranId: string
): Promise<SslVerificationResult> {
  const config = await getPaymentConfig();

  if (!config.sslStoreId || !config.sslStorePasswd) {
    return {
      valid: false,
      tranId,
      amount: 0,
      status: "error",
      error: "SSL Commerz not configured",
    };
  }

  const baseUrl = getBaseUrl(config.sslMode);
  const verifyUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${tranId}&store_id=${config.sslStoreId}&store_passwd=${config.sslStorePasswd}&format=json`;

  try {
    const res = await fetch(verifyUrl);
    const data = await res.json();

    if (data.status === "VALID" || data.status === "VALIDATED") {
      return {
        valid: true,
        tranId,
        amount: parseFloat(data.amount) || 0,
        status: data.status,
      };
    }

    return {
      valid: false,
      tranId,
      amount: parseFloat(data.amount) || 0,
      status: data.status || "invalid",
      error: data.error || "Transaction verification failed",
    };
  } catch (error) {
    console.error("[ssl-commerz] verify error:", error);
    return {
      valid: false,
      tranId,
      amount: 0,
      status: "error",
      error: "Failed to verify transaction with SSL Commerz",
    };
  }
}
