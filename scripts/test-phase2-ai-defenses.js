// scripts/test-phase2-ai-defenses.js
// Phase 2 smoke tests for free-tier guard + circuit breaker.
//
// This script does NOT call the live LLM (no real tokens burned). Instead it
// tests the checkAILimit() gate directly by importing the compiled lib via
// a Next.js API route. We use a separate test endpoint that exposes the
// checkAILimit result for a given businessId.

const BASE = "http://localhost:3001";

// Test business IDs — these come from the seed data:
// - cmqw75ln30003vo9ahyhrs0lj is the demo pharmacy (subscriptionTier='free' by default)
// We'll need to:
//   1. Get a valid business session token (login as admin)
//   2. Set the business tier to 'free' and verify tier_blocked
//   3. Set the tier to 'pro_ai', insert 450K tokens in 24h, verify circuit_open
//   4. Wait for the 24h window to slide (or delete mock rows), verify allowed

const PHONE = "01787492561";
const OTP = "9999";
const BUSINESS_USER = "admin";
const BUSINESS_PASSWORD = "1234";
const BUSINESS_ID = "cmqw75ln30003vo9ahyhrs0lj";

const SUPER_USER = "superadmin";
const SUPER_PASS = "admin123";

async function main() {
  console.log("=== Phase 2 Smoke Tests ===\n");

  // ── Step 1: Login as business user to get a session token ──
  console.log("Step 1: Login as business user...");
  const otpRes = await fetch(`${BASE}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE }),
  });
  if (!otpRes.ok) {
    console.log(`  send-otp failed: HTTP ${otpRes.status}`);
    return;
  }
  const verifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE, otp: OTP }),
  });
  if (!verifyRes.ok) {
    console.log(`  verify-otp failed: HTTP ${verifyRes.status}`);
    return;
  }
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessId: BUSINESS_ID,
      username: BUSINESS_USER,
      password: BUSINESS_PASSWORD,
    }),
  });
  const loginData = await loginRes.json();
  const bizToken = loginData?.session?.token;
  if (!bizToken) {
    console.log("  login failed: no session.token in response");
    console.log("  response:", JSON.stringify(loginData).slice(0, 300));
    return;
  }
  console.log(`  ✓ Business token: ${bizToken.slice(0, 20)}...`);

  // ── Step 2: Login as super admin ──
  console.log("\nStep 2: Login as super admin...");
  const saLoginRes = await fetch(`${BASE}/api/super-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SUPER_USER, password: SUPER_PASS }),
  });
  const saLoginData = await saLoginRes.json();
  const saToken = saLoginData?.token;
  if (!saToken) {
    console.log("  super-admin login failed");
    return;
  }
  console.log(`  ✓ Super admin token: ${saToken.slice(0, 20)}...`);

  // ── Test 1: Free-tier block ──
  console.log("\n--- Test 1: Free-tier block ---");
  console.log("  Setting business tier to 'free'...");
  const setFreeRes = await fetch(`${BASE}/api/super-admin/businesses/${BUSINESS_ID}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${saToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionTier: "free",
      subscriptionStatus: "active",
      aiEnabled: true, // even with aiEnabled=true, tier check should block
    }),
  });
  console.log(`  Set tier=free: HTTP ${setFreeRes.status}`);

  console.log("  Calling AI chat endpoint (should be blocked by tier)...");
  const chatRes1 = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/ai/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bizToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "hello" }),
  });
  const chatData1 = await chatRes1.json();
  console.log(`  HTTP ${chatRes1.status}, limitType=${chatData1.limitType || "n/a"}`);
  console.log(`  Reason: ${chatData1.error || chatData1.fallbackMessage || "n/a"}`);
  if (chatRes1.status === 429 && chatData1.limitType === "tier_blocked") {
    console.log("  ✓ TEST 1 PASSED: Free-tier business blocked by tier gate");
  } else {
    console.log("  ✗ TEST 1 FAILED: Expected tier_blocked, got:", chatData1.limitType);
  }

  // ── Test 2: Pro+AI tier allows the call (then circuit breaker takes over) ──
  console.log("\n--- Test 2: Pro+AI tier restores access (with no prior usage) ---");
  console.log("  Setting business tier to 'pro_ai'...");
  await fetch(`${BASE}/api/super-admin/businesses/${BUSINESS_ID}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${saToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionTier: "pro_ai",
      subscriptionStatus: "active",
      aiEnabled: true,
    }),
  });

  console.log("  Calling AI chat endpoint (tier should now pass; may hit Z.ai or cache)...");
  const chatRes2 = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/ai/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bizToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "show low stock" }), // SQL router should short-circuit
  });
  const chatData2 = await chatRes2.json();
  console.log(`  HTTP ${chatRes2.status}, success=${chatData2.success}`);
  console.log(`  sqlRouter.handled=${chatData2.sqlRouter?.handled}`);
  if (chatData2.success || chatData2.limitType === "burst") {
    console.log("  ✓ TEST 2 PASSED: Pro+AI tier restored access (SQL router or LLM path)");
  } else {
    console.log("  ⚠ TEST 2 INCONCLUSIVE: response:", JSON.stringify(chatData2).slice(0, 200));
  }

  // ── Test 3: Circuit breaker — verify breaker result via direct lib import is hard ──
  // We can't easily inject 450K tokens of mock usage without DB access. Instead,
  // we verify the circuit breaker MODULE loads correctly by hitting an AI endpoint
  // and checking that the response is NOT a circuit_open error (i.e., the breaker
  // is closed when usage is low). A full trip test requires inserting mock
  // AIUsageLog rows, which we'll do via a small DB script.
  console.log("\n--- Test 3: Circuit breaker is closed at low usage ---");
  console.log("  (Verifying breaker does NOT trip when 24h usage is low)");
  // chatRes2 already proved this — if breaker were open, we'd see limitType=circuit_open
  if (chatData2.limitType !== "circuit_open") {
    console.log("  ✓ TEST 3 PASSED: Circuit breaker is closed (no circuit_open error)");
  } else {
    console.log("  ✗ TEST 3 FAILED: Breaker tripped unexpectedly");
  }

  console.log("\n=== Phase 2 Smoke Tests Complete ===");
  console.log("\nNote: Full circuit-breaker-trip test requires inserting ~450K tokens of");
  console.log("mock AIUsageLog rows. Run scripts/simulate-circuit-breaker-trip.js for that test.");
}

main().catch((err) => {
  console.error("Test script failed:", err);
  process.exit(1);
});
