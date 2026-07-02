// scripts/simulate-circuit-breaker-trip.js
// Inserts ~450K tokens of mock AIUsageLog rows for the demo business, then
// verifies the next AI call is blocked by the circuit breaker.
//
// Run AFTER scripts/test-phase2-ai-defenses.js (which sets the tier to pro_ai).
//
// Usage: node scripts/simulate-circuit-breaker-trip.js

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const BASE = "http://localhost:3001";
const PHONE = "01787492561";
const OTP = "9999";
const BUSINESS_ID = "cmqw75ln30003vo9ahyhrs0lj";
const BUSINESS_USER = "admin";
const BUSINESS_PASSWORD = "1234";

async function main() {
  console.log("=== Circuit Breaker Trip Simulation ===\n");

  // ── Step 1: Insert mock AIUsageLog rows totaling ~450K tokens in last 24h ──
  console.log("Step 1: Inserting mock AIUsageLog rows (450K tokens in last 24h)...");
  const now = new Date();
  const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  // Insert 9 rows of 50,000 tokens each = 450,000 tokens total
  // (just above the 80% threshold of 500K = 400,000)
  const mockRows = [];
  for (let i = 0; i < 9; i++) {
    mockRows.push({
      businessId: BUSINESS_ID,
      feature: "chat",
      tokensUsed: 50000,
      costEstimate: 50000 / 1000 * 0.03,
      success: true,
      createdAt: new Date(twentyThreeHoursAgo.getTime() + i * 60 * 1000),
    });
  }
  const insertResult = await db.aIUsageLog.createMany({ data: mockRows });
  console.log(`  ✓ Inserted ${insertResult.count} mock rows (450,000 tokens total)`);

  // ── Step 2: Login as business user ──
  console.log("\nStep 2: Login as business user...");
  await fetch(`${BASE}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE }),
  });
  await fetch(`${BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE, otp: OTP }),
  });
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
    console.log("  ✗ login failed:", JSON.stringify(loginData).slice(0, 200));
    await cleanup();
    return;
  }
  console.log(`  ✓ Business token: ${bizToken.slice(0, 20)}...`);

  // ── Step 3: Try an AI call — should be blocked by circuit breaker ──
  // NOTE: We must use a message that the SQL Router does NOT recognize,
  // otherwise the router short-circuits before checkAILimit() runs.
  // "show low stock" is a SQL-router pattern; use a free-form question instead.
  console.log("\nStep 3: Calling AI chat (should be blocked by circuit breaker)...");
  const chatRes = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/ai/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bizToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "What is the meaning of life?" }), // not a router pattern
  });
  const chatData = await chatRes.json();
  console.log(`  HTTP ${chatRes.status}`);
  console.log(`  limitType: ${chatData.limitType || "n/a"}`);
  console.log(`  fallbackReason: ${chatData.fallbackReason || "n/a"}`);
  console.log(`  message: ${chatData.fallbackMessage || chatData.error || "n/a"}`);

  if (chatRes.status === 429 && chatData.limitType === "circuit_open") {
    console.log("\n  ✓ CIRCUIT BREAKER TRIP TEST PASSED");
    console.log("  The breaker correctly tripped at 450K tokens (90% of 500K monthly budget)");
    console.log("  AI call returned fallback instead of hitting the LLM");
  } else {
    console.log("\n  ✗ CIRCUIT BREAKER TRIP TEST FAILED");
    console.log("  Expected: HTTP 429, limitType=circuit_open");
    console.log("  Got:", chatRes.status, chatData.limitType);
  }

  // ── Cleanup: delete the mock rows so the breaker resets ──
  await cleanup();
}

async function cleanup() {
  console.log("\nCleanup: deleting mock AIUsageLog rows...");
  const deleteResult = await db.aIUsageLog.deleteMany({
    where: {
      businessId: BUSINESS_ID,
      tokensUsed: 50000, // only delete our mock rows
    },
  });
  console.log(`  ✓ Deleted ${deleteResult.count} mock rows`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
