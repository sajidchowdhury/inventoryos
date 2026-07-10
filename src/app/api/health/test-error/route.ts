// ── POST /api/health/test-error ──
// Test harness for Sentry error capture. Only callable when explicitly
// enabled via the TEST_ERROR_ENABLED env var (defaults to off in production).
//
// Request body (all optional):
//   { type: "generic" | "timeout" | "database" | "captureMessage" }
//
//   - "generic"        (default): throws a generic Error after setting Sentry tags
//   - "timeout"        : throws an Error tagged as a timeout scenario
//   - "database"       : throws an Error tagged as a database scenario
//   - "captureMessage" : calls Sentry.captureMessage and returns 200 (no throw)
//
// All non-captureMessage branches throw, so Sentry's Next.js SDK will capture
// the exception. The response is whatever Sentry/Next returns (usually 500).

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

const VALID_TYPES = new Set(["generic", "timeout", "database", "captureMessage"]);

export async function POST(req: NextRequest) {
  try {
    // ── Gate: this endpoint must be explicitly enabled ──
    if (process.env.TEST_ERROR_ENABLED !== "true") {
      return NextResponse.json(
        {
          error: "Test-error endpoint is disabled.",
          hint: "Set TEST_ERROR_ENABLED=true to enable.",
        },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "generic";

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        {
          error: `Invalid type "${type}"`,
          validTypes: [...VALID_TYPES],
        },
        { status: 400 }
      );
    }

    // ── Set Sentry tags so the captured event is easy to find in the dashboard ──
    Sentry.setTag("test_error.endpoint", "/api/health/test-error");
    Sentry.setTag("test_error.type", type);
    Sentry.setTag("test_error.triggered_at", new Date().toISOString());

    if (type === "captureMessage") {
      // captureMessage does NOT throw — we just record it and return 200.
      Sentry.captureMessage(
        `[test-error] captureMessage probe fired (type=${type})`,
        "info"
      );
      return NextResponse.json({
        success: true,
        message: "Sentry captureMessage fired. Check your Sentry dashboard.",
        type,
      });
    }

    // ── Throw a tagged exception for the other branches ──
    let errorMessage: string;
    switch (type) {
      case "timeout":
        errorMessage = "[test-error] Synthetic timeout: simulated LLM call exceeded 30s";
        break;
      case "database":
        errorMessage = "[test-error] Synthetic database error: simulated Prisma connection refused";
        break;
      case "generic":
      default:
        errorMessage = "[test-error] Synthetic generic error from /api/health/test-error";
        break;
    }

    // Sentry's Next.js SDK auto-captures thrown errors in route handlers.
    // We set the tag above and throw — the error propagates to the SDK.
    throw new Error(errorMessage);
  } catch (error) {
    // Re-throw synthetic errors so Sentry captures them; only catch unexpected
    // failures (e.g., bad JSON in the request body, which we already handled
    // above via .catch(() => ({}))).
    if (error instanceof Error && error.message.startsWith("[test-error]")) {
      throw error;
    }
    console.error("[health/test-error] unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected error in test-error handler" },
      { status: 500 }
    );
  }
}

// ── GET: probe to confirm the endpoint exists (no side effects) ──
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/health/test-error",
    method: "POST",
    enabled: process.env.TEST_ERROR_ENABLED === "true",
    validTypes: [...VALID_TYPES],
  });
}
