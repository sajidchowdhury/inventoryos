// ── GET / PUT /api/super-admin/ai-config ──
// Read and update configurable AI cost-control knobs (Phase 1).
//
// Auth: callers must authenticate via `Authorization: Bearer <superAdminToken>`.
//
// GET  → returns all 5 feature configs (with defaults for any missing rows)
// PUT  → updates one feature's config; body: { feature, maxOutputTokens?, maxInputBatches?, maxInputProducts?, maxInputImages? }
//        also supports { reset: true } to reset ALL features to hardcoded defaults

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  AI_CONFIG_DEFAULTS,
  getAllAiConfigs,
  updateAiConfig,
  seedDefaultAiConfigs,
  type AiFeatureName,
} from "@/lib/ai-config";

/**
 * Verify the Bearer token belongs to an active, non-expired super-admin session.
 * Returns the session row (with superAdmin relation for username) on success.
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
        superAdmin: { select: { id: true, isActive: true, username: true } },
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
    console.error("[super-admin/ai-config] session lookup failed:", err);
    return null;
  }
}

const VALID_FEATURES: AiFeatureName[] = [
  "chat",
  "insights",
  "expiry-optimizer",
  "product-assistant",
  "shelf-scanner",
];

// ── GET: return all AI configs ──
export async function GET(req: NextRequest) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configs = await getAllAiConfigs();
    return NextResponse.json({
      success: true,
      configs,
      defaults: AI_CONFIG_DEFAULTS,
    });
  } catch (error) {
    console.error("[super-admin/ai-config] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load AI configuration" },
      { status: 500 }
    );
  }
}

// ── PUT: update one feature's config, or reset all to defaults ──
export async function PUT(req: NextRequest) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updatedBy = session.superAdmin.username;

    // ── Reset-all-to-defaults mode ──
    if (body?.reset === true) {
      await db.aiConfig.deleteMany({});
      await seedDefaultAiConfigs(updatedBy);
      const configs = await getAllAiConfigs();
      return NextResponse.json({
        success: true,
        message: "All AI configurations reset to defaults",
        configs,
      });
    }

    // ── Update-one-feature mode ──
    const { feature, maxOutputTokens, maxInputBatches, maxInputProducts, maxInputImages } = body;

    if (!feature || !VALID_FEATURES.includes(feature)) {
      return NextResponse.json(
        {
          error: `Invalid feature. Must be one of: ${VALID_FEATURES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updates: {
      maxOutputTokens?: number;
      maxInputBatches?: number | null;
      maxInputProducts?: number | null;
      maxInputImages?: number | null;
    } = {};

    if (maxOutputTokens !== undefined) {
      updates.maxOutputTokens = maxOutputTokens;
    }
    if (maxInputBatches !== undefined) {
      updates.maxInputBatches = maxInputBatches;
    }
    if (maxInputProducts !== undefined) {
      updates.maxInputProducts = maxInputProducts;
    }
    if (maxInputImages !== undefined) {
      updates.maxInputImages = maxInputImages;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No update fields provided. Send maxOutputTokens, maxInputBatches, maxInputProducts, or maxInputImages." },
        { status: 400 }
      );
    }

    const updated = await updateAiConfig(feature as AiFeatureName, updates, updatedBy);
    return NextResponse.json({
      success: true,
      message: `Configuration for "${feature}" updated`,
      config: updated,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[super-admin/ai-config] PUT failed:", error);

    if (
      msg.includes("must be") ||
      msg.includes("Invalid feature") ||
      msg.includes("No update fields")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update AI configuration" },
      { status: 500 }
    );
  }
}
