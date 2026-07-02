// POST /api/auth/send-otp
// Demo: always returns OTP 9999 for phone 01787492561
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEMO_PHONE = "01787492561";
const DEMO_OTP = "9999";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || phone.trim().length < 11) {
      return NextResponse.json(
        { error: "Please enter a valid phone number" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, "");
    const otp = cleanPhone === DEMO_PHONE ? DEMO_OTP : DEMO_OTP; // Always 9999 for now

    // Store OTP in database
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    await db.otpVerification.create({
      data: {
        phone: cleanPhone,
        otp,
        purpose: "LOGIN",
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      // In demo mode, we return the OTP. Remove in production!
      demoOtp: otp,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
