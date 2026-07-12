// POST /api/auth/validate-session
// Validates a stored session token and returns fresh session data.
// Used on page refresh to verify the persisted session is still valid.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPermissionsForRole } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 400 }
      );
    }

    // Find the session and check expiry
    const session = await db.session.findUnique({
      where: { token },
      include: {
        businessUser: {
          include: {
            business: {
              include: {
                businessType: {
                  select: { slug: true, name: true, color: true, icon: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 401 }
      );
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.session.delete({ where: { id: session.id } });
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
    }

    if (!session.businessUser.isActive) {
      return NextResponse.json(
        { error: "Account deactivated" },
        { status: 403 }
      );
    }

    if (!session.businessUser.business.isActive) {
      return NextResponse.json(
        { error: "Business deactivated" },
        { status: 403 }
      );
    }

    // Get effective permissions
    const bu = session.businessUser;
    const permissions = bu.permissions
      ? JSON.parse(bu.permissions)
      : getPermissionsForRole(bu.role);

    return NextResponse.json({
      success: true,
      session: {
        token: session.token,
        expiresAt: session.expiresAt.toISOString(),
      },
      user: {
        id: bu.id,
        username: bu.username,
        role: bu.role,
        fullName: bu.fullName,
      },
      permissions,
      business: {
        id: bu.business.id,
        name: bu.business.name,
        address: bu.business.address,
        shopCode: bu.business.shopCode,
        businessType: bu.business.businessType,
      },
    });
  } catch (error) {
    console.error("Validate session error:", error);
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}