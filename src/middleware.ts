// ── InventoryOS: Edge Middleware (API Authentication Gate) ──
//
// Intercepts every request to /api/* and enforces authentication for
// protected business & super-admin routes. Runs on the Edge runtime so
// it has NO Prisma/Node-only access — it just verifies that a token is
// present. The actual token verification happens inside each route
// handler via @/lib/auth (which can use Prisma on the Node runtime).
//
// Token sources (in priority order):
//   1. Authorization: Bearer <token>   header
//   2. session_token=<token>           cookie
//
// PUBLIC_ROUTES bypass auth entirely (some are GET-only — POST/PUT/DELETE
// on those routes still require auth).

import { NextRequest, NextResponse } from "next/server";

// ── Public routes that NEVER require auth ──
// Format: "/path" or "/path:METHOD" (e.g. "/api/businesses:GET" = GET only)
const PUBLIC_ROUTES: string[] = [
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/register",
  "/api/auth/login",
  "/api/businesses:GET", // GET list/create-business flow is public; mutations need auth
  "/api/super-admin/login",
  "/api/health",
  "/api/health/test-error",
];

// Routes under these prefixes require an auth token when not in PUBLIC_ROUTES
const PROTECTED_PREFIXES = ["/api/businesses/", "/api/super-admin/"];

/**
 * Check whether a given pathname + method combo is publicly accessible.
 * Handles both unconditional public routes ("/api/health") and method-scoped
 * public routes ("/api/businesses:GET").
 */
function isPublicRoute(pathname: string, method: string): boolean {
  const upperMethod = method.toUpperCase();
  for (const route of PUBLIC_ROUTES) {
    // Unconditional: "/api/health" matches "/api/health" exactly
    if (!route.includes(":")) {
      if (pathname === route) return true;
      continue;
    }
    // Method-scoped: "/api/businesses:GET"
    const [routePath, routeMethod] = route.split(":");
    if (pathname === routePath && routeMethod === upperMethod) return true;
  }
  return false;
}

/** Returns true if the route is one we should gate (business or super-admin API). */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Extract auth token from Authorization header (Bearer ...) OR session_token cookie. */
function extractToken(req: NextRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader) {
    const trimmed = authHeader.trim();
    const match = trimmed.match(/^Bearer\s+(.+)$/i);
    if (match && match[1]) {
      const token = match[1].trim();
      if (token.length > 0) return token;
    }
  }
  // 2. session_token cookie
  const cookieToken = req.cookies.get("session_token")?.value;
  if (cookieToken && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }
  return null;
}

/** Build a JSON 401 response. */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required", type: "auth_required" },
    { status: 401 }
  );
}

// ── Next.js middleware entry point ──
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // ── 1. Skip non-API routes entirely (static assets, pages, etc.) ──
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── 2. Skip CORS preflight ──
  if (method === "OPTIONS") {
    return NextResponse.next();
  }

  // ── 3. Check public-route whitelist (covers auth/login + GET /api/businesses) ──
  if (isPublicRoute(pathname, method)) {
    return NextResponse.next();
  }

  // ── 4. Skip routes that aren't business/super-admin (other API routes pass through) ──
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // ── 5. Protected route — require token presence ──
  const token = extractToken(req);
  if (!token) {
    return unauthorized();
  }

  // ── 6. Token present — let route handler do full verification via @/lib/auth ──
  // We forward the token in a normalized header so downstream handlers can read
  // x-inventory-token reliably (in addition to the original Authorization header / cookie).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-inventory-token", token);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ── Matcher: only run middleware on /api/* routes ──
export const config = {
  matcher: ["/api/:path*"],
};
