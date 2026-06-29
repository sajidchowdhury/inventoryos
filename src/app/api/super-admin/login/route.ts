// ── POST /api/super-admin/login ──
// Authenticates a super admin against the SuperAdmin table and issues a
// SuperAdminSession token valid for 7 days.
//
// Request body: { username: string, password: string }
// Response:     { success, token, superAdmin: { id, username, fullName } }
//
// The token must be sent on all subsequent super-admin requests as:
//   Authorization: Bearer <token>

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SESSION_TTL_DAYS = 7;

// ── POST: authenticate ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body ?? {};

    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || !password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    // ── Look up the super admin by username ──
    const superAdmin = await db.superAdmin.findUnique({
      where: { username: username.trim() },
      select: {
        id: true,
        username: true,
        fullName: true,
        passwordHash: true,
        isActive: true,
      },
    });

    // Use a constant-time-ish compare failure: even when the user doesn't
    // exist we still run a bcrypt.compare against a dummy hash to reduce
    // timing-based user enumeration.
    const DUMMY_HASH = "$2a$12$000000000000000000000000000000000000000000000000000000";
    const hashToCheck = superAdmin?.passwordHash ?? DUMMY_HASH;
    const passwordOk = await bcrypt.compare(password, hashToCheck);

    if (!superAdmin || !superAdmin.isActive || !passwordOk) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // ── Create a session ──
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db.superAdminSession.create({
      data: {
        superAdminId: superAdmin.id,
        token,
        expiresAt,
        createdAt: now,
      },
    });

    // ── Update lastLoginAt (best-effort, never fails the login) ──
    try {
      await db.superAdmin.update({
        where: { id: superAdmin.id },
        data: { lastLoginAt: now },
      });
    } catch (err) {
      console.error("[super-admin/login] lastLoginAt update failed:", err);
    }

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      superAdmin: {
        id: superAdmin.id,
        username: superAdmin.username,
        fullName: superAdmin.fullName,
      },
    });
  } catch (error) {
    console.error("[super-admin/login] failed:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}
