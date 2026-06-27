// POST /api/auth/verify-otp
// Verifies OTP and returns user info + any businesses linked to that phone
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();

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
    const businesses = await db.business.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        businessType: {
          select: { slug: true, name: true, color: true, icon: true },
        },
        businessUsers: {
          where: { isActive: true },
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, phone: user.phone, name: user.name },
      businesses: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        businessType: b.businessType,
        hasCredentials: b.businessUsers.length > 0,
        businessUsers: b.businessUsers,
      })),
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
