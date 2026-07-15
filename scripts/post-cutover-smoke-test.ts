// =============================================================================
// InventoryOS — Post-Cutover API Smoke Test
// =============================================================================
//
// Run this after scripts/production-cutover.sh to verify the API is healthy
// against the production PostgreSQL database.
//
// Usage:
//   bunx tsx scripts/post-cutover-smoke-test.ts
//
// Or with a custom base URL:
//   API_BASE_URL=https://your-domain.com bunx tsx scripts/post-cutover-smoke-test.ts
//
// =============================================================================

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  status: "pass" | "fail";
  detail: string;
}

const results: TestResult[] = [];

async function check(
  name: string,
  url: string,
  init?: RequestInit,
  expectedStatus?: number,
): Promise<void> {
  try {
    const res = await fetch(url, init);
    const ok = expectedStatus ? res.status === expectedStatus : res.ok;
    const body = await res.text();
    const detail = ok
      ? `HTTP ${res.status}, ${body.length} bytes`
      : `HTTP ${res.status} (expected ${expectedStatus || "2xx"}), body: ${body.slice(0, 200)}`;
    results.push({ name, status: ok ? "pass" : "fail", detail });
  } catch (e) {
    results.push({
      name,
      status: "fail",
      detail: `Fetch error: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

async function checkJson(
  name: string,
  url: string,
  validator: (body: unknown) => { ok: boolean; detail: string },
): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      results.push({ name, status: "fail", detail: `HTTP ${res.status}` });
      return;
    }
    const body = await res.json();
    const result = validator(body);
    results.push({ name, status: result.ok ? "pass" : "fail", detail: result.detail });
  } catch (e) {
    results.push({
      name,
      status: "fail",
      detail: `Error: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

async function main() {
  console.log(`\n=== InventoryOS Post-Cutover Smoke Test ===`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // ─── 1. Home page ───
  await check("Home page loads", `${BASE_URL}/`);

  // ─── 2. Admin page ───
  await check("Admin page loads", `${BASE_URL}/admin`);

  // ─── 3. Health endpoint ───
  await checkJson(
    "GET /api/health — database connected",
    `${BASE_URL}/api/health`,
    (b) => {
      const body = b as { status?: string; checks?: { database?: { status?: string } } };
      const dbOk = body.checks?.database?.status === "ok";
      return {
        ok: dbOk,
        detail: dbOk
          ? `database: ok, status: ${body.status}`
          : `database status: ${body.checks?.database?.status} (expected "ok")`,
      };
    },
  );

  // ─── 4. Setup status ───
  await checkJson(
    "GET /api/setup-status — DB connected + super-admin exists",
    `${BASE_URL}/api/setup-status`,
    (b) => {
      const body = b as {
        database?: { connected?: boolean; superAdminCount?: number; hasActiveSuperAdmin?: boolean };
      };
      const dbOk = body.database?.connected === true;
      const adminOk = (body.database?.superAdminCount ?? 0) >= 1;
      const activeOk = body.database?.hasActiveSuperAdmin === true;
      const allOk = dbOk && adminOk && activeOk;
      return {
        ok: allOk,
        detail: `connected=${dbOk}, superAdminCount=${body.database?.superAdminCount}, hasActiveSuperAdmin=${body.database?.hasActiveSuperAdmin}`,
      };
    },
  );

  // ─── 5. Super-admin login ───
  const loginRes = await fetch(`${BASE_URL}/api/super-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.SUPER_ADMIN_USERNAME || "superadmin",
      password: process.env.SUPER_ADMIN_DEFAULT_PASSWORD || "admin123",
    }),
  });
  if (loginRes.ok) {
    const loginBody = await loginRes.json() as { success?: boolean; token?: string };
    results.push({
      name: "POST /api/super-admin/login — superadmin / admin123",
      status: loginBody.success ? "pass" : "fail",
      detail: loginBody.success
        ? `Login successful, token received (${loginBody.token?.slice(0, 8)}...)`
        : `Login failed: ${JSON.stringify(loginBody).slice(0, 200)}`,
    });
  } else {
    const errBody = await loginRes.text();
    results.push({
      name: "POST /api/super-admin/login — superadmin / admin123",
      status: "fail",
      detail: `HTTP ${loginRes.status}: ${errBody.slice(0, 200)}`,
    });
  }

  // ─── 6. Businesses API (requires auth — expect 4xx, not 500) ───
  // Note: the endpoint may return 401 (Unauthorized) or 400 (Bad Request — missing phone).
  // Either is acceptable as long as it's not a 500 (server error).
  const businessesRes = await fetch(`${BASE_URL}/api/businesses`);
  const businessesOk = businessesRes.status >= 400 && businessesRes.status < 500;
  results.push({
    name: "GET /api/businesses — auth gate (expect 4xx, not 500)",
    status: businessesOk ? "pass" : "fail",
    detail: `HTTP ${businessesRes.status} ${businessesOk ? "(auth gate working)" : "(server error — check logs)"}`,
  });

  // ─── 7. Deploy status (super-admin endpoint) ───
  // This one we expect to require auth — 401 is OK, 500 is not
  await fetch(`${BASE_URL}/api/super-admin/deploy-status`).then(async (res) => {
    const ok = res.status === 401 || res.status === 200; // 401 = auth required (expected), 200 = open
    results.push({
      name: "GET /api/super-admin/deploy-status — endpoint reachable",
      status: ok ? "pass" : "fail",
      detail: `HTTP ${res.status} ${ok ? "(auth gate working)" : "(unexpected — server error?)"}`,
    });
  }).catch(() => {
    results.push({
      name: "GET /api/super-admin/deploy-status — endpoint reachable",
      status: "fail",
      detail: "Fetch error",
    });
  });

  // ─── Summary ───
  console.log("--- Results ---\n");
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);
    console.log(`   ${r.detail}\n`);
  }
  console.log("--- Summary ---");
  console.log(`Passed: ${passed} / ${results.length}`);
  console.log(`Failed: ${failed} / ${results.length}`);
  if (failed > 0) {
    console.log("\n❌ Some checks failed. Review the details above.");
    process.exit(1);
  } else {
    console.log("\n✅ All smoke tests passed. Cutover verified.");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
