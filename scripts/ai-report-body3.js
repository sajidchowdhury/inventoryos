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

module.exports = {
  buildMitigationPlan,
  buildFinalVerdict,
};
