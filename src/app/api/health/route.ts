// ── GET /api/health ──
// Liveness + readiness probe. Used by container orchestrators (k8s, Docker,
// Caddy) and external monitors to decide whether to route traffic to this
// instance.
//
// Response shape:
//   {
//     status: "ok" | "degraded" | "down",
//     timestamp, uptime, uptimeHuman,
//     checks: {
//       database: { status, latencyMs },
//       redis:    { status }
//     },
//     version, environment, sentry
//   }
//
// Status logic:
//   - DB fail      → 503 "down"     (we cannot serve requests without DB)
//   - Redis fail   → 200 "degraded" (cache miss is recoverable)
//   - all ok       → 200 "ok"
//
// Uptime is computed from a module-level start timestamp captured when the
// process first loaded this file.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRedisConnected, isRedisEnabled } from "@/lib/cache";

// ── Module-level start time (captured once when the route first loads) ──
const STARTED_AT = Date.now();

function humanizeUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export async function GET() {
  const now = Date.now();
  const uptimeMs = now - STARTED_AT;

  // ── Database check: SELECT 1 ──
  let dbStatus: "ok" | "fail" = "ok";
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    // $queryRaw returns rows; we just need it to not throw.
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    console.error("[health] database check failed:", err);
    dbStatus = "fail";
  }

  // ── Redis check ──
  // If REDIS_URL is not configured at all, we report "ok" with
  // connected:false (we're using in-memory cache by design — not a fault).
  // If REDIS_URL IS set but the connection is down, we report "fail".
  let redisStatus: "ok" | "fail" | "disabled" = "ok";
  if (!isRedisEnabled()) {
    redisStatus = "disabled";
  } else if (!isRedisConnected()) {
    redisStatus = "fail";
  }

  // ── Aggregate status ──
  let status: "ok" | "degraded" | "down" = "ok";
  let httpStatus = 200;
  if (dbStatus === "fail") {
    status = "down";
    httpStatus = 503;
  } else if (redisStatus === "fail") {
    status = "degraded";
    httpStatus = 200;
  }

  // ── Sentry config ( informational — never blocks the response ) ──
  const sentry = {
    enabled: !!process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || null,
    dsnConfigured: !!process.env.SENTRY_DSN,
  };

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: uptimeMs,
      uptimeHuman: humanizeUptime(uptimeMs),
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        redis: {
          status: redisStatus,
          configured: isRedisEnabled(),
          connected: isRedisConnected(),
        },
      },
      version: process.env.npm_package_version || null,
      environment: process.env.NODE_ENV || null,
      sentry,
    },
    { status: httpStatus }
  );
}
