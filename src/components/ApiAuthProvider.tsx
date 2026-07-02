"use client";

// ── InventoryOS: Global API auth wrapper ──
// The pharmacy UI issues its data fetches with plain `fetch` and no auth header,
// but the Edge middleware (src/middleware.ts) requires a token on every
// /api/businesses/** and /api/super-admin/** request. This component patches
// window.fetch once so same-origin /api/ requests automatically carry
// `Authorization: Bearer <session token>` when a session exists. Without this,
// every authenticated screen 401s after login.
//
// It only touches same-origin "/api/" requests, never overrides an
// Authorization header the caller already set, and is a no-op when logged out.

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";

// The client stores the full login response as `session`, so the token can live
// at either `session.session.token` (current shape) or `session.token`.
function getToken(): string | null {
  const s = useAuthStore.getState().session as
    | { token?: string; session?: { token?: string } }
    | null;
  return s?.session?.token || s?.token || null;
}

function isSameOriginApi(url: string): boolean {
  if (url.startsWith("/api/")) return true;
  if (typeof window !== "undefined" && url.startsWith(`${window.location.origin}/api/`)) return true;
  return false;
}

export function ApiAuthProvider() {
  useEffect(() => {
    const w = window as unknown as { __invFetchPatched?: boolean; fetch: typeof fetch };
    if (w.__invFetchPatched) return;

    const originalFetch = window.fetch.bind(window);
    w.__invFetchPatched = true;

    w.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : String(input);

        if (isSameOriginApi(url)) {
          const token = getToken();
          if (token) {
            const headers = new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined)
            );
            if (!headers.has("Authorization")) {
              headers.set("Authorization", `Bearer ${token}`);
              return originalFetch(input, { ...init, headers });
            }
          }
        }
      } catch {
        // Never let the wrapper break a request — fall through to the original.
      }
      return originalFetch(input as RequestInfo | URL, init);
    };

    return () => {
      w.fetch = originalFetch;
      w.__invFetchPatched = false;
    };
  }, []);

  return null;
}
