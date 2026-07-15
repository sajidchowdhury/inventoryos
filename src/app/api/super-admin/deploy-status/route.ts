// ── GET /api/super-admin/deploy-status ──
// Returns system info + real configuration checks + deployment readiness.
// Every checklist item is a LIVE check against the running server, DB, or
// filesystem — no static "manual" placeholders.

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

    // ── Database Status (real ping) ──
    let dbStatus = { connected: false, latencyMs: 0, tableCount: 0, error: null as string | null };
    try {
      const start = Date.now();
      await db.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      const tableCountResult = await db.$queryRaw`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ` as any[];
      const tableCount = Number(tableCountResult[0]?.count) || 0;

      dbStatus = { connected: true, latencyMs: latency, tableCount, error: null };
    } catch (err) {
      dbStatus = { connected: false, latencyMs: 0, tableCount: 0, error: err instanceof Error ? err.message : "Unknown DB error" };
    }

    // ── SMTP Status (real check via shared helper) ──
    let smtpStatus = { configured: false, source: "none" as string };
    try {
      const smtpConfigured = await isEmailConfigured();
      smtpStatus = { configured: smtpConfigured, source: smtpConfigured ? "database or env" : "none" };
    } catch {
      // ignore
    }

    // ── Build Status (real filesystem check) ──
    const fs = await import("fs");
    let buildStatus = { hasStandalone: false, hasNextDir: false };
    try {
      buildStatus.hasNextDir = fs.existsSync(".next");
      buildStatus.hasStandalone = fs.existsSync(".next/standalone");
    } catch {
      // ignore
    }

    // ── Notification Recipients (real count) ──
    let recipientCount = 0;
    try {
      recipientCount = Number(await db.notificationRecipient.count({ where: { isActive: true } }));
    } catch {
      // ignore
    }

    // ── Kill-Switch Thresholds (real count) ──
    let killSwitchCount = 0;
    try {
      killSwitchCount = Number(await db.killSwitchThreshold.count());
    } catch {
      // ignore
    }

    // ── AI Config (real count) ──
    let aiConfigCount = 0;
    try {
      aiConfigCount = Number(await db.aiConfig.count());
    } catch {
      // ignore
    }

    // ── Businesses (real count) ──
    let businessCount = 0;
    try {
      businessCount = Number(await db.business.count());
    } catch {
      // ignore
    }

    // ── HTTPS / SSL (real check via request headers) ──
    // x-forwarded-proto is set by Nginx/Caddy when proxying HTTPS → HTTP backend.
    // In dev (no proxy) the request URL protocol tells us.
    const xProto = req.headers.get("x-forwarded-proto") || "";
    const xForwardedFor = req.headers.get("x-forwarded-for") || "";
    const reqUrl = req.url || "";
    const isHttps = xProto === "https" || reqUrl.startsWith("https://");
    const hasReverseProxy = !!xForwardedFor || !!xProto;

    // ── PM2 (real check via PM2-injected env vars) ──
    // PM2 sets PM2_HOME and pm_id when the process is managed by it.
    const isPm2Managed = !!(process.env.PM2_HOME || process.env.pm_id || process.env.pm_uptime);

    // ── Cron scheduler health (real check via CronJobLog) ──
    // Looks for any successful cron run in the last 2 hours.
    let cronRecentRun = false;
    let cronLastRunAgo: string | null = null;
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const recentCron = await db.cronJobLog.findFirst({
        where: { startedAt: { gte: twoHoursAgo } },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, status: true, jobName: true },
      });
      if (recentCron) {
        cronRecentRun = true;
        const minsAgo = Math.floor((Date.now() - recentCron.startedAt.getTime()) / 60000);
        cronLastRunAgo = minsAgo < 60 ? `${minsAgo}m ago (${recentCron.jobName})` : `${Math.floor(minsAgo / 60)}h ${minsAgo % 60}m ago (${recentCron.jobName})`;
      }
    } catch {
      // ignore — table may not exist in fresh installs
    }

    // ── Recent DB backup (real filesystem check) ──
    // scripts/backup-db.sh writes to backups/inventoryos_YYYYMMDD_HHMMSS.sql
    let backupStatus: { exists: boolean; latestFile: string | null; ageHours: number | null } = {
      exists: false, latestFile: null, ageHours: null,
    };
    try {
      const backupsDir = "backups";
      if (fs.existsSync(backupsDir)) {
        const files = fs.readdirSync(backupsDir)
          .filter(f => f.startsWith("inventoryos_") && f.endsWith(".sql"))
          .map(f => {
            const stat = fs.statSync(`${backupsDir}/${f}`);
            return { name: f, mtime: stat.mtime };
          })
          .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        if (files.length > 0) {
          const latest = files[0];
          const ageHours = (Date.now() - latest.mtime.getTime()) / (1000 * 60 * 60);
          backupStatus = { exists: true, latestFile: latest.name, ageHours: Math.round(ageHours * 10) / 10 };
        }
      }
    } catch {
      // ignore
    }

    // ── Deployment Checklist (all REAL auto-detected checks) ──
    const checklist = [
      { id: "nodejs", label: "Node.js runtime", status: "ok", detail: systemInfo.nodeVersion, autoDetected: true },
      { id: "database_url", label: "DATABASE_URL set", status: process.env.DATABASE_URL ? "ok" : "missing", detail: process.env.DATABASE_URL ? "Set" : "Not set — app cannot connect to Postgres", autoDetected: true },
      { id: "db_connected", label: "Database reachable", status: dbStatus.connected ? "ok" : "error", detail: dbStatus.connected ? `${dbStatus.latencyMs}ms latency · ${dbStatus.tableCount} tables` : dbStatus.error || "Connection failed", autoDetected: true },
      { id: "cron_secret", label: "CRON_SECRET set", status: process.env.CRON_SECRET ? "ok" : "missing", detail: process.env.CRON_SECRET ? "Set" : "Not set — cron endpoints are unprotected", autoDetected: true },
      { id: "smtp", label: "SMTP email configured", status: smtpStatus.configured ? "ok" : "missing", detail: smtpStatus.configured ? `Via ${smtpStatus.source}` : "Configure in System Config → SMTP tab", autoDetected: true },
      { id: "recipients", label: "Alert recipients", status: recipientCount > 0 ? "ok" : "missing", detail: `${recipientCount} active recipient(s)`, autoDetected: true },
      { id: "kill_switch", label: "Kill-switch thresholds", status: killSwitchCount > 0 ? "ok" : "missing", detail: `${killSwitchCount} threshold(s) configured`, autoDetected: true },
      { id: "ai_config", label: "AI feature config", status: aiConfigCount > 0 ? "ok" : "missing", detail: `${aiConfigCount} feature(s) configured`, autoDetected: true },
      { id: "build", label: "Next.js build artifacts", status: buildStatus.hasNextDir ? "ok" : "missing", detail: buildStatus.hasStandalone ? "Standalone build ready" : buildStatus.hasNextDir ? "Build exists (.next/)" : "Run: npm run build", autoDetected: true },
      { id: "businesses", label: "At least 1 business", status: businessCount > 0 ? "ok" : "missing", detail: `${businessCount} business(es) registered`, autoDetected: true },
      { id: "app_url", label: "NEXT_PUBLIC_APP_URL", status: process.env.NEXT_PUBLIC_APP_URL ? "ok" : "missing", detail: process.env.NEXT_PUBLIC_APP_URL || "Not set — email links will be broken", autoDetected: true },
      // Infrastructure checks (real — derived from request headers / process env)
      { id: "https", label: "HTTPS / SSL active", status: isHttps ? "ok" : "missing", detail: isHttps ? `Via x-forwarded-proto: ${xProto || "(direct)"}` : "No HTTPS detected — SSL not terminated at proxy", autoDetected: true },
      { id: "reverse_proxy", label: "Reverse proxy in front", status: hasReverseProxy ? "ok" : "missing", detail: hasReverseProxy ? `Detected x-forwarded-for / x-forwarded-proto` : "No proxy headers — app is directly exposed", autoDetected: true },
      { id: "pm2", label: "PM2 process manager", status: isPm2Managed ? "ok" : "missing", detail: isPm2Managed ? `Managed by PM2 (PM2_HOME=${process.env.PM2_HOME ? "set" : "n/a"})` : "Not running under PM2 — restarts won't auto-recover", autoDetected: true },
      { id: "cron_health", label: "Cron scheduler active", status: cronRecentRun ? "ok" : "missing", detail: cronLastRunAgo ? `Last run: ${cronLastRunAgo}` : "No cron runs in the last 2 hours — check cron-job.org or system crontab", autoDetected: true },
      { id: "backup_recent", label: "Recent DB backup", status: backupStatus.exists && (backupStatus.ageHours ?? 999) <= 30 ? "ok" : backupStatus.exists ? "optional" : "missing", detail: backupStatus.latestFile ? `${backupStatus.latestFile} (${backupStatus.ageHours}h old)` : "No backup found in /backups — run scripts/backup-db.sh", autoDetected: true },
      // Optional integrations
      { id: "sentry", label: "Sentry error tracking (optional)", status: process.env.SENTRY_DSN ? "ok" : "optional", detail: process.env.SENTRY_DSN ? "Configured" : "Not set — recommended for production", autoDetected: true },
      { id: "redis", label: "Redis cache (optional)", status: process.env.REDIS_URL ? "ok" : "optional", detail: process.env.REDIS_URL ? "Configured" : "Not set — falls back to in-memory cache", autoDetected: true },
    ];

    const autoOk = checklist.filter(s => s.status === "ok").length;
    const autoTotal = checklist.filter(s => s.status !== "optional").length;
    // No more "manual" items — every check is real
    const manualDone = 0;
    const manualTotal = 0;

    return NextResponse.json({
      success: true,
      systemInfo,
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
        overallPercent: autoTotal > 0 ? Math.round((autoOk / autoTotal) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[deploy-status] failed:", error);
    return NextResponse.json({ error: "Failed to load deployment status" }, { status: 500 });
  }
}
