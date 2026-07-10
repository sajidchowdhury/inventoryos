// GET/PUT /api/super-admin/packages
// P5: Edit tier prices + toggle payment methods + set bKash/Nagad account numbers + SSL config.
// Uses PaymentConfig DB singleton (editable from /admin without redeploying).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentConfig, updatePaymentConfig, type PaymentConfigValue } from "@/lib/payment-config";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: { id: true, superAdminId: true, expiresAt: true, superAdmin: { select: { id: true, isActive: true } } },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

// ── GET: current package config ──
export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await getPaymentConfig();

    const packages = [
      { tier: "free", label: "Free", monthlyPrice: 0, annualPrice: 0, maxProducts: 100, multiUser: false, aiEnabled: false },
      { tier: "pro", label: "Pro", monthlyPrice: config.proMonthly, annualPrice: config.proAnnual, maxProducts: null, multiUser: true, aiEnabled: false },
      { tier: "pro_ai", label: "Pro AI", monthlyPrice: config.proAiMonthly, annualPrice: config.proAiAnnual, maxProducts: null, multiUser: true, aiEnabled: true },
    ];

    return NextResponse.json({
      success: true,
      packages,
      paymentMethods: {
        bkash: { active: config.bkashActive, accountNumber: config.bkashNumber },
        nagad: { active: config.nagadActive, accountNumber: config.nagadNumber },
        sslCommerz: {
          active: config.sslActive,
          storeId: config.sslStoreId,
          mode: config.sslMode,
        },
      },
    });
  } catch (error) {
    console.error("Packages GET error:", error);
    return NextResponse.json({ error: "Failed to load packages" }, { status: 500 });
  }
}

// ── PUT: update package config ──
export async function PUT(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const updates: Partial<PaymentConfigValue> = {};

    // Tier prices
    if (typeof body.proMonthly === "number") updates.proMonthly = body.proMonthly;
    if (typeof body.proAnnual === "number") updates.proAnnual = body.proAnnual;
    if (typeof body.proAiMonthly === "number") updates.proAiMonthly = body.proAiMonthly;
    if (typeof body.proAiAnnual === "number") updates.proAiAnnual = body.proAiAnnual;

    // Payment method toggles
    if (typeof body.bkashActive === "boolean") updates.bkashActive = body.bkashActive;
    if (typeof body.nagadActive === "boolean") updates.nagadActive = body.nagadActive;
    if (typeof body.sslActive === "boolean") updates.sslActive = body.sslActive;

    // Account numbers
    if (typeof body.bkashNumber === "string") updates.bkashNumber = body.bkashNumber || null;
    if (typeof body.nagadNumber === "string") updates.nagadNumber = body.nagadNumber || null;

    // SSL Commerz config
    if (typeof body.sslStoreId === "string") updates.sslStoreId = body.sslStoreId || null;
    if (typeof body.sslStorePasswd === "string") updates.sslStorePasswd = body.sslStorePasswd || null;
    if (body.sslMode === "sandbox" || body.sslMode === "production") updates.sslMode = body.sslMode;

    const updated = await updatePaymentConfig(updates, session.superAdminId);

    return NextResponse.json({
      success: true,
      message: "Payment configuration updated successfully.",
      config: updated,
    });
  } catch (error) {
    console.error("Packages PUT error:", error);
    return NextResponse.json({ error: "Failed to update packages" }, { status: 500 });
  }
}
