// GET + PUT /api/super-admin/ai-providers
// Manage which vision AI provider is active + store their API keys.
//
// GET  → returns all providers with their config (apiKey masked)
// PUT  → update one provider's apiKey/baseUrl, or set which is active
//        body: { provider: "gemini"|"zai", apiKey?: string, baseUrl?: string, isActive?: boolean }
//
// Auth: super-admin Bearer token (same as other /api/super-admin/* routes).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ── GET: list all providers (apiKey masked) ──
export async function GET(req: NextRequest) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure the 2 known providers exist (seed if missing)
    for (const p of ["gemini", "zai"]) {
      await db.aiProvider.upsert({
        where: { provider: p },
        update: {},
        create: { provider: p, isActive: false },
      });
    }

    const providers = await db.aiProvider.findMany({
      orderBy: { provider: "asc" },
    });

    // Mask the API key — show only whether it's set + last 4 chars
    return NextResponse.json({
      success: true,
      providers: providers.map((p) => ({
        provider: p.provider,
        apiKeySet: !!p.apiKey,
        apiKeyMasked: p.apiKey ? `••••••••${p.apiKey.slice(-4)}` : null,
        baseUrl: p.baseUrl,
        isActive: p.isActive,
        updatedAt: p.updatedAt,
        updatedBy: p.updatedBy,
      })),
    });
  } catch (error) {
    console.error("[super-admin/ai-providers] GET failed:", error);
    return NextResponse.json({ error: "Failed to load AI providers" }, { status: 500 });
  }
}

// ── PUT: update a provider ──
export async function PUT(req: NextRequest) {
  try {
    const session = await verifySuperAdmin(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { provider, apiKey, baseUrl, isActive } = body;

    if (!provider || !["gemini", "zai"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be 'gemini' or 'zai'." },
        { status: 400 }
      );
    }

    const updatedBy = session.superAdmin.username;

    // If activating this provider, deactivate all others first
    if (isActive === true) {
      await db.aiProvider.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    // Build the update payload (only set fields that were provided)
    const updateData: Record<string, unknown> = { updatedBy };
    if (apiKey !== undefined) updateData.apiKey = apiKey || null;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const row = await db.aiProvider.upsert({
      where: { provider },
      update: updateData,
      create: {
        provider,
        apiKey: apiKey || null,
        baseUrl: baseUrl || null,
        isActive: isActive ?? false,
        updatedBy,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Provider "${provider}" updated`,
      provider: {
        provider: row.provider,
        apiKeySet: !!row.apiKey,
        baseUrl: row.baseUrl,
        isActive: row.isActive,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      },
    });
  } catch (error) {
    console.error("[super-admin/ai-providers] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update AI provider" }, { status: 500 });
  }
}
