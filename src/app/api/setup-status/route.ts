// GET /api/setup-status
// Public diagnostic endpoint — NO AUTH REQUIRED.
// Tells you exactly what's configured so you can debug server setup issues
// without needing to log in.
//
// Usage: curl https://yourdomain.com/api/setup-status
// Or just open it in your browser.
//
// Returns:
//   {
//     server: { nodeVersion, platform, uptime, env },
//     database: { connected, error?, superAdminTableExists, superAdminCount, hasActiveSuperAdmin },
//     aiProviders: { total, active, configured: [...] },
//     steps: [ { step, status, detail } ]
//   }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const steps: Array<{ step: string; status: "ok" | "fail" | "warn"; detail: string }> = [];

  // ── 1. Database connection ──
  let dbConnected = false;
  let dbError: string | null = null;
  try {
    await db.$queryRaw`SELECT 1`;
    dbConnected = true;
    steps.push({ step: "Database connection", status: "ok", detail: "Connected" });
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    steps.push({ step: "Database connection", status: "fail", detail: dbError });
  }

  // ── 2. SuperAdmin table + accounts ──
  let superAdminCount = 0;
  let hasActiveSuperAdmin = false;
  let superAdminTableExists = false;

  if (dbConnected) {
    try {
      const count = await db.superAdmin.count();
      superAdminTableExists = true;
      superAdminCount = count;

      if (count === 0) {
        steps.push({
          step: "SuperAdmin accounts",
          status: "fail",
          detail: "No super-admin accounts exist. Run: bunx tsx scripts/create-super-admin.ts admin YourPassword",
        });
      } else {
        const activeCount = await db.superAdmin.count({ where: { isActive: true } });
        hasActiveSuperAdmin = activeCount > 0;
        if (activeCount > 0) {
          steps.push({
            step: "SuperAdmin accounts",
            status: "ok",
            detail: `${count} account(s), ${activeCount} active. Login should work.`,
          });
        } else {
          steps.push({
            step: "SuperAdmin accounts",
            status: "fail",
            detail: `${count} account(s) exist but none are active. Run: bunx tsx scripts/create-super-admin.ts admin YourPassword`,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("does not exist") || msg.includes("relation")) {
        steps.push({
          step: "SuperAdmin table",
          status: "fail",
          detail: "Table doesn't exist. Run: bun run db:push",
        });
      } else {
        steps.push({
          step: "SuperAdmin table",
          status: "fail",
          detail: msg,
        });
      }
    }
  }

  // ── 3. AI Providers ──
  let aiProviders: Array<{ provider: string; isActive: boolean; hasKey: boolean; model: string | null }> = [];
  if (dbConnected) {
    try {
      // Check if the AiProvider table exists first
      const providers = await db.aiProvider.findMany({
        select: { provider: true, isActive: true, apiKey: true, model: true },
      });
      aiProviders = providers.map((p) => ({
        provider: p.provider,
        isActive: p.isActive,
        hasKey: !!p.apiKey,
        model: p.model,
      }));

      const activeProvider = providers.find((p) => p.isActive && p.apiKey);
      if (activeProvider) {
        steps.push({
          step: "AI Vision Provider",
          status: "ok",
          detail: `Active: ${activeProvider.provider} (model: ${activeProvider.model || "default"})`,
        });
      } else {
        steps.push({
          step: "AI Vision Provider",
          status: "warn",
          detail: "No active provider with API key set. Shelf Scanner won't work until you configure one in Admin → API Setup.",
        });
      }
    } catch {
      steps.push({
        step: "AI Provider table",
        status: "warn",
        detail: "Table doesn't exist or schema out of date. Run: bun run db:push",
      });
    }
  }

  // ── 4. Environment ──
  const envInfo = {
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL || null,
  };

  steps.push({
    step: "Environment",
    status: "ok",
    detail: `${envInfo.environment} on ${envInfo.platform}, Node ${envInfo.nodeVersion}`,
  });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    server: envInfo,
    database: {
      connected: dbConnected,
      error: dbError,
      superAdminTableExists,
      superAdminCount,
      hasActiveSuperAdmin,
    },
    aiProviders,
    steps,
    // Quick summary for humans
    summary: {
      canLogin: dbConnected && hasActiveSuperAdmin,
      canUseShelfScanner: dbConnected && aiProviders.some((p) => p.isActive && p.hasKey),
      nextAction: !dbConnected
        ? "Fix database connection (check DATABASE_URL in .env)"
        : !superAdminTableExists
        ? "Run: bun run db:push"
        : superAdminCount === 0
        ? "Run: bunx tsx scripts/create-super-admin.ts admin YourPassword"
        : !hasActiveSuperAdmin
        ? "Run: bunx tsx scripts/create-super-admin.ts admin YourPassword"
        : aiProviders.some((p) => p.isActive && p.hasKey)
        ? "Everything looks good!"
        : "Log in to /admin and configure an AI provider",
    },
  }, { status: 200 });
}
