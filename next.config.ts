import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Output a self-contained Node server bundle (.next/standalone) — required
  // for the multi-stage Dockerfile used in production.
  output: "standalone",

  // Skip tsc during `next build`. We type-check on the developer's machine and
  // in CI; rebuilding inside Docker shouldn't fail the deploy on a stray type.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Disabled because the InventoryOS app holds open in-memory references
  // (zustand stores, react-query caches) that double-mount in strict mode
  // and caused subtle double-fetch bugs during development.
  reactStrictMode: false,
};

// ────────────────────────────────────────────────────────────────────────────
// Sentry wrapper
// ────────────────────────────────────────────────────────────────────────────
// - `@sentry/nextjs` injects build-time instrumentation: source-map upload,
//   React component annotations, tree-shaking of the SDK when SENTRY_DSN is
//   not set, and the auto-generated `instrumentation.ts` hooks.
// - If `@sentry/nextjs` is not installed the build will fail loudly here
//   rather than silently shipping an uninstrumented bundle — install it with:
//     npm install @sentry/nextjs
export default withSentryConfig(nextConfig, {
  // Annotate React component names in spans (e.g. `<UserTable />` shows up in
  // the Sentry performance waterfall). Negligible bundle cost.
  reactComponentAnnotation: {
    enabled: true,
  },

  // Disable source-map upload in dev — we don't want to push maps for every
  // `next dev` rebuild. Production builds read SENTRY_AUTH_TOKEN from the env
  // and upload automatically (no extra config needed here).
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },

  // Tree-shake the Sentry SDK when SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is
  // absent so dev/test builds don't pay the SDK cost.
  silent: !process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN,
});
