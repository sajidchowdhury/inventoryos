// POST /api/auth/owner-login
// "I own a business" door: enter a shop straight from the OTP-verified business
// list — no password. Security: requires a valid short-lived phoneToken (issued
// by verify-otp / trusted-device) AND that the phone actually owns the business.
// The session is minted for the shop's highest-privilege account (owner → admin).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSessionToken } from "@/lib/auth";
import { verifyPhoneToken } from "@/lib/phone-auth";
import { getPermissionsForRole } from "@/lib/rbac";

// Preference order when choosing which BusinessUser the owner logs in as.
const ROLE_PRIORITY = ["owner", "admin", "manager", "pharmacist", "cashier", "stock_clerk"];

export async function POST(req: NextRequest) {
  try {
    const { phoneToken, businessId } = await req.json();

    if (!phoneToken || !businessId) {
      return NextResponse.json(
        { error: "Verification expired. Please verify your phone again." },
        { status: 400 }
      );
    }

    // 1. Validate the phone-proof token → resolve the owning phone-user.
    const userId = await verifyPhoneToken(phoneToken);
    if (!userId) {
      return NextResponse.json(
        { error: "Verification expired. Please verify your phone again." },
        { status: 401 }
      );
    }

    // 2. Ensure this phone actually owns the requested business.
    const business = await db.business.findFirst({
      where: { id: businessId, userId, isActive: true },
      include: {
        businessType: { select: { slug: true, name: true, color: true, icon: true } },
        businessUsers: { where: { isActive: true } },
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "You don't have access to this business." },
        { status: 403 }
      );
    }

    // 3. Pick the highest-privilege login account for this shop.
    const businessUser = [...business.businessUsers].sort(
      (a, b) =>
        (ROLE_PRIORITY.indexOf(a.role) === -1 ? 99 : ROLE_PRIORITY.indexOf(a.role)) -
        (ROLE_PRIORITY.indexOf(b.role) === -1 ? 99 : ROLE_PRIORITY.indexOf(b.role))
    )[0];

    if (!businessUser) {
      return NextResponse.json(
        { error: "This business has no login account yet. Please set one up." },
        { status: 409 }
      );
    }

    // 4. Mint a session (identical shape to /api/auth/login).
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.session.create({
      data: {
        businessUserId: businessUser.id,
        token,
        deviceInfo: req.headers.get("user-agent") || "Unknown",
        expiresAt,
      },
    });

    await db.businessUser.update({
      where: { id: businessUser.id },
      data: { lastLoginAt: new Date() },
    });

    const permissions = businessUser.permissions
      ? JSON.parse(businessUser.permissions)
      : getPermissionsForRole(businessUser.role);

    return NextResponse.json({
      success: true,
      session: { token, expiresAt: expiresAt.toISOString() },
      user: {
        id: businessUser.id,
        username: businessUser.username,
        role: businessUser.role,
        fullName: businessUser.fullName,
      },
      permissions,
      business: {
        id: business.id,
        name: business.name,
        address: business.address,
        shopCode: business.shopCode,
        businessType: business.businessType,
      },
    });
  } catch (error) {
    console.error("Owner login error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
