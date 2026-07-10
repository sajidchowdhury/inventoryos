// POST /api/auth/login
// "I'm a staff member" door: log in with a shop key + per-business username +
// password. The shop key may be a `businessId` (internal), a `shopCode`
// (e.g. "PHA-XK7T"), or the business's own `businessPhone` (when unambiguous).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generateSessionToken } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/rbac";

// ── Lenient in-memory throttle (best-effort brute-force slowdown) ──
// Per (shopKey|username): allow a burst, then cool down. Resets on success.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearAttempts(key: string): void {
  attempts.delete(key);
}

/** Resolve a shop key (shopCode / businessPhone) to a single businessId. */
async function resolveBusinessId(input: {
  businessId?: string;
  shopCode?: string;
  businessPhone?: string;
}): Promise<{ businessId?: string; error?: string; status?: number }> {
  if (input.businessId) return { businessId: input.businessId };

  if (input.shopCode) {
    const code = input.shopCode.trim().toUpperCase();
    const biz = await db.business.findFirst({
      where: { shopCode: code, isActive: true },
      select: { id: true },
    });
    if (!biz) return { error: "No shop found with that code", status: 404 };
    return { businessId: biz.id };
  }

  if (input.businessPhone) {
    const phone = input.businessPhone.replace(/[\s\-()]/g, "");
    const matches = await db.business.findMany({
      where: { phone, isActive: true },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 0) return { error: "No shop found with that phone number", status: 404 };
    if (matches.length > 1)
      return {
        error: "Multiple shops use this phone number. Please enter your shop code instead.",
        status: 409,
      };
    return { businessId: matches[0].id };
  }

  return { error: "A shop code (or the shop's phone number) is required", status: 400 };
}

export async function POST(req: NextRequest) {
  try {
    const { businessId, shopCode, businessPhone, username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Resolve the shop key → businessId.
    const resolved = await resolveBusinessId({ businessId, shopCode, businessPhone });
    if (resolved.error || !resolved.businessId) {
      return NextResponse.json(
        { error: resolved.error || "Shop not found" },
        { status: resolved.status || 400 }
      );
    }
    const resolvedBusinessId = resolved.businessId;

    // Throttle repeated attempts for this shop+username.
    const throttleKey = `${resolvedBusinessId}:${username.toLowerCase()}`;
    if (tooManyAttempts(throttleKey)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    // Find the business user
    const businessUser = await db.businessUser.findUnique({
      where: {
        businessId_username: { businessId: resolvedBusinessId, username },
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

    // Success — clear the throttle for this shop+username.
    clearAttempts(throttleKey);

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
        shopCode: businessUser.business.shopCode,
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
