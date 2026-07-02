// Body Part 3: Section 5 (Mitigation Plan) + Section 6 (Final Verdict & Kill Switch)
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildMitigationPlan() {
  const out = [];
  out.push(h1("5. Mitigation Plan"));

  out.push(bodyPara(
    "This section translates the Section 4 risk analysis into a concrete, prioritized implementation plan. Each fix is described with: the problem it solves, the exact code change required (including file:line references where applicable), the expected token-cost savings per call, the implementation effort estimate (S = under 1 hour, M = 1 to 4 hours, L = over 4 hours), and the priority (P0 = ship before 50 pharmacies, P1 = ship within 30 days, P2 = backlog). The plan is sequenced so that the highest-leverage fixes come first."
  ));

  out.push(h2("5.1 Top 5 Fixes Ranked by Cost Impact"));

  out.push(tableCaption("Table 5.1 — Top 5 Mitigation Fixes"));
  out.push(makeTable(
    ["#", "Fix", "File:Line", "Token Savings per Call", "Effort", "Priority"],
    [
      ["1",
       "Add max_tokens cap to all 4 LLM routes (chat=1024, insights=2048, expiry-opt=2048, prod-asst=512)",
       "4 files: ai/chat/route.ts, ai/insights/route.ts, ai/expiry-optimizer/route.ts, ai/product-assistant/route.ts (in the zai.chat.completions.create call)",
       "Up to 70% of output cost",
       "S (20 min)",
       "P0"],
      ["2",
       "Add take: 50 + orderBy: { expiryDate: 'asc' } to expiry-optimizer's batch.findMany call",
       "src/app/api/businesses/[id]/ai/expiry-optimizer/route.ts ~line 66",
       "Up to 32,000 tokens per call (worst case)",
       "S (10 min)",
       "P0"],
      ["3",
       "Validate products.length <= 20 in product-assistant check_interactions action",
       "src/app/api/businesses/[id]/ai/product-assistant/route.ts ~line 124",
       "Up to 8,000 tokens per malicious call",
       "S (5 min)",
       "P0"],
      ["4",
       "Import getTierConfig in all 4 AI routes; return 403 with upgrade prompt if tier != pro_ai",
       "4 files (same as Fix #1)",
       "Prevents all free-tier AI cost",
       "M (1 hour)",
       "P1"],
      ["5",
       "Add global circuit breaker: if business AIUsageLog shows >80% of monthly budget consumed in 24h, switch to fallback-only mode",
       "New file: src/lib/ai-circuit-breaker.ts; import in ai-rate-limit.ts",
       "Caps worst-case runaway at 80% of monthly budget",
       "M (3 hours)",
       "P1"],
    ],
    [6, 30, 26, 18, 10, 10]
  ));

  out.push(h2("5.2 Detailed Fix Specifications"));

  out.push(h3("Fix #1 — max_tokens Cap (P0, 20 minutes)"));

  out.push(bodyPara(
    "In each of the four LLM route files, locate the zai.chat.completions.create() call. It currently passes only { messages, thinking: { type: 'disabled' } }. Add a max_tokens field to this options object. Recommended values: chat=1024 (covers ~700-word responses, enough for any single Q&A), insights=2048 (covers 5-8 JSON insights plus 3-5 recommendations), expiry-optimizer=2048 (covers per-batch analysis for up to 50 batches), product-assistant=512 (covers a single product description or interaction warning). These values are deliberately generous — they should not truncate any legitimate response — but they prevent the worst-case 5,000+ token ramble. Expected cost reduction: 30-70% on output tokens, depending on how often GLM-4 currently generates long responses."
  ));

  out.push(h3("Fix #2 — Expiry Optimizer Row Cap (P0, 10 minutes)"));

  out.push(bodyPara(
    "In src/app/api/businesses/[id]/ai/expiry-optimizer/route.ts, around line 66, the route calls db.batch.findMany({ where: { businessId, status: { in: ['active', 'quarantined'] } } }). Add take: 50 and orderBy: { expiryDate: 'asc' } to this call. This limits the context payload to the 50 batches closest to expiry — which is exactly the set the user cares about anyway. For pharmacies with more than 50 batches approaching expiry, the response will cover the 50 most urgent ones, and the user can run the optimizer again after disposing of those to see the next 50. This is actually a better UX than the current behavior, which dumps all batches into one overwhelming AI response. Expected cost reduction: 100% of the worst-case 36,000-token-prompt scenario."
  ));

  out.push(h3("Fix #3 — Product Array Validation (P0, 5 minutes)"));

  out.push(bodyPara(
    "In src/app/api/businesses/[id]/ai/product-assistant/route.ts, around line 124, the check_interactions action destructures products from the request body without validating its length. Add a guard immediately after destructuring: if (!Array.isArray(products) || products.length === 0) return 400 with a friendly error message, and if (products.length > 20) return 400 with a message suggesting the user split the request. Twenty medications is a reasonable upper bound for a single interaction check — pharmacies with more complex regimens should check in batches. Expected cost reduction: 100% of the malicious-100-med-request scenario."
  ));

  out.push(h3("Fix #4 — Free-Tier Guard (P1, 1 hour)"));

  out.push(bodyPara(
    "In each of the four AI route files, after the existing authentication check (which extracts the businessId from the session), add a tier check. Import { getTierConfig } from '@/lib/feature-gate', call it with the business's subscriptionTier field, and if the tier config does not include the ai feature flag, return a 403 response with a JSON body { error: 'AI features require the Pro+AI tier. Please upgrade at /subscription.' }. This requires a small refactor to feature-gate.ts to expose an aiEnabled boolean on the tier config. Expected cost reduction: 100% of free-tier AI cost, which is currently unbilled but should be a paid feature."
  ));

  out.push(h3("Fix #5 — Global Circuit Breaker (P1, 3 hours)"));

  out.push(bodyPara(
    "Create a new file src/lib/ai-circuit-breaker.ts exporting a function checkCircuitBreaker(businessId) that queries the AIUsageLog for the past 24 hours and sums tokensUsed. If the sum exceeds 80% of the business's aiTokenBudget field (which is 500,000 by default), return a 'circuit open' result. In ai-rate-limit.ts, modify checkAILimit() to call checkCircuitBreaker() before the existing rate-limit checks, and if the circuit is open, return a rate-limit-exceeded response that triggers the fallback path instead of the LLM call. This is the single most important defense against runaway cost — it means that even if all other mitigations fail, no single pharmacy can ever burn more than 80% of their monthly token budget in a single 24-hour window. Expected cost reduction: caps worst-case per-pharmacy monthly cost at 12 BDT (80% of 15 BDT) regardless of abuser ingenuity."
  ));

  out.push(h2("5.3 Implementation Roadmap"));

  out.push(bodyPara(
    "The fixes are sequenced into three milestones. The 7-day milestone ships the three P0 fixes (max_tokens, row cap, array validation) — these are all under 30 minutes of work combined and eliminate the worst-case cost scenarios. The 30-day milestone ships the two P1 fixes (free-tier guard, circuit breaker) — these provide the structural defenses needed to scale beyond 50 pharmacies. The 90-day milestone addresses the P2 backlog (Product Assistant cache, Insights prompt refactor, AIUsageLog for non-LLM features) — these are optimizations that improve margin but are not blocking."
  ));

  out.push(tableCaption("Table 5.2 — Implementation Roadmap"));
  out.push(makeTable(
    ["Milestone", "Fixes Shipped", "Cumulative Risk Reduction", "Effort"],
    [
      ["7 days (before next paying customer)",
       "Fix #1 (max_tokens), Fix #2 (row cap), Fix #3 (array validation)",
       "~85% of worst-case cost eliminated",
       "35 minutes total"],
      ["30 days (before 50 pharmacies)",
       "Fix #4 (free-tier guard), Fix #5 (circuit breaker)",
       "~98% of worst-case cost eliminated; per-pharmacy cap enforced at 80% of token budget",
       "4 hours total"],
      ["90 days (continuous improvement)",
       "Product Assistant cache layer, Insights prompt refactor, AIUsageLog for forecast/reorder, ReorderSuggestions client-side cache",
       "Marginal improvements; ~10% additional cost reduction",
       "8 hours total"],
    ],
    [22, 36, 30, 12]
  ));

  out.push(h2("5.4 Operational Monitoring Recommendations"));

  out.push(bodyPara(
    "Beyond code fixes, the founder should establish three operational habits. First, check the super-admin AI usage dashboard (/admin) weekly during the first 90 days — this dashboard already exists and shows total AI cost today, top spenders, and per-feature usage. Look for any single pharmacy consuming more than 20% of the platform total. Second, set up a Sentry alert (or simple cron-job alert) that fires when total platform AI cost in a 24-hour window exceeds 1,000 BDT — this is well below the kill-switch threshold but indicates either a new paying customer or a potential abuse pattern worth investigating. Third, after the first paying customer's first full month, compare the AIUsageLog actual cost to the Section 3 estimates. If actual is more than 2x the estimate, pause scaling and investigate which feature is consuming more tokens than expected."
  ));

  return out;
}

