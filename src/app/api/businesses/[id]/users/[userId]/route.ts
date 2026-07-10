// GET/PUT/DELETE /api/businesses/[id]/users/[userId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROLE_DEFINITIONS, getPermissionsForRole } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: businessId, userId } = await params;

    const user = await db.businessUser.findFirst({
      where: { id: userId, businessId },
      select: {
        id: true, username: true, role: true, fullName: true,
        phone: true, email: true, isActive: true, permissions: true,
        lastLoginAt: true, createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const effectivePermissions = user.permissions
      ? JSON.parse(user.permissions)
      : getPermissionsForRole(user.role);

    return NextResponse.json({
      success: true,
      user: { ...user, permissions: undefined }, // don't return raw JSON
      effectivePermissions,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: businessId, userId } = await params;
    const body = await req.json();

    const existing = await db.businessUser.findFirst({
      where: { id: userId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate role if changing
    if (body.role && !ROLE_DEFINITIONS[body.role as keyof typeof ROLE_DEFINITIONS]) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Hash new password if provided
    let passwordHash: string | undefined;
    if (body.password) {
      if (body.password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(body.password, 10);
    }

    // Handle permissions
    let permissions: string | null | undefined;
    if (body.permissions !== undefined) {
      permissions = body.permissions ? JSON.stringify(body.permissions) : null;
    }

    const user = await db.businessUser.update({
      where: { id: userId },
      data: {
        username: body.username !== undefined ? body.username.trim() : existing.username,
        role: body.role || existing.role,
        fullName: body.fullName !== undefined ? (body.fullName?.trim() || null) : existing.fullName,
        phone: body.phone !== undefined ? (body.phone?.trim() || null) : existing.phone,
        email: body.email !== undefined ? (body.email?.trim() || null) : existing.email,
        isActive: body.isActive !== undefined ? !!body.isActive : existing.isActive,
        passwordHash: passwordHash || existing.passwordHash,
        permissions: permissions !== undefined ? permissions : existing.permissions,
      },
      select: {
        id: true, username: true, role: true, fullName: true,
        phone: true, email: true, isActive: true, createdAt: true,
      },
    });

    const effectivePermissions = permissions !== undefined
      ? (permissions ? JSON.parse(permissions) : getPermissionsForRole(user.role))
      : (existing.permissions ? JSON.parse(existing.permissions) : getPermissionsForRole(user.role));

    return NextResponse.json({
      success: true,
      user,
      effectivePermissions,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: businessId, userId } = await params;

    const existing = await db.businessUser.findFirst({
      where: { id: userId, businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting the last admin/owner
    if (existing.role === "owner" || existing.role === "admin") {
      const adminCount = await db.businessUser.count({
        where: { businessId, role: { in: ["owner", "admin"] }, isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last admin/owner. Assign another admin first." },
          { status: 400 }
        );
      }
    }

    // Soft delete — deactivate instead of hard delete
    await db.businessUser.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Invalidate all sessions for this user
    await db.session.deleteMany({
      where: { businessUserId: userId },
    });

    return NextResponse.json({
      success: true,
      message: `User "${existing.username}" deactivated. All sessions invalidated.`,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
