// /api/auth/trusted-device
// POST:   exchange a stored trusted-device token for the phone's business list
//         plus a fresh phone-proof token — lets a returning owner skip OTP.
// DELETE: revoke a trusted-device token (used on "log out of this device").
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listOwnerBusinesses, issuePhoneToken } from "@/lib/phone-auth";

export async function POST(req: NextRequest) {
  try {
    const { deviceToken } = await req.json();
    if (!deviceToken) {
      return NextResponse.json({ error: "Missing device token" }, { status: 400 });
    }

    const device = await db.trustedDevice.findFirst({
      where: { token: deviceToken, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!device) {
      // Expired or revoked — tell the client to fall back to OTP.
      return NextResponse.json(
        { error: "Device no longer trusted", trusted: false },
        { status: 401 }
      );
    }

    await db.trustedDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });

    const businesses = await listOwnerBusinesses(device.userId);
    const phoneToken = await issuePhoneToken(device.userId);

    return NextResponse.json({
      success: true,
      trusted: true,
      user: { id: device.user.id, phone: device.user.phone, name: device.user.name },
      businesses,
      phoneToken,
    });
  } catch (error) {
    console.error("Trusted-device error:", error);
    return NextResponse.json({ error: "Failed to restore device" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { deviceToken } = await req.json();
    if (deviceToken) {
      await db.trustedDevice.deleteMany({ where: { token: deviceToken } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Trusted-device revoke error:", error);
    return NextResponse.json({ error: "Failed to revoke device" }, { status: 500 });
  }
}
