// POST /api/auth/login
// Login with per-business username + password
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generateSessionToken } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const { businessId, username, password } = await req.json();

    if (!businessId || !username || !password) {
      return NextResponse.json(
        { error: "Business, username, and password are required" },
        { status: 400 }
      );
    }

    // Find the business user
    const businessUser = await db.businessUser.findUnique({
      where: {
        businessId_username: { businessId, username },
        isActive: true,
      },
      include: {
        business: {
          include: {
            businessType: {
              select: { slug: true, name: true, color: true, icon: true },
            },
          },
        },
      },
    });

    if (!businessUser) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, businessUser.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Create session
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.session.create({
      data: {
        businessUserId: businessUser.id,
        token,
        deviceInfo: req.headers.get("user-agent") || "Unknown",
        expiresAt,
      },
    });

    // Update lastLoginAt
    await db.businessUser.update({
      where: { id: businessUser.id },
      data: { lastLoginAt: new Date() },
    });

    // Get effective permissions
    const permissions = businessUser.permissions
      ? JSON.parse(businessUser.permissions)
      : getPermissionsForRole(businessUser.role);

    return NextResponse.json({
      success: true,
      session: {
        token,
        expiresAt: expiresAt.toISOString(),
      },
      user: {
        id: businessUser.id,
        username: businessUser.username,
        role: businessUser.role,
        fullName: businessUser.fullName,
      },
      permissions,
      business: {
        id: businessUser.business.id,
        name: businessUser.business.name,
        address: businessUser.business.address,
        businessType: businessUser.business.businessType,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
