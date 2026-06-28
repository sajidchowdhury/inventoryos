// ── InventoryOS Sentry client config ──
// Auto-loaded by `@sentry/nextjs` in the browser. This file must be safe to
// import on the client — no server-only APIs, no Node built-ins.
//
// Sentry is OPTIONAL: if NEXT_PUBLIC_SENTRY_DSN is unset we skip `Sentry.init`
// entirely, so the bundle ships the SDK but it does nothing (the SDK is tiny
// when unused thanks to tree-shaking).

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const IS_PROD = process.env.NODE_ENV === "production";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Performance sampling.
    //   production: 10% of transactions — enough signal, low cost.
    //   dev:        100% so developers see every trace while debugging.
    tracesSampleRate: IS_PROD ? 0.1 : 1.0,

    // Capture 100% of (rare) replay sessions that end in an error; sample 0%
    // of normal sessions to keep bandwidth/storage low. Bump up if you want
    // to investigate non-error UX flows.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,

    // ── Noise filtering ──
    // Drop errors that are not actionable — they flood Sentry without telling
    // us anything about the health of the app.
    ignoreErrors: [
      // Network blips the browser reports when a fetch is aborted (user
      // navigates away, mobile signal drops, etc.). Not a real bug.
      "Network request failed",
      "Failed to fetch",
      "Load failed",
      "AbortError",
      "ResizeObserver loop completed with undelivered notifications.",
      // Auth flow noise — these are expected for logged-out users hitting
      // protected routes, not bugs.
      "Unauthorized",
      "NEXT_NOT_FOUND",
      "NEXT_REDIRECT",
    ],

    // ── URL deny-list ──
    // Errors thrown from inside browser extensions (Grammarly, password
    // managers, ad-blockers, React DevTools) inject scripts into our page and
    // crash in ways we can't fix. Drop frames from those origins.
    denyUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,
      // Common 3rd-party script SDKs that we don't own
      /googletagmanager\.com/i,
      /google-analytics\.com/i,
      /doubleclick\.net/i,
      /facebook\.net/i,
    ],
  });
}
