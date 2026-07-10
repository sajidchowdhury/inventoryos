// GET /api/businesses/[id]/permissions
// Returns current user's permissions + role info
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPermissionsForRole, ROLE_DEFINITIONS } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    // Get the requesting user from the session token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    let user = null;
    if (token) {
      const session = await db.session.findUnique({
        where: { token },
        include: { businessUser: true },
      });
      if (session && session.businessUser && session.businessUser.businessId === businessId) {
        user = session.businessUser;
      }
    }

    if (!user) {
      // Fallback: return first admin user for demo purposes
      user = await db.businessUser.findFirst({
        where: { businessId, isActive: true },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "No active user found" }, { status: 404 });
    }

    const effectivePermissions = user.permissions
      ? JSON.parse(user.permissions)
      : getPermissionsForRole(user.role);

    const roleConfig = ROLE_DEFINITIONS[user.role as keyof typeof ROLE_DEFINITIONS];

    return NextResponse.json({
      success: true,
      currentUser: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      },
      permissions: effectivePermissions,
      roleConfig: roleConfig ? {
        label: roleConfig.label,
        description: roleConfig.description,
        color: roleConfig.color,
      } : null,
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}