function buildFinalVerdict() {
  const out = [];
  out.push(h1("6. Final Verdict & Kill Switch Criteria"));

  out.push(bodyPara(
    "This section answers the founder's three original questions in plain English and defines the explicit kill-switch criteria that determine when AI features should be disabled platform-wide. The verdict is structured around three scales: current (1 to 10 pharmacies), growth (50 to 200 pharmacies), and scale (1,000+ pharmacies)."
  ));

  out.push(h2("6.1 Will AI Costs Jeopardize the Project?"));

  out.push(bodyPara(
    "At the current scale of 1 to 10 pharmacies, the answer is an unambiguous no. The worst-case monthly AI bill is 750 BDT (~$6.80 USD), which is well within any reasonable operating budget. Even if every pharmacy simultaneously hit their token budget cap, the platform would spend 150 BDT/month total — less than the cost of a single developer's lunch. There is no scenario, including the worst-case abuser scenarios in Section 4.6, in which AI costs threaten InventoryOS at the current scale."
  ));

  out.push(bodyPara(
    "At the growth scale of 50 to 200 pharmacies, the answer is still no, provided the P0 fixes from Section 5 are shipped. Without those fixes, a coordinated abuser could push the platform's monthly bill to 30,000 BDT (~$273 USD) at 200 pharmacies — annoying but not fatal. With the P0 fixes, the same 200 pharmacies would cost approximately 3,000 to 6,000 BDT/month, which is trivially covered by subscription revenue at 150 BDT/month per pharmacy (total revenue: 30,000 BDT/month)."
  ));

  out.push(bodyPara(
    "At the scale of 1,000+ pharmacies, AI cost becomes material but remains sustainable with proper pricing. At 1,000 power-user pharmacies, the monthly AI bill is approximately 75,000 BDT (~$680 USD). Subscription revenue at 150 BDT/month per pharmacy is 150,000 BDT/month, leaving a 75,000 BDT gross margin to cover server costs, Z.ai billing, and other infrastructure. This is a healthy unit economics profile. The risk at this scale is not AI cost itself, but the variance — a single abuser pharmacy could cost 100x the average, so the circuit breaker (Fix #5) becomes essential."
  ));

  out.push(h2("6.2 Kill-Switch Criteria"));

  out.push(bodyPara(
    "The founder should define and enforce three explicit kill-switch criteria. If any one of these criteria is triggered, all AI endpoints should automatically return the fallback response (bypassing the LLM call entirely) and the founder should be notified by email and Sentry alert within 5 minutes. The kill-switch should remain active until the founder manually re-enables AI via the super-admin dashboard."
  ));

  out.push(tableCaption("Table 6.1 — Kill-Switch Criteria (Auto-Disable AI)"));
  out.push(makeTable(
    ["Criterion", "Threshold", "Rationale", "Auto-Recovery?"],
    [
      ["Per-pharmacy monthly cost exceeds cap",
       "200 BDT/month (13.3x the average)",
       "Indicates either abuser or runaway prompt. Cap is 80% above the 15 BDT hard cap from token budget — leaves room for legitimate edge cases.",
       "No — requires founder review"],
      ["Single pharmacy consumes >50,000 tokens in 24h",
       "50,000 tokens/day (10% of monthly budget in one day)",
       "Indicates script-kiddie attack, infinite refresh loop, or bug. Normal power user consumes ~10,000 tokens/day.",
       "No — requires founder review"],
      ["Platform-wide monthly AI cost exceeds cap",
       "100,000 BDT/month (~$909 USD)",
       "At this level, AI cost is material relative to typical Bangladesh SaaS revenue. Pause and reassess pricing.",
       "No — requires pricing review"],
      ["Z.ai API error rate exceeds 10% in 1 hour",
       ">10% error rate sustained 60 min",
       "Indicates Z.ai outage or quota exhaustion. Switch to fallback-only to preserve UX.",
       "Yes — auto-recover when error rate drops below 1% for 30 min"],
    ],
    [30, 22, 38, 10]
  ));

  out.push(h2("6.3 Recommended Subscription Pricing"));

  out.push(bodyPara(
    "Based on the Section 3 cost model, the founder should adopt a three-tier pricing structure that aligns subscription revenue with AI cost. The Free tier gets zero AI calls — this is enforced by Fix #4 (free-tier guard). The Pro tier gets limited AI (50 calls/month, enough to taste the value) at 99 BDT/month. The Pro+AI tier gets full AI (1,000 calls/month, 500K tokens) at 199 BDT/month. This pricing provides 6x to 13x margin over AI cost at all scales, which is healthy for a SaaS business. The price points are also psychologically attractive in the Bangladesh market — under 200 BDT/month is an impulse-purchase decision for a pharmacy owner, not a budget committee decision."
  ));

  out.push(tableCaption("Table 6.2 — Recommended Subscription Pricing"));
  out.push(makeTable(
    ["Tier", "Price (BDT/mo)", "AI Calls/mo", "AI Cost/mo (worst)", "Margin"],
    [
      ["Free", "0", "0 (no AI)", "0", "n/a"],
      ["Pro", "99", "50 (limited)", "~1.50", "66x"],
      ["Pro+AI", "199", "1,000 (full)", "~15.00", "13x"],
      ["Enterprise (custom)", "499+", "Unlimited (with circuit breaker)", "~15.00 (cap)", "33x+"],
    ],
    [22, 16, 22, 22, 18]
  ));

  out.push(h2("6.4 GO / WATCH / STOP Recommendation"));

  out.push(bodyParaRich([
    tr("GO: ", { bold: true, color: P.accent, size: 24 }),
    tr("Ship AI features to the first paying customer today. The infrastructure is sound, the cost is negligible at current scale, and the UX value is real. Do not wait for the P0 fixes — they should ship within 7 days but are not blocking the first customer.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("WATCH: ", { bold: true, color: P.amber, size: 24 }),
    tr("Check the super-admin AI dashboard weekly for the first 90 days. Compare actual AIUsageLog data to the Section 3 estimates after the first paying customer's first full month. If actual cost is more than 2x the estimate, pause scaling and investigate.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("STOP (do not cross without these): ", { bold: true, color: P.rose, size: 24 }),
    tr("Do not scale beyond 50 pharmacies without shipping the three P0 fixes (max_tokens, row cap, array validation). Do not scale beyond 200 pharmacies without shipping the two P1 fixes (free-tier guard, circuit breaker). Do not scale beyond 1,000 pharmacies without implementing the kill-switch criteria in Table 6.1 and validating actual cost against the Section 3 model.", { size: 22 }),
  ]));

  out.push(h2("6.5 Summary"));

  out.push(bodyPara(
    "InventoryOS's AI integration is well-designed, properly rate-limited, and economically viable at every realistic scale. The Z.ai GLM-4 cost advantage (~18x cheaper than GPT-4o) is the foundation that makes BDT-priced AI features possible. The three high-severity red flags identified in this report are implementation gaps, not design flaws — they are cheap to fix (35 minutes of code for the P0 set) and should be closed before scaling beyond 50 pharmacies. The kill-switch criteria in Section 6.2 provide a clear, automated defense against any future cost surprise. With the P0 fixes shipped and the kill-switch criteria enforced, the founder can confidently market AI features as a core competitive advantage of InventoryOS without losing sleep over token bills."
  ));

  out.push(calloutPara(
    "Final word: AI is not a cost center for InventoryOS — it is a margin center. At 199 BDT/month for the Pro+AI tier and 15 BDT/month worst-case AI cost per pharmacy, every AI-enabled subscriber contributes 184 BDT of gross margin that the founder can reinvest in product, support, or growth. Ship the P0 fixes, set the kill-switch, and go sell.",
    P.accent
  ));

  return out;
}

// =============================================================================
// SECTION 7: PHASED IMPLEMENTATION PLAN (added per founder request)
// =============================================================================
function buildPhasedPlan() {
  const out = [];
  out.push(h1("7. Phased Implementation Plan"));

  out.push(bodyPara(
    "This section converts every fix, recommendation, and gating criterion from Sections 4, 5, and 6 into a single sequenced roadmap. The plan is divided into five phases, each with a clear goal, a fixed duration, a concrete task list (with file paths and effort estimates), explicit exit criteria, and a status checkbox. Work through the phases in order — do not skip ahead. Each phase's exit criteria must be fully met before the next phase begins. The total effort across all phases is approximately 16 hours of developer time spread over 90 days, plus ongoing operational monitoring."
  ));

  out.push(bodyPara(
    "The phases are sized so that Phase 1 ships before the next paying customer (7 days, 35 minutes of code), Phase 2 ships before the platform crosses 50 pharmacies (30 days, 4 hours of code), Phase 3 ships before 200 pharmacies (60 days, 6 hours of code), Phase 4 implements the kill-switch automation before 1,000 pharmacies (90 days, 3 hours of code), and Phase 5 is the ongoing operational rhythm that continues indefinitely. The phases map directly to the GO / WATCH / STOP criteria in Section 6.4 \u2014 each STOP gate corresponds to completing a phase."
  ));

  // ----- PHASE 1 -----
  out.push(h2("Phase 1 \u2014 P0 Critical Fixes (Days 1 to 7)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Eliminate the three HIGH-severity cost-leakage risks before the next paying customer is onboarded. After Phase 1, a single worst-case AI call cannot burn more than ~0.30 BDT, regardless of pharmacy size or user behavior.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Duration: ", { bold: true, size: 22 }),
    tr("7 calendar days. Active development time: 35 minutes (plus 1 hour for code review, testing, and commit).", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Blocking gate: ", { bold: true, color: P.rose, size: 22 }),
    tr("Do NOT onboard any new paying Pro+AI customer until Phase 1 is complete and exit criteria are verified.", { size: 22 }),
  ]));

  out.push(h3("Phase 1 Tasks"));

  out.push(tableCaption("Table 7.1 \u2014 Phase 1 Task List (P0 Fixes)"));
  out.push(makeTable(
    ["#", "Task", "File to Edit", "Change", "Effort", "Done?"],
    [
      ["1.1",
       "Add max_tokens cap to AI Chat route",
       "src/app/api/businesses/[id]/ai/chat/route.ts",
       "In the zai.chat.completions.create() call, add max_tokens: 1024 to the options object",
       "5 min",
       "[ ]"],
      ["1.2",
       "Add max_tokens cap to AI Insights route",
       "src/app/api/businesses/[id]/ai/insights/route.ts",
       "Add max_tokens: 2048 to the API call options",
       "5 min",
       "[ ]"],
      ["1.3",
       "Add max_tokens cap to Expiry Optimizer route",
       "src/app/api/businesses/[id]/ai/expiry-optimizer/route.ts",
       "Add max_tokens: 2048 to the API call options",
       "5 min",
       "[ ]"],
      ["1.4",
       "Add max_tokens cap to Product Assistant route",
       "src/app/api/businesses/[id]/ai/product-assistant/route.ts",
       "Add max_tokens: 512 to the API call options (covers all 4 sub-actions)",
       "5 min",
       "[ ]"],
      ["1.5",
       "Cap batch query in Expiry Optimizer",
       "src/app/api/businesses/[id]/ai/expiry-optimizer/route.ts (~line 66)",
       "Add take: 50 and orderBy: { expiryDate: 'asc' } to the db.batch.findMany() call",
       "5 min",
       "[ ]"],
      ["1.6",
       "Validate products array length in Product Assistant",
       "src/app/api/businesses/[id]/ai/product-assistant/route.ts (~line 124)",
       "Add guard: if (!Array.isArray(products) || products.length === 0) return 400; if (products.length > 20) return 400 with friendly message",
       "5 min",
       "[ ]"],
      ["1.7",
       "Manual smoke test all 4 AI endpoints",
       "Use the dev server + Postman or curl",
       "Hit each endpoint with a normal request and verify the response is not truncated. Then hit expiry-optimizer with a business that has 100+ batches and verify the response is fast and bounded.",
       "30 min",
       "[ ]"],
      ["1.8",
       "Commit, push, and tag release",
       "git commit -m 'fix(ai): P0 cost-leakage fixes \u2014 max_tokens, row cap, array validation (Phase 1)'",
       "Tag as v1.1.0-ai-p0 for traceability",
       "5 min",
       "[ ]"],
    ],
    [6, 26, 28, 30, 10, 10]
  ));

  out.push(h3("Phase 1 Exit Criteria"));
  out.push(bulletItem("All 8 tasks in Table 7.1 are checked off."));
  out.push(bulletItem("Code is committed and pushed to main branch on GitHub."));
  out.push(bulletItem("Smoke test confirms: AI Chat returns responses under 1,024 tokens; Expiry Optimizer on a 100+ batch business returns in under 5 seconds with a bounded response; Product Assistant rejects a 21-medication check_interactions request with a 400 error."));
  out.push(bulletItem("Super-admin AI usage dashboard still loads correctly with no errors."));
  out.push(bulletItem("Cost-per-call on a typical chat query is now bounded at ~0.08 BDT (was uncapped before)."));

  // ----- PHASE 2 -----
  out.push(h2("Phase 2 \u2014 P1 Structural Defenses (Days 8 to 30)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Ship the two structural defenses (free-tier guard and global circuit breaker) that prevent free-tier abuse and runaway cost. After Phase 2, no free-tier user can call any AI endpoint, and no single pharmacy can burn more than 80 percent of their monthly token budget in any 24-hour window.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Duration: ", { bold: true, size: 22 }),
    tr("23 calendar days (overlapping with Phase 1's tail). Active development time: 4 hours.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Blocking gate: ", { bold: true, color: P.rose, size: 22 }),
    tr("Do NOT scale beyond 50 pharmacies until Phase 2 is complete.", { size: 22 }),
  ]));

  out.push(h3("Phase 2 Tasks"));

  out.push(tableCaption("Table 7.2 \u2014 Phase 2 Task List (P1 Fixes)"));
  out.push(makeTable(
    ["#", "Task", "File to Edit / Create", "Change", "Effort", "Done?"],
    [
      ["2.1",
       "Refactor feature-gate.ts to expose aiEnabled boolean",
       "src/lib/feature-gate.ts",
       "Add aiEnabled: boolean to the TierConfig return type; set true for pro_ai tier only",
       "20 min",
       "[ ]"],
      ["2.2",
       "Import getTierConfig in AI Chat route + add tier check",
       "src/app/api/businesses/[id]/ai/chat/route.ts",
       "After auth check, call getTierConfig(business.subscriptionTier); if !config.aiEnabled, return 403 with { error: 'AI features require Pro+AI tier. Upgrade at /subscription.' }",
       "15 min",
       "[ ]"],
      ["2.3",
       "Add same tier check to AI Insights route",
       "src/app/api/businesses/[id]/ai/insights/route.ts",
       "Same pattern as 2.2",
       "10 min",
       "[ ]"],
      ["2.4",
       "Add same tier check to Expiry Optimizer route",
       "src/app/api/businesses/[id]/ai/expiry-optimizer/route.ts",
       "Same pattern as 2.2",
       "10 min",
       "[ ]"],
      ["2.5",
       "Add same tier check to Product Assistant route",
       "src/app/api/businesses/[id]/ai/product-assistant/route.ts",
       "Same pattern as 2.2",
       "10 min",
       "[ ]"],
      ["2.6",
       "Create circuit breaker module",
       "src/lib/ai-circuit-breaker.ts (NEW FILE)",
       "Export checkCircuitBreaker(businessId) that sums tokensUsed from AIUsageLog in last 24h; if sum > 0.8 * business.aiTokenBudget, return { open: true, tokensUsed, tokensBudget }; else { open: false }",
       "1 hour",
       "[ ]"],
      ["2.7",
       "Wire circuit breaker into checkAILimit",
       "src/lib/ai-rate-limit.ts",
       "At the top of checkAILimit(), call checkCircuitBreaker(businessId); if open, return { allowed: false, reason: 'circuit_open', fallback: buildFallback('circuit_open', { ... }) }",
       "45 min",
       "[ ]"],
      ["2.8",
       "Add 'circuit_open' reason to ai-fallback.ts",
       "src/lib/ai-fallback.ts",
       "Add new FallbackReason = 'circuit_open' with English: 'Daily AI usage limit reached. Try again tomorrow or upgrade your plan.' and Bangla equivalent",
       "15 min",
       "[ ]"],
      ["2.9",
       "Test free-tier block manually",
       "Dev server + free-tier business",
       "Hit each AI endpoint with a free-tier business's token; verify 403 response with the upgrade message",
       "30 min",
       "[ ]"],
      ["2.10",
       "Test circuit breaker manually",
       "Dev server + mock AIUsageLog with 450K tokens in 24h",
       "Insert mock AIUsageLog rows totaling 450K tokens for a business; verify next AI call returns circuit_open fallback instead of hitting the LLM",
       "45 min",
       "[ ]"],
      ["2.11",
       "Commit, push, tag release",
       "git commit -m 'feat(ai): P1 free-tier guard + global circuit breaker (Phase 2)'",
       "Tag as v1.2.0-ai-p1",
       "5 min",
       "[ ]"],
    ],
    [6, 28, 24, 30, 8, 10]
  ));

  out.push(h3("Phase 2 Exit Criteria"));
  out.push(bulletItem("All 11 tasks in Table 7.2 are checked off."));
  out.push(bulletItem("Free-tier business cannot call any AI endpoint (verified by manual test 2.9)."));
  out.push(bulletItem("Circuit breaker triggers correctly at 80 percent of monthly token budget in 24 hours (verified by manual test 2.10)."));
  out.push(bulletItem("AIUsageLog entries are being written for both successful and circuit-blocked calls (circuit-blocked calls log feature='circuit-blocked' with tokensUsed=0)."));
  out.push(bulletItem("Super-admin dashboard shows a new row for 'circuit_open' fallback reason in the by-feature breakdown."));

  // ----- PHASE 3 -----
  out.push(h2("Phase 3 \u2014 P2 Optimizations & Polish (Days 31 to 60)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Ship the P2 backlog items that improve margin and fix the AI brand honesty gap. After Phase 3, the Product Assistant has a basic cache layer, the AI Insights system prompt is leaner, and the deterministic 'AI' features (Demand Forecast, Smart Reorder) are correctly branded as 'Smart' in the UI.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Duration: ", { bold: true, size: 22 }),
    tr("30 calendar days. Active development time: 6 hours.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Blocking gate: ", { bold: true, color: P.rose, size: 22 }),
    tr("Do NOT scale beyond 200 pharmacies until Phase 3 is complete.", { size: 22 }),
  ]));

  out.push(h3("Phase 3 Tasks"));

  out.push(tableCaption("Table 7.3 \u2014 Phase 3 Task List (P2 Optimizations)"));
  out.push(makeTable(
    ["#", "Task", "File to Edit", "Change", "Effort", "Done?"],
    [
      ["3.1",
       "Add basic cache to Product Assistant for generate_description and suggest_category",
       "src/app/api/businesses/[id]/ai/product-assistant/route.ts",
       "These two sub-actions are product-specific and deterministic enough to cache. Use the existing ai-cache.ts with key (businessId, 'product-assistant:<action>', productId). TTL 7 days. check_interactions and suggest_dosage remain uncached.",
       "1.5 hours",
       "[ ]"],
      ["3.2",
       "Refactor AI Insights system prompt to be shorter",
       "src/app/api/businesses/[id]/ai/insights/route.ts",
       "Current system prompt is ~600 tokens. Refactor to ~300 tokens by removing redundant instructions and examples. Verify output quality is unchanged on 5 test queries.",
       "1 hour",
       "[ ]"],
      ["3.3",
       "Rename 'AI Demand Forecast' to 'Smart Forecast' in UI",
       "src/modules/pharmacy/components/DemandForecast.tsx + AIHub.tsx",
       "Update all user-facing strings. API route path stays the same (no breaking change).",
       "20 min",
       "[ ]"],
      ["3.4",
       "Rename 'AI Smart Reorder' to 'Smart Reorder' in UI",
       "src/modules/pharmacy/components/ReorderSuggestions.tsx + AIHub.tsx",
       "Update all user-facing strings.",
       "20 min",
       "[ ]"],
      ["3.5",
       "Add AIUsageLog entries for forecast and reorder endpoints",
       "src/app/api/businesses/[id]/ai/forecast/route.ts + ai/reorder/route.ts",
       "Call logAIUsage() with feature='forecast' (or 'reorder'), tokensUsed=0, costEstimate=0, success=true. This makes the super-admin dashboard accurate.",
       "30 min",
       "[ ]"],
      ["3.6",
       "Add client-side 30-second cache to ReorderSuggestions useEffect",
       "src/modules/pharmacy/components/ReorderSuggestions.tsx",
       "Wrap the fetchData function in a simple Date-based cache that skips re-fetching if the last fetch was <30 seconds ago. Reduces DB load on tab switches.",
       "45 min",
       "[ ]"],
      ["3.7",
       "Add Product.maxStock overstock alert to Pharmacy Dashboard",
       "src/modules/pharmacy/components/PharmacyDashboard.tsx + src/app/api/businesses/[id]/dashboard/route.ts",
       "Add a new card 'Overstock Items' that counts products where Inventory.quantity > Product.maxStock. Surface the count and a link to a filtered product list.",
       "1 hour",
       "[ ]"],
      ["3.8",
       "Commit, push, tag release",
       "git commit -m 'feat(ai): P2 optimizations \u2014 cache, prompt refactor, Smart rename, logging (Phase 3)'",
       "Tag as v1.3.0-ai-p2",
       "5 min",
       "[ ]"],
    ],
    [6, 30, 22, 32, 10, 10]
  ));

  out.push(h3("Phase 3 Exit Criteria"));
  out.push(bulletItem("All 8 tasks in Table 7.3 are checked off."));
  out.push(bulletItem("Product Assistant generate_description returns cached response on second call within 7 days (verified by checking AIUsageLog \u2014 second call should log feature='product-assistant:generate_description-cache' with tokensUsed=0)."));
  out.push(bulletItem("AI Insights system prompt is now under 350 tokens (verified by counting characters in the source code)."));
  out.push(bulletItem("UI shows 'Smart Forecast' and 'Smart Reorder' \u2014 no 'AI' prefix on these two features."));
  out.push(bulletItem("Super-admin dashboard now shows forecast and reorder in the by-feature breakdown with non-zero call counts (after at least one user has used them)."));

  // ----- PHASE 4 -----
  out.push(h2("Phase 4 \u2014 Kill-Switch Automation (Days 61 to 90)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Implement and test the four kill-switch criteria from Section 6.2 as automated, platform-wide defenses. After Phase 4, the platform will auto-disable AI features (switch to fallback-only mode) if any of the four thresholds is crossed, and the founder will be notified within 5 minutes.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Duration: ", { bold: true, size: 22 }),
    tr("30 calendar days. Active development time: 3 hours.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Blocking gate: ", { bold: true, color: P.rose, size: 22 }),
    tr("Do NOT scale beyond 1,000 pharmacies until Phase 4 is complete and the kill-switch has been tested with a manual drill.", { size: 22 }),
  ]));

  out.push(h3("Phase 4 Tasks"));

  out.push(tableCaption("Table 7.4 \u2014 Phase 4 Task List (Kill-Switch Automation)"));
  out.push(makeTable(
    ["#", "Task", "File to Edit / Create", "Change", "Effort", "Done?"],
    [
      ["4.1",
       "Add KillSwitch model to Prisma schema",
       "prisma/schema.prisma",
       "New model: KillSwitch { id, trigger (per_pharmacy_monthly / per_pharmacy_24h / platform_monthly / zai_error_rate), thresholdValue, triggeredAt, triggeredBy (businessId or 'platform'), isActive, deactivatedAt, deactivatedBy, notes }. Run prisma migrate.",
       "30 min",
       "[ ]"],
      ["4.2",
       "Create kill-switch checker module",
       "src/lib/ai-kill-switch.ts (NEW FILE)",
       "Export checkKillSwitch(businessId) that: (a) queries monthly AIUsageLog cost for the business, returns open if > 200 BDT; (b) queries 24h tokensUsed, returns open if > 50,000; (c) queries platform-wide monthly cost, returns open if > 100,000 BDT; (d) queries Z.ai error rate in last hour (from AIUsageLog success=false count), returns open if > 10 percent.",
       "1 hour",
       "[ ]"],
      ["4.3",
       "Wire kill-switch into checkAILimit (before circuit breaker)",
       "src/lib/ai-rate-limit.ts",
       "Call checkKillSwitch(businessId) at the very top of checkAILimit(). If open, return { allowed: false, reason: 'kill_switch_open', fallback: buildFallback('kill_switch', { trigger }) }. Do NOT auto-recover for the first three triggers; auto-recover only for zai_error_rate trigger (check every 30 min, recover when error rate drops below 1 percent for 30 min).",
       "45 min",
       "[ ]"],
      ["4.4",
       "Add 'kill_switch' reason to ai-fallback.ts",
       "src/lib/ai-fallback.ts",
       "Add FallbackReason = 'kill_switch' with English: 'AI features are temporarily disabled platform-wide. The founder has been notified. Please try again later.' and Bangla equivalent.",
       "15 min",
       "[ ]"],
      ["4.5",
       "Add founder notification on kill-switch trigger",
       "src/lib/ai-kill-switch.ts + src/lib/cron-jobs.ts",
       "When a kill-switch triggers, write a row to NotificationLog with severity='critical' and send an email to the founder's email (configure FOUNDER_EMAIL env var). For the email, use a simple nodemailer setup or a transactional email service.",
       "45 min",
       "[ ]"],
      ["4.6",
       "Add kill-switch status to super-admin dashboard",
       "src/app/admin/page.tsx + src/app/api/super-admin/ai-usage/route.ts",
       "Show a red banner at the top of the dashboard if any kill-switch is active. Add a 'Reset Kill Switch' button (super-admin only) that sets isActive=false and records deactivatedBy.",
       "30 min",
       "[ ]"],
      ["4.7",
       "Run a kill-switch drill (manual test)",
       "Dev environment + mock data",
       "Insert mock AIUsageLog rows to trigger each of the 4 kill-switches one at a time. Verify: AI endpoints return fallback, founder email is sent (or logged), super-admin dashboard shows the banner, reset button works.",
       "45 min",
       "[ ]"],
      ["4.8",
       "Commit, push, tag release",
       "git commit -m 'feat(ai): automated kill-switch with founder notification (Phase 4)'",
       "Tag as v1.4.0-ai-killswitch",
       "5 min",
       "[ ]"],
    ],
    [6, 28, 22, 32, 8, 10]
  ));

  out.push(h3("Phase 4 Exit Criteria"));
  out.push(bulletItem("All 8 tasks in Table 7.4 are checked off."));
  out.push(bulletItem("Kill-switch drill (task 4.7) passes for all 4 triggers: per-pharmacy monthly, per-pharmacy 24h, platform monthly, Z.ai error rate."));
  out.push(bulletItem("Founder email notification is received within 5 minutes of each trigger (verified in dev)."));
  out.push(bulletItem("Super-admin dashboard shows the red banner and the Reset button works correctly."));
  out.push(bulletItem("Z.ai error rate trigger auto-recovers when error rate drops below 1 percent for 30 minutes (verified by mock test)."));

  // ----- PHASE 5 -----
  out.push(h2("Phase 5 \u2014 Ongoing Operational Monitoring (Continuous)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Establish the weekly and monthly operational rhythm that keeps AI cost healthy as the platform scales. Phase 5 has no end date \u2014 it continues for as long as InventoryOS has paying AI subscribers.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Duration: ", { bold: true, size: 22 }),
    tr("Continuous. Time commitment: 15 minutes per week (founder) + 30 minutes per month (founder + dev).", { size: 22 }),
  ]));

  out.push(h3("Phase 5 Recurring Tasks"));

  out.push(tableCaption("Table 7.5 \u2014 Phase 5 Ongoing Operational Tasks"));
  out.push(makeTable(
    ["Frequency", "Task", "Owner", "What to Look For", "Done?"],
    [
      ["Weekly (Monday)",
       "Review super-admin AI usage dashboard",
       "Founder",
       "Total platform AI cost this week vs. last week. Top 3 spenders. Any business consuming > 20 percent of platform total (potential abuser). Any new 'circuit_open' or 'kill_switch' entries.",
       "[ ]"],
      ["Weekly (Monday)",
       "Check Sentry for AI-related errors",
       "Founder or dev",
       "Filter Sentry by tag feature=ai. Investigate any new errors. If error rate > 5 percent for any AI endpoint, file a bug.",
       "[ ]"],
      ["Monthly (1st)",
       "Compare actual AIUsageLog cost to Section 3 estimates",
       "Founder",
       "Pull total tokens and cost for the previous month per feature. Compare to the estimates in Table 3.1. If actual is more than 2x the estimate for any feature, pause scaling and investigate.",
       "[ ]"],
      ["Monthly (1st)",
       "Review subscription tier mix",
       "Founder",
       "What percent of pharmacies are on Free vs. Pro vs. Pro+AI? If Pro+AI is < 10 percent, the AI cost is being shouldered by too few subscribers \u2014 consider marketing push or pricing adjustment.",
       "[ ]"],
      ["Monthly (1st)",
       "Run the backup DR drill",
       "Dev",
       "Execute scripts/backup/restore-drill.sh. Verify all 21-table row counts match. Investigate any discrepancy.",
       "[ ]"],
      ["Quarterly",
       "Re-evaluate Z.ai pricing",
       "Founder",
       "Confirm Z.ai GLM-4 is still the cheapest viable option. If a competitor (e.g., a new Bangladesh-local LLM provider) becomes cheaper, evaluate migration. Update the 0.03 BDT/1K tokens constant in src/lib/ai-rate-limit.ts if pricing changes.",
       "[ ]"],
      ["Quarterly",
       "Re-run this report's analysis",
       "Founder or dev",
       "Re-read this report. Have any new AI features been added? Have any of the red flags in Section 4 been resolved or new ones introduced? Update Section 7 phases if needed.",
       "[ ]"],
      ["On-incident",
       "Kill-switch triggered notification",
       "Founder",
       "When a kill-switch email arrives: log into /admin, review the trigger, decide whether to reset the switch or leave it active. Document the decision in the worklog.",
       "[ ]"],
    ],
    [16, 26, 14, 34, 10]
  ));

  out.push(h3("Phase 5 Exit Criteria"));
  out.push(bodyPara(
    "Phase 5 has no exit criteria \u2014 it is the steady-state operational rhythm. The phase is considered 'healthy' when: (a) the weekly dashboard review takes less than 15 minutes, (b) no kill-switch has triggered in the past 30 days, (c) actual AI cost is within 2x of the Section 3 estimates, and (d) the Pro+AI subscriber count is growing month-over-month. If any of these conditions fails for two consecutive months, treat it as a signal to re-evaluate pricing, rate limits, or feature mix."
  ));

  // ----- ROADMAP SUMMARY -----
  out.push(h2("7.6 Roadmap Summary"));

  out.push(bodyPara(
    "The table below summarizes all five phases on a single row each, so the founder can see the entire plan at a glance. Print this table and pin it above the desk \u2014 it is the single source of truth for what to ship, when, and why."
  ));

  out.push(tableCaption("Table 7.6 \u2014 Complete Phased Roadmap Summary"));
  out.push(makeTable(
    ["Phase", "Goal", "Duration", "Effort", "Gate", "Status"],
    [
      ["Phase 1: P0 Fixes",
       "Cap max_tokens, cap expiry-opt rows, validate products array",
       "7 days",
       "35 min code + 1 hr review",
       "Before next paying customer",
       "Not started"],
      ["Phase 2: P1 Defenses",
       "Free-tier guard + global circuit breaker",
       "30 days",
       "4 hours code",
       "Before 50 pharmacies",
       "Not started"],
      ["Phase 3: P2 Polish",
       "Product-asst cache, insights prompt, Smart rename, logging, overstock alert",
       "60 days",
       "6 hours code",
       "Before 200 pharmacies",
       "Not started"],
      ["Phase 4: Kill-Switch",
       "Automated 4-trigger kill-switch with founder email + super-admin controls",
       "90 days",
       "3 hours code",
       "Before 1,000 pharmacies",
       "Not started"],
      ["Phase 5: Operations",
       "Weekly dashboard review, monthly cost comparison, quarterly Z.ai re-evaluation",
       "Continuous",
       "15 min/week + 30 min/month",
       "Ongoing forever",
       "Not started"],
    ],
    [16, 30, 12, 14, 18, 10]
  ));

  out.push(h2("7.7 How to Use This Plan"));

  out.push(bodyPara(
    "Start with Phase 1 today. The three P0 fixes are 35 minutes of code and eliminate the worst-case cost scenarios. Do not be tempted to skip ahead to Phase 2 or Phase 4 \u2014 the phases are sequenced so that each one builds on the previous. Phase 2's circuit breaker depends on Phase 1's max_tokens cap being in place (otherwise the circuit breaker would trigger constantly on uncapped output). Phase 4's kill-switch depends on Phase 2's circuit breaker and AIUsageLog logging being reliable."
  ));

  out.push(bodyPara(
    "After completing each phase, update the Status column in Table 7.6 from 'Not started' to 'In progress' to 'Complete', and add the completion date. This creates a paper trail that the founder can show to investors, auditors, or prospective enterprise customers as evidence of disciplined cost management. The plan is intentionally conservative \u2014 it is better to ship a phase late than to ship it incomplete and discover a cost leak at scale."
  ));

  out.push(calloutPara(
    "Print Table 7.6 and pin it above your desk. Update the Status column after each phase. The plan is your contract with yourself \u2014 do not scale the platform past any phase's gate until that phase is complete.",
    P.aiAccent
  ));

  return out;
}

module.exports = {
  buildMitigationPlan,
  buildFinalVerdict,
  buildPhasedPlan,
};
