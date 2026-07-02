// POST /api/auth/verify-otp
// Verifies OTP and returns user info + any businesses linked to that phone.
// Also issues a short-lived phone-proof token (used by owner-login) and,
// optionally, a long-lived trusted-device token so this device can skip OTP
// on future visits.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  listOwnerBusinesses,
  issuePhoneToken,
  createTrustedDevice,
} from "@/lib/phone-auth";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, trustDevice } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, "");

    // Find the most recent unused OTP for this phone
    const otpRecord = await db.otpVerification.findFirst({
      where: {
        phone: cleanPhone,
        otp,
        purpose: "LOGIN",
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 401 }
      );
    }

    // Mark OTP as used
    await db.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Find or create user
    let user = await db.user.findUnique({
      where: { phone: cleanPhone },
    });

    if (!user) {
      user = await db.user.create({
        data: { phone: cleanPhone },
      });
    }

    // Find all businesses for this user
    const businesses = await listOwnerBusinesses(user.id);

    // Short-lived proof that this phone was just verified (required by owner-login).
    const phoneToken = await issuePhoneToken(user.id);

    // Optionally remember this device so future visits can skip OTP.
    let deviceToken: string | null = null;
    if (trustDevice) {
      deviceToken = await createTrustedDevice(
        user.id,
        req.headers.get("user-agent") || null
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, phone: user.phone, name: user.name },
      businesses,
      phoneToken,
      deviceToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
