// POST /api/businesses/[id]/users/[userId]/password
// Change password for a user
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: businessId, userId } = await params;
    const body = await req.json();

    const user = await db.businessUser.findFirst({
      where: { id: userId, businessId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If currentPassword provided, verify it (for self-service password change)
    if (body.currentPassword) {
      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }

    if (!body.newPassword || body.newPassword.length < 4) {
      return NextResponse.json({ error: "New password must be at least 4 characters" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(body.newPassword, 10);

    await db.businessUser.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // If requested, invalidate all other sessions for this user
    if (body.invalidateOtherSessions) {
      await db.session.deleteMany({
        where: { businessUserId: userId },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Password changed successfully" + (body.invalidateOtherSessions ? " — all sessions invalidated" : ""),
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
