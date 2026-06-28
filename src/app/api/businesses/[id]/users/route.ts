// GET/POST /api/businesses/[id]/users
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROLE_DEFINITIONS, getPermissionsForRole } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;

    const users = await db.businessUser.findMany({
      where: { businessId },
      select: {
        id: true, username: true, role: true, fullName: true,
        phone: true, email: true, isActive: true, lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      users,
      roles: Object.values(ROLE_DEFINITIONS),
    });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    if (!body.username?.trim()) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (!body.password || body.password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }
    if (!body.role || !ROLE_DEFINITIONS[body.role as keyof typeof ROLE_DEFINITIONS]) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check for duplicate username
    const existing = await db.businessUser.findFirst({
      where: { businessId, username: body.username.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    // If custom permissions provided, store as JSON; otherwise null (use role defaults)
    const permissions = body.permissions ? JSON.stringify(body.permissions) : null;

    const user = await db.businessUser.create({
      data: {
        businessId,
        username: body.username.trim(),
        passwordHash,
        role: body.role,
        fullName: body.fullName?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        permissions,
        isActive: body.isActive !== false,
      },
      select: {
        id: true, username: true, role: true, fullName: true,
        phone: true, email: true, isActive: true, createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      effectivePermissions: permissions ? JSON.parse(permissions) : getPermissionsForRole(body.role),
    }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
