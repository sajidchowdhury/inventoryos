// ── InventoryOS Sentry server config ──
// Auto-loaded by `@sentry/nextjs` on the Node.js runtime (API routes, server
// components, middleware, `getServerSideProps`). Safe to import on the server
// only — never reference `window`, `document`, etc.
//
// Sentry is OPTIONAL: if SENTRY_DSN is unset we skip `Sentry.init` so the
// server bundle ships the SDK but it stays inert.

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // 10% of server transactions. The InventoryOS server spends most of its
    // time in DB queries (which we already instrument separately) — 10% gives
    // us P95 latency histograms without flooding Sentry with redundant spans.
    tracesSampleRate: 0.1,

    // ── Noise filtering ──
    // Server-side errors that are expected operational conditions, not bugs.
    ignoreErrors: [
      // Prisma: "Unique constraint failed" on registration / login race —
      // handled by our retry logic, not a bug.
      "P2002",
      // Prisma: record not found — usually a stale client request, handled
      // by the API returning 404.
      "P2025",
      // Prisma: transaction timeout / write conflict — retried by the caller.
      "P2028",
      "P2034",
      // Auth: bad OTP / wrong password — expected for typo'd logins.
      "invalid credentials",
      "Invalid OTP",
      "OTP expired",
      // Rate limiting — these are user-facing 429s, not server faults.
      "Too many requests",
      "RATE_LIMIT_EXCEEDED",
      // Next.js internal control-flow signals, never real errors.
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],

    initialScope: {
      // Tags are indexed in Sentry — use them to slice issues by deployment.
      tags: {
        app: "inventoryos",
        runtime: "node",
        // SERVICE is set per-process if you ever split workers out of the web
        // container (e.g. a separate cron container); defaults to "web".
        service: process.env.SERVICE || "web",
      },
    },
  });
}
