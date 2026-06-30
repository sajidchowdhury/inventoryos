// ── GET /api/super-admin/deploy-status ──
// Returns system info + environment variable checks + deployment readiness.
// Auto-detects what's configured vs missing so the founder can see exactly
// what needs to be done before going live on Hostinger.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: { superAdminId: true, expiresAt: true, superAdmin: { select: { id: true, isActive: true, username: true } } },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // ── System Info ──
    const systemInfo = {
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
      uptime: Math.floor(process.uptime()),
      memoryUsage: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10, // MB
      environment: process.env.NODE_ENV || "development",
      pid: process.pid,
    };

    // ── Environment Variable Checks ──
    const envVars = [
      { name: "DATABASE_URL", value: process.env.DATABASE_URL ? "✓ Set" : "✗ Missing", configured: !!process.env.DATABASE_URL, required: true, description: "Database connection string (PostgreSQL or SQLite)" },
      { name: "DIRECT_DATABASE_URL", value: process.env.DIRECT_DATABASE_URL ? "✓ Set" : "✗ Missing (optional for dev)", configured: !!process.env.DIRECT_DATABASE_URL, required: false, description: "Direct DB URL for Prisma migrations (bypasses PgBouncer)" },
      { name: "CRON_SECRET", value: process.env.CRON_SECRET ? "✓ Set" : "✗ Missing", configured: !!process.env.CRON_SECRET, required: true, description: "Secret for cron job endpoints (x-cron-secret header)" },
      { name: "SMTP_HOST", value: process.env.SMTP_HOST ? "✓ Set (or use DB config)" : "✗ Not set (use DB config in SMTP tab)", configured: !!process.env.SMTP_HOST, required: false, description: "SMTP server hostname (or configure via /admin/api-setup → SMTP tab)" },
      { name: "SMTP_PORT", value: process.env.SMTP_PORT || "✗ Not set", configured: !!process.env.SMTP_PORT, required: false, description: "SMTP port (587 or 465)" },
      { name: "SMTP_USER", value: process.env.SMTP_USER ? "✓ Set" : "✗ Not set", configured: !!process.env.SMTP_USER, required: false, description: "SMTP username" },
      { name: "SMTP_PASS", value: process.env.SMTP_PASS ? "✓ Set" : "✗ Not set", configured: !!process.env.SMTP_PASS, required: false, description: "SMTP password or app password" },
      { name: "SMTP_FROM", value: process.env.SMTP_FROM || "✗ Not set (optional)", configured: !!process.env.SMTP_FROM, required: false, description: "From: email address (optional, defaults to SMTP_USER)" },
      { name: "SENTRY_DSN", value: process.env.SENTRY_DSN ? "✓ Set" : "✗ Not set (optional)", configured: !!process.env.SENTRY_DSN, required: false, description: "Sentry error tracking DSN (optional but recommended for production)" },
      { name: "NEXT_PUBLIC_SENTRY_DSN", value: process.env.NEXT_PUBLIC_SENTRY_DSN ? "✓ Set" : "✗ Not set (optional)", configured: !!process.env.NEXT_PUBLIC_SENTRY_DSN, required: false, description: "Sentry DSN for client-side error tracking" },
      { name: "NEXT_PUBLIC_APP_URL", value: process.env.NEXT_PUBLIC_APP_URL || "✗ Not set", configured: !!process.env.NEXT_PUBLIC_APP_URL, required: false, description: "Public app URL (e.g., https://inventoryos.com) — used in email links" },
      { name: "REDIS_URL", value: process.env.REDIS_URL ? "✓ Set" : "✗ Not set (optional for dev)", configured: !!process.env.REDIS_URL, required: false, description: "Redis connection URL (optional, falls back to in-memory cache)" },
      { name: "TEST_ERROR_ENABLED", value: process.env.TEST_ERROR_ENABLED || "✗ Not set (should be false in prod)", configured: !!process.env.TEST_ERROR_ENABLED, required: false, description: "Enable /api/health/test-error endpoint (set to 'false' in production)" },
      { name: "FOUNDER_EMAIL", value: process.env.FOUNDER_EMAIL ? "✓ Set" : "✗ Not set (optional)", configured: !!process.env.FOUNDER_EMAIL, required: false, description: "Founder email for kill-switch alerts (or use Notification Recipients)" },
    ];

    // ── Database Status ──
    let dbStatus = { connected: false, latencyMs: 0, tableCount: 0, error: null as string | null };
    try {
      const start = Date.now();
      await db.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      // Count tables
      const tableCountResult = await db.$queryRaw`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'` as any[];
      const tableCount = Number(tableCountResult[0]?.count) || 0;

      dbStatus = { connected: true, latencyMs: latency, tableCount, error: null };
    } catch (err) {
      dbStatus = { connected: false, latencyMs: 0, tableCount: 0, error: err instanceof Error ? err.message : "Unknown DB error" };
    }

    // ── SMTP Status (from DB) ──
    let smtpStatus = { configured: false, source: "none" as string };
    try {
      const smtpConfigured = await isEmailConfigured();
      smtpStatus = { configured: smtpConfigured, source: smtpConfigured ? "database or env" : "none" };
    } catch {
      // ignore
    }

    // ── Build Status ──
    const fs = require("fs");
    let buildStatus = { hasStandalone: false, hasNextDir: false };
    try {
      buildStatus.hasNextDir = fs.existsSync(".next");
      buildStatus.hasStandalone = fs.existsSync(".next/standalone");
    } catch {
      // ignore
    }

    // ── Notification Recipients ──
    let recipientCount = 0;
    try {
      recipientCount = Number(await db.notificationRecipient.count({ where: { isActive: true } }));
    } catch {
      // ignore
    }

    // ── Kill-Switch Thresholds ──
    let killSwitchCount = 0;
    try {
      killSwitchCount = Number(await db.killSwitchThreshold.count());
    } catch {
      // ignore
    }

    // ── AI Config ──
    let aiConfigCount = 0;
    try {
      aiConfigCount = Number(await db.aiConfig.count());
    } catch {
      // ignore
    }

    // ── Businesses ──
    let businessCount = 0;
    try {
      businessCount = Number(await db.business.count());
    } catch {
      // ignore
    }

    // ── Deployment Checklist (auto-detected) ──
    const checklist = [
      { id: "nodejs", label: "Node.js installed", status: "ok", detail: systemInfo.nodeVersion, autoDetected: true },
      { id: "database_url", label: "DATABASE_URL set", status: process.env.DATABASE_URL ? "ok" : "missing", detail: envVars.find(v => v.name === "DATABASE_URL")?.value, autoDetected: true },
      { id: "db_connected", label: "Database connected", status: dbStatus.connected ? "ok" : "error", detail: dbStatus.connected ? `${dbStatus.latencyMs}ms, ${dbStatus.tableCount} tables` : dbStatus.error || "Failed", autoDetected: true },
      { id: "cron_secret", label: "CRON_SECRET set", status: process.env.CRON_SECRET ? "ok" : "missing", detail: process.env.CRON_SECRET ? "Set" : "Not set — cron jobs won't work", autoDetected: true },
      { id: "smtp", label: "SMTP configured", status: smtpStatus.configured ? "ok" : "missing", detail: smtpStatus.configured ? `Via ${smtpStatus.source}` : "Configure in API Setup → SMTP tab", autoDetected: true },
      { id: "recipients", label: "Alert recipients added", status: recipientCount > 0 ? "ok" : "missing", detail: `${recipientCount} recipient(s)`, autoDetected: true },
      { id: "kill_switch", label: "Kill-switch thresholds set", status: killSwitchCount > 0 ? "ok" : "missing", detail: `${killSwitchCount} thresholds`, autoDetected: true },
      { id: "ai_config", label: "AI config tuned", status: aiConfigCount > 0 ? "ok" : "missing", detail: `${aiConfigCount} features configured`, autoDetected: true },
      { id: "build", label: "Next.js build completed", status: buildStatus.hasNextDir ? "ok" : "missing", detail: buildStatus.hasStandalone ? "Standalone build ready" : buildStatus.hasNextDir ? "Build exists" : "Run: npm run build", autoDetected: true },
      { id: "businesses", label: "At least 1 business created", status: businessCount > 0 ? "ok" : "missing", detail: `${businessCount} businesses`, autoDetected: true },
      { id: "sentry", label: "Sentry error tracking (optional)", status: process.env.SENTRY_DSN ? "ok" : "optional", detail: process.env.SENTRY_DSN ? "Configured" : "Not set — recommended for production", autoDetected: true },
      { id: "redis", label: "Redis cache (optional)", status: process.env.REDIS_URL ? "ok" : "optional", detail: process.env.REDIS_URL ? "Configured" : "Not set — falls back to in-memory", autoDetected: true },
      { id: "app_url", label: "NEXT_PUBLIC_APP_URL set", status: process.env.NEXT_PUBLIC_APP_URL ? "ok" : "missing", detail: process.env.NEXT_PUBLIC_APP_URL || "Not set — email links won't work", autoDetected: true },
      // Manual steps (can't auto-detect)
      { id: "domain", label: "Domain DNS pointing to server", status: "manual", detail: "Point your domain A record to your Hostinger VPS IP", autoDetected: false },
      { id: "ssl", label: "SSL certificate installed", status: "manual", detail: "Use Let's Encrypt (free) via Caddy or Certbot", autoDetected: false },
      { id: "pm2", label: "PM2 process manager running", status: "manual", detail: "Install: npm install -g pm2, then: pm2 start npm --name inventoryos -- start", autoDetected: false },
      { id: "reverse_proxy", label: "Reverse proxy configured (Caddy/Nginx)", status: "manual", detail: "Configure Caddy or Nginx to proxy :3000 to :80/:443", autoDetected: false },
      { id: "firewall", label: "Firewall configured (ports 80, 443)", status: "manual", detail: "ufw allow 80,443/tcp — block 3000 from public access", autoDetected: false },
      { id: "backup_cron", label: "Database backup cron configured", status: "manual", detail: "Run scripts/backup/backup.sh daily via crontab", autoDetected: false },
      { id: "cron_scheduler", label: "External cron scheduler configured", status: "manual", detail: "Set up cron-job.org or Vercel Cron to trigger /api/cron/* endpoints", autoDetected: false },
    ];

    const autoOk = checklist.filter(s => s.autoDetected && s.status === "ok").length;
    const autoTotal = checklist.filter(s => s.autoDetected && s.status !== "optional").length;
    const manualDone = checklist.filter(s => !s.autoDetected && s.status === "done").length;
    const manualTotal = checklist.filter(s => !s.autoDetected).length;

    return NextResponse.json({
      success: true,
      systemInfo,
      envVars,
      dbStatus,
      smtpStatus,
      buildStatus,
      recipientCount,
      killSwitchCount,
      aiConfigCount,
      businessCount,
      checklist,
      summary: {
        autoOk,
        autoTotal,
        manualDone,
        manualTotal,
        overallPercent: Math.round(((autoOk + manualDone) / (autoTotal + manualTotal)) * 100),
      },
    });
  } catch (error) {
    console.error("[deploy-status] failed:", error);
    return NextResponse.json({ error: "Failed to load deployment status" }, { status: 500 });
  }
}
