// ── PUT /api/super-admin/businesses/[businessId] ──
// Updates subscription + AI control fields on a business.
//
// Auth: callers must authenticate via `Authorization: Bearer <superAdminToken>`.
//
// Updatable fields (all optional, only fields present in the body are written):
//   subscriptionTier, subscriptionStatus, aiEnabled,
//   aiDailyLimit, aiMonthlyLimit, aiTokenBudget,
//   subscriptionStart, subscriptionEnd

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_TIERS = new Set(["free", "pro", "pro_ai"]);
const VALID_STATUSES = new Set(["trial", "active", "suspended", "cancelled"]);

/**
 * Verify the Bearer token belongs to an active, non-expired super-admin session.
 */
async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true,
        superAdminId: true,
        expiresAt: true,
        superAdmin: { select: { id: true, isActive: true } },
      },
    });

    if (
      !session ||
      !session.superAdmin.isActive ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch (err) {
    console.error("[super-admin/businesses/[id]] session lookup failed:", err);
    return null;
  }
}

/** Parse a date string or null; returns null if input is null/empty/invalid. */
function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse a non-negative integer; returns undefined if input is undefined. */
function parseNonNegInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (typeof n !== "number" || !isFinite(n) || n < 0) {
    throw new Error(`Invalid non-negative integer: ${String(value)}`);
  }
  return Math.floor(n);
}

// ── PUT: update business ──
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId } = await params;
    const body = await req.json().catch(() => ({}));

    // ── Validate enum fields up-front so we never write a bad value ──
    if (
      body.subscriptionTier !== undefined &&
      body.subscriptionTier !== null &&
      !VALID_TIERS.has(body.subscriptionTier)
    ) {
      return NextResponse.json(
        {
          error: `Invalid subscriptionTier "${body.subscriptionTier}"`,
          valid: [...VALID_TIERS],
        },
        { status: 400 }
      );
    }
    if (
      body.subscriptionStatus !== undefined &&
      body.subscriptionStatus !== null &&
      !VALID_STATUSES.has(body.subscriptionStatus)
    ) {
      return NextResponse.json(
        {
          error: `Invalid subscriptionStatus "${body.subscriptionStatus}"`,
          valid: [...VALID_STATUSES],
        },
        { status: 400 }
      );
    }

    // ── Build the update payload (only fields that are present) ──
    const data: Record<string, unknown> = {};

    if (body.subscriptionTier !== undefined) {
      data.subscriptionTier = body.subscriptionTier;
    }
    if (body.subscriptionStatus !== undefined) {
      data.subscriptionStatus = body.subscriptionStatus;
    }
    if (body.aiEnabled !== undefined) {
      data.aiEnabled = !!body.aiEnabled;
    }

    try {
      if (body.aiDailyLimit !== undefined) {
        data.aiDailyLimit = parseNonNegInt(body.aiDailyLimit);
      }
      if (body.aiMonthlyLimit !== undefined) {
        data.aiMonthlyLimit = parseNonNegInt(body.aiMonthlyLimit);
      }
      if (body.aiTokenBudget !== undefined) {
        data.aiTokenBudget = parseNonNegInt(body.aiTokenBudget);
      }
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Invalid numeric field",
        },
        { status: 400 }
      );
    }

    if (body.subscriptionStart !== undefined) {
      const d = parseOptionalDate(body.subscriptionStart);
      if (d === null && body.subscriptionStart !== null && body.subscriptionStart !== "") {
        return NextResponse.json(
          { error: "subscriptionStart is not a valid date" },
          { status: 400 }
        );
      }
      data.subscriptionStart = d;
    }
    if (body.subscriptionEnd !== undefined) {
      const d = parseOptionalDate(body.subscriptionEnd);
      if (d === null && body.subscriptionEnd !== null && body.subscriptionEnd !== "") {
        return NextResponse.json(
          { error: "subscriptionEnd is not a valid date" },
          { status: 400 }
        );
      }
      data.subscriptionEnd = d;
    }

    // ── Apply ──
    const updated = await db.business.update({
      where: { id: businessId },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        isActive: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        aiEnabled: true,
        aiDailyLimit: true,
        aiMonthlyLimit: true,
        aiTokenBudget: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      business: updated,
      updatedBy: {
        superAdminId: session.superAdminId,
      },
    });
  } catch (error) {
    console.error("[super-admin/businesses/[id]] PUT failed:", error);
    // Prisma's P2025 = record not found
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update business" },
      { status: 500 }
    );
  }
}
