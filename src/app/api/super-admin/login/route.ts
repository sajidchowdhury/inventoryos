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
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

const SESSION_TTL_DAYS = 7;

// ── POST: authenticate ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body ?? {};

    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    const normalizedPassword = typeof password === "string" ? password : "";

    if (!normalizedUsername) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }
    if (!normalizedPassword) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    // ── Look up the super admin by username ──
    // SQLite is case-insensitive by default for equals() on text, so we drop
    // mode:"insensitive" here (which is PostgreSQL-only and crashes SQLite).
    // On PostgreSQL the SuperAdmin.username unique constraint makes case-sensitivity
    // acceptable for login — the seeded username is "superadmin" (all lowercase).
    const superAdmin = await db.superAdmin.findFirst({
      where: {
        username: { equals: normalizedUsername },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        passwordHash: true,
        isActive: true,
      },
    });

    let passwordOk = false;
    if (superAdmin?.passwordHash) {
      try {
        passwordOk = await verifyPassword(normalizedPassword, superAdmin.passwordHash);
      } catch (err) {
        console.error("[super-admin/login] password verify failed:", err);
      }
    }

    if (!superAdmin || !superAdmin.isActive || !passwordOk) {
      let hint: string | undefined;
      try {
        const count = await db.superAdmin.count();
        if (count === 0) {
          hint =
            "No super-admin account exists. Run: npx tsx scripts/create-super-admin.ts admin YourPassword";
        }
      } catch {
        // ignore — fall back to generic error
      }

      return NextResponse.json(
        {
          success: false,
          error: "Invalid username or password",
          hint,
        },
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
