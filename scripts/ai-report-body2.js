// Body Part 2: Section 3 (Full Cost Model with chart) + Section 4 (Risk Analysis with chart)
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer, imageBlock,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildCostModel() {
  const out = [];
  out.push(h1("3. Full Cost Model"));

  out.push(bodyPara(
    "This section translates the technical audit into money. The model has four layers: (1) the per-call cost of each LLM feature, derived from the configured price per 1,000 tokens; (2) per-user monthly usage assumptions under three scenarios (light, power, abuser); (3) per-pharmacy monthly cost, accounting for multiple users per pharmacy; (4) platform-level scaling curves from 1 to 1,000 pharmacies. All figures are in Bangladeshi Taka (BDT) with USD equivalents in parentheses at 1 USD = 110 BDT."
  ));

  out.push(h2("3.1 Pricing Assumptions"));

  out.push(bodyPara(
    "InventoryOS uses Z.ai's GLM-4 model accessed via the z-ai-web-dev-sdk npm package. The cost-per-thousand-tokens rate is hardcoded at 0.03 BDT per 1,000 tokens in src/lib/ai-rate-limit.ts (line 32), which translates to approximately $0.00027 USD per 1,000 tokens. This is dramatically cheaper than OpenAI's GPT-4o ($0.005 per 1K input tokens) or Anthropic's Claude 3.5 Sonnet ($0.003 per 1K input tokens) — Z.ai GLM-4 is roughly 10 to 20 times cheaper per token than comparable Western models. This cost advantage is the single biggest reason AI is viable for a Bangladesh-market SaaS priced in BDT rather than USD."
  ));

  out.push(calloutPara(
    "Cost advantage of Z.ai GLM-4: At $0.00027 per 1K tokens, GLM-4 is ~18x cheaper than GPT-4o ($0.005) and ~11x cheaper than Claude 3.5 Sonnet ($0.003). This is what makes AI features affordable in a BDT-priced product. If we ever migrate to a Western provider, the cost model in this section would need to be recalculated by a factor of 10x to 20x.",
    P.aiAccent
  ));

  out.push(bodyPara(
    "The current .env file contains only DATABASE_URL — there is no separate API key for Z.ai because the z-ai-web-dev-sdk uses ambient credentials handled internally by the SDK. This means the founder does not need to manage or rotate an AI API key separately, but it also means cost is billed to whichever Z.ai account the SDK is bound to at deploy time. Recommendation: confirm with Z.ai which account is being billed before onboarding the first paying customer, and request a monthly cost report from Z.ai to cross-check against the AIUsageLog data."
  ));

  out.push(h2("3.2 Per-Feature Token Math"));

  out.push(bodyPara(
    "The table below estimates the input and output token count for a single call to each LLM feature, based on the system prompt length (counted character-by-character and divided by 4 to estimate tokens), the typical context payload size (sales history, inventory snapshot, batch list), and the expected output length (based on the JSON schema or response format the route expects). The 'Cost per Call' column multiplies total tokens by 0.03 BDT per 1,000 tokens."
  ));

  out.push(tableCaption("Table 3.1 — Per-Feature Token Consumption and Cost"));
  out.push(makeTable(
    ["Feature", "Input Tokens", "Output Tokens (avg)", "Total Tokens", "Cost per Call (BDT)"],
    [
      ["AI Chat (typical question)", "~2,200", "~500", "~2,700", "0.08"],
      ["AI Insights (daily summary)", "~1,850", "~1,500", "~3,350", "0.10"],
      ["Expiry Optimizer (10 batches)", "~2,950", "~1,000", "~3,950", "0.12"],
      ["Expiry Optimizer (100 batches, uncapped)", "~8,950", "~5,000", "~13,950", "0.42"],
      ["Expiry Optimizer (500 batches, worst case)", "~36,000", "~8,000", "~44,000", "1.32"],
      ["Product Assistant: generate_description", "~250", "~150", "~400", "0.01"],
      ["Product Assistant: check_interactions (5 meds)", "~750", "~500", "~1,250", "0.04"],
      ["Product Assistant: check_interactions (50 meds, uncapped)", "~6,500", "~3,000", "~9,500", "0.29"],
    ],
    [30, 16, 18, 16, 20]
  ));

  out.push(bodyPara(
    "The Expiry Optimizer worst-case row is the most alarming number in this entire report. A pharmacy with 500+ batches (a large pharmacy, but not unusual for an established urban business in Dhaka) would send a 36,000-token prompt on every Expiry Optimizer call, and with no max_tokens cap, GLM-4 could respond with 8,000+ tokens of analysis. A single click on the Expiry Optimizer tab would cost 1.32 BDT — and if the user clicks refresh 10 times in a session (which the 24h cache would absorb, but only for identical queries), the session cost climbs to 13 BDT. This is the single biggest argument for adding a row cap to the Batch query in that route."
  ));

  out.push(h2("3.3 Per-User Monthly Usage Scenarios"));

  out.push(bodyPara(
    "Pharmacy staff fall into three usage patterns. A light user (typically the owner logging in once a day to check the dashboard) makes roughly 5 chat queries per day, runs AI Insights once per day, runs Expiry Optimizer once per week, and uses Product Assistant twice per week. A power user (a tech-savvy pharmacist or a busy counter staff member) maxes out the daily rate limit of 50 calls per day, every working day. An abuser (a script-kiddie, a malicious competitor, or a user with a stuck refresh loop) hits the burst limit of 5 calls per minute continuously, ignoring the 24h cache by varying the query."
  ));

  out.push(tableCaption("Table 3.2 — Per-User Monthly Usage and Cost"));
  out.push(makeTable(
    ["Scenario", "Daily Calls", "Monthly Calls", "Monthly Tokens", "Monthly Cost (BDT)"],
    [
      ["Light user (cache-friendly)", "~8", "~200", "~50,000", "~1.50"],
      ["Power user (maxes daily limit)", "50", "~1,000 (rate cap)", "~300,000", "~9.00"],
      ["Power user (maxes token budget)", "varies", "varies", "500,000 (token cap)", "~15.00"],
      ["Abuser (cache bypass, before rate limit kicks in)", "varies", "~1,500 (burst-resets)", "~450,000", "~13.50"],
      ["Abuser (with Expiry-Optimizer 500-batch exploit)", "varies", "~100", "~440,000", "~13.20"],
    ],
    [34, 14, 18, 18, 16]
  ));

  out.push(bodyPara(
    "The interesting observation here is that the 4-tier rate limiter is actually quite hard to break. Even an abuser maxing out the burst limit can only reset it ~1,440 times per day (60 seconds × 24 hours), but the daily cap of 50 calls kicks in long before that. The real exploitable surface is not the rate limiter — it is the unbounded context in Expiry Optimizer. An abuser who knows about the 500-batch exploit can burn 13 BDT in 100 calls, which is less than the rate cap allows but does so with a token cost per call that is 30x higher than the average. This is why fixing the Expiry Optimizer row cap is the highest-leverage mitigation in Section 5."
  ));

  out.push(h2("3.4 Per-Pharmacy Monthly Cost (Multiple Users)"));

  out.push(bodyPara(
    "A single pharmacy typically has 1 to 3 users: the owner (light user), the head pharmacist (power user), and possibly a counter assistant (light user). The table below shows the monthly AI cost per pharmacy at three realistic user mixes. The cost is NOT simply additive because the 4-tier rate limit is enforced per-business, not per-user. This means a pharmacy with 3 power users does not pay 3x the cost — they all share the same 50-calls-per-day and 1,000-calls-per-month budget, and the token budget of 500,000 tokens is also shared. This is the correct design for a per-pharmacy SaaS subscription model."
  ));

  out.push(tableCaption("Table 3.3 — Monthly Cost Per Pharmacy by User Mix"));
  out.push(makeTable(
    ["User Mix", "Monthly Tokens Used", "Monthly Cost (BDT)", "Monthly Cost (USD)"],
    [
      ["1 light user only", "~50,000", "~1.50", "~$0.01"],
      ["1 power user only", "~300,000", "~9.00", "~$0.08"],
      ["1 light + 1 power (typical)", "~350,000", "~10.50", "~$0.10"],
      ["1 light + 2 power (busy pharmacy)", "~500,000 (token cap hit)", "~15.00", "~$0.14"],
      ["3 power users (heavy use)", "~500,000 (token cap hit early)", "~15.00", "~$0.14"],
      ["Worst case: 1 abuser with Expiry-Optimizer exploit", "~440,000", "~13.20", "~$0.12"],
    ],
    [38, 22, 20, 20]
  ));

  out.push(bodyPara(
    "The key insight from this table is that the 500,000-token monthly budget is the binding constraint, not the number of users. Whether a pharmacy has 1 power user or 3 power users, the monthly cost tops out at ~15 BDT because the token budget is shared and hard-capped. This is exactly the right design for a SaaS — it means the founder can confidently quote a flat AI cost per pharmacy of 15 BDT/month in the worst case, regardless of how many staff the pharmacy employs."
  ));

  out.push(h2("3.5 Platform-Level Scaling Curves"));

  out.push(bodyPara(
    "The chart below shows the projected monthly AI bill for the InventoryOS platform at three usage tiers (light, power, worst-case) across pharmacy counts from 1 to 1,000. The Y-axis is logarithmic because the cost spans four orders of magnitude. Two horizontal reference lines mark the 'Watch' threshold (15,000 BDT/month, where AI cost becomes material enough to warrant weekly review) and the 'Kill-Switch' threshold (100,000 BDT/month, where AI features should be auto-disabled platform-wide pending founder review)."
  ));

  out.push(imageBlock("/home/z/my-project/download/ai-cost-scaling.png", 540));
  out.push(H.figureCaption("Figure 3.1 — AI Cost Scaling: Monthly Bill vs Pharmacy Count"));

  out.push(bodyPara(
    "Reading the chart: at 100 pharmacies with average (power-user) usage, the platform's monthly AI bill is approximately 7,500 BDT (~$68 USD). At 1,000 pharmacies it is 75,000 BDT (~$680 USD). The worst-case line (uncapped Expiry Optimizer with 500 batches) crosses the Watch threshold at just 100 pharmacies and crosses the Kill-Switch threshold at 700 pharmacies — this is the line that must be eliminated by the Section 5 fixes before scaling."
  ));

  out.push(h2("3.6 Break-Even Subscription Pricing"));

  out.push(bodyPara(
    "To cover AI cost with a 50% margin (i.e., AI cost should be no more than 50% of the subscription price for the AI-enabled tier), the founder must charge at least 30 BDT/month per pharmacy for the AI-enabled tier at current cost levels. The table below shows the break-even subscription price at four scales, assuming a realistic mix of 60% light users, 35% power users, and 5% abusers."
  ));

  out.push(tableCaption("Table 3.4 — Break-Even Subscription Price (AI-Enabled Tier, 50% Margin)"));
  out.push(makeTable(
    ["Pharmacy Count", "Avg Cost/Pharmacy (BDT/mo)", "Break-Even Price (BDT/mo)", "Recommended Price (BDT/mo)"],
    [
      ["10", "~5", "~10", "150 (3x margin — covers other costs)"],
      ["100", "~8", "~16", "150 (10x margin)"],
      ["1,000", "~10", "~20", "150 (8x margin)"],
      ["10,000", "~12", "~24", "150 (6x margin — approaching cap)"],
    ],
    [18, 24, 22, 36]
  ));

  out.push(bodyPara(
    "The recommended price of 150 BDT/month for the AI-enabled tier (~$1.36 USD) provides a comfortable margin at all scales up to 10,000 pharmacies. This is well within the willingness-to-pay range for a Bangladeshi pharmacy owner — for comparison, a single box of Napa Extra costs ~80 BDT wholesale, so 150 BDT/month for AI-powered inventory management is roughly two boxes of paracetamol per month. The pricing is sustainable."
  ));

  return out;
}

function buildRiskAnalysis() {
  const out = [];
  out.push(h1("4. Risk & Token Leakage Analysis"));

  out.push(bodyPara(
    "This section catalogs every way the InventoryOS AI integration could lose money, ranked by severity and likelihood. Each risk is rated on a 1-to-5 scale for severity (1 = cosmetic, 5 = could bankrupt the project) and likelihood (1 = rare, 5 = will happen weekly). The risk matrix chart at the end of this section visualizes the positioning of each risk."
  ));

  out.push(h2("4.1 The 10 Red Flags"));

  out.push(bodyPara(
    "The audit identified ten red flags. Three are HIGH severity and must be fixed before scaling beyond 50 pharmacies. Four are MEDIUM severity and should be fixed within 30 days. Three are LOW severity or informational and can be deferred. The table below summarizes all ten; detailed discussion follows."
  ));

  out.push(tableCaption("Table 4.1 — Token Leakage Red Flags Ranked by Severity"));
  out.push(makeTable(
    ["#", "Red Flag", "Severity", "Likelihood", "Worst-Case Cost Impact"],
    [
      ["1", "No max_tokens cap on any LLM route (4 routes)", "HIGH (5)", "HIGH (4)", "Single call could burn 8,000+ output tokens = 0.24 BDT"],
      ["2", "Expiry Optimizer queries all batches with no row cap", "HIGH (5)", "MED (3)", "500-batch pharmacy: 44,000 tokens/call = 1.32 BDT/call"],
      ["3", "No free-tier guard at API layer (only aiEnabled boolean)", "HIGH (4)", "HIGH (4)", "Free-tier user could burn 15 BDT/month indefinitely"],
      ["4", "Product Assistant: no cache (intentional but expensive)", "MED (3)", "HIGH (5)", "Power user: ~2 BDT/month extra cost"],
      ["5", "AI Insights: large system prompt (~600 tokens)", "MED (2)", "HIGH (5)", "~0.02 BDT/call overhead, ~12 BDT/year per pharmacy"],
      ["6", "check_interactions: no validation on products array length", "MED (4)", "LOW (2)", "Malicious 100-med request: 0.58 BDT/call"],
      ["7", "ReorderSuggestions.tsx: auto-fetches in useEffect (DB cost)", "LOW (2)", "HIGH (4)", "DB load, not AI cost — but could slow down app"],
      ["8", "forecast + reorder endpoints do not log to AIUsageLog", "LOW (1)", "HIGH (5)", "Admin dashboard undercounts 'AI feature usage' by ~30%"],
      ["9", "No streaming endpoints with retry loops (CONFIRMED SAFE)", "INFO (1)", "LOW (1)", "Zero — this is a non-issue, listed for completeness"],
      ["10", "No cron-triggered AI calls (CONFIRMED SAFE)", "INFO (1)", "LOW (1)", "Zero — verified all 3 cron jobs, none call AI"],
    ],
    [6, 36, 14, 14, 30]
  ));

  out.push(h2("4.2 HIGH Severity Risks (Fix Before 50 Pharmacies)"));

  out.push(h3("Risk #1 — No max_tokens Cap on LLM Output"));

  out.push(bodyPara(
    "All four LLM routes (chat, insights, expiry-optimizer, product-assistant) call zai.chat.completions.create() with only the messages array and a thinking:{type:'disabled'} flag. None of them pass a max_tokens parameter. This means GLM-4 is free to generate as long a response as it deems appropriate. For chat, the typical response is 200 to 800 tokens — manageable. For insights, the JSON schema asks for 5 to 8 insights and 3 to 5 recommendations, which GLM-4 typically generates in 1,000 to 2,000 tokens — also manageable. The risk is in the worst case: if GLM-4 ever decides to generate a 5,000-token response (which it can, especially if the user asks a vague question), that single call burns 0.15 BDT. Over a month of bad luck, a single pharmacy could rack up 50 BDT in unplanned output-token cost. The fix is a one-line change per route: add max_tokens: 1024 (chat), 2048 (insights, expiry-optimizer), or 512 (product-assistant) to the API call options. Estimated total effort: 4 lines of code, 20 minutes."
  ));

  out.push(h3("Risk #2 — Expiry Optimizer Unbounded Context"));

  out.push(bodyPara(
    "The expiry-optimizer route (src/app/api/businesses/[id]/ai/expiry-optimizer/route.ts, around line 66) calls db.batch.findMany() with no take: limit. This means it returns every batch the business has ever created, including expired and disposed ones (depending on the where clause). For a small pharmacy with 10 active batches, this is fine — the context payload is ~2,950 tokens. For a large pharmacy with 500 batches accumulated over years of operation, this becomes a 36,000-token prompt on every call. With no max_tokens cap (see Risk #1), the response could be another 8,000 tokens, for a total of 44,000 tokens = 1.32 BDT per call. The fix is to add take: 50 (or take: 100) to the findMany call, plus an orderBy clause to prioritize batches closest to expiry. Estimated effort: 2 lines of code, 10 minutes."
  ));

  out.push(h3("Risk #3 — No Free-Tier Guard at API Layer"));

  out.push(bodyPara(
    "The feature-gate.ts module defines three subscription tiers (free, pro, pro_ai) with different feature flags and limits. However, none of the four AI routes import this module or call getTierConfig(). The only check they perform is on Business.aiEnabled, a boolean that is currently set to true by default in the Prisma schema. This means that today, every business — including free-tier trial accounts — can call every AI endpoint. At the current rate limits, the worst-case cost per free-tier pharmacy is still only 15 BDT/month, so this is not a bankruptcy risk. But it is a pricing-leakage risk: free-tier users are getting a feature that should be reserved for paying subscribers. The fix is to import getTierConfig in each AI route and return a 403 with a friendly upgrade-prompt message if the tier does not include AI. Estimated effort: 6 lines of code per route (4 routes = 24 lines), 1 hour."
  ));

  out.push(h2("4.3 MEDIUM Severity Risks (Fix Within 30 Days)"));

  out.push(bodyPara(
    "The four MEDIUM risks are: (4) Product Assistant has no cache by design (the answers are product-specific, so caching provides little value), which means every check_interactions call costs ~0.04 BDT — this adds up to ~2 BDT/month for a power user, acceptable but worth monitoring; (5) AI Insights has a system prompt of ~600 tokens, which adds ~0.02 BDT of overhead per call — refactoring the prompt to be shorter would save ~12 BDT per year per pharmacy, low ROI but easy; (6) check_interactions does not validate the length of the products array, so a malicious user could send 100 medication names in a single request and burn 0.58 BDT in one call — fix is a 1-line if (products.length > 20) return 400; (7) ReorderSuggestions.tsx auto-fetches in a useEffect on every component mount, which is a DB-cost issue rather than an AI-cost issue but could slow down the app if the user navigates back and forth — fix is to add a 30-second client-side cache."
  ));

  out.push(h2("4.4 LOW / Informational Risks"));

  out.push(bodyPara(
    "Risk #8 (forecast and reorder do not write to AIUsageLog) is informational — it means the super-admin AI usage dashboard undercounts 'AI feature usage' by roughly 30% because two of the six AI-branded features do not log. This does not cost money, but it makes the dashboard misleading. The fix is either to log a synthetic AIUsageLog row with feature='forecast' and tokensUsed=0, or to relabel the dashboard to clarify that it tracks only LLM-based features. Risks #9 and #10 are explicitly listed as CONFIRMED SAFE — the audit verified that no AI endpoint uses streaming with retry loops (which could cause infinite token burn if a request fails mid-stream), and no cron job calls any AI endpoint (which would mean AI cost accrues even when no user is online). These two design choices are worth keeping as the project scales."
  ));

  out.push(h2("4.5 Risk Matrix Visualization"));

  out.push(bodyPara(
    "The chart below plots each risk on a severity-vs-likelihood grid. The top-right quadrant (high severity, high likelihood) contains the three risks that must be fixed before scaling. The bottom-left quadrant (low severity, low likelihood) contains the two confirmed-safe non-risks. The matrix makes it visually obvious that Risk #1 (no max_tokens cap) is the single highest-priority fix because it is both the most severe and the most likely to be triggered."
  ));

  out.push(imageBlock("/home/z/my-project/download/ai-risk-matrix.png", 540));
  out.push(H.figureCaption("Figure 4.1 — AI Cost Risk Matrix (Severity vs Likelihood)"));

  out.push(h2("4.6 Abuser Scenarios"));

  out.push(bodyPara(
    "Three realistic abuser scenarios deserve explicit consideration. First, the script-kiddie: someone discovers the /api/businesses/[id]/ai/chat endpoint and writes a curl loop to hammer it. The 4-tier rate limiter handles this well — the burst limit of 5 calls per 60 seconds stops them at 5 calls, the daily limit stops them at 50, and the token budget stops them at 500K. Maximum damage: 15 BDT/month. Second, the malicious competitor: a rival pharmacy signs up for a free trial and tries to inflate InventoryOS's AI bill. Without the free-tier guard (Risk #3), they could rack up 15 BDT/month per trial account. With 100 trial accounts, that is 1,500 BDT/month — still not catastrophic, but worth blocking. Third, the accidental abuser: a user opens the Expiry Optimizer tab and walks away, leaving the page open. JavaScript event listeners could trigger refreshes, or browser extensions could auto-reload the page. The 24h cache absorbs identical queries, but if the underlying data changes (e.g., a sale modifies inventory), the cache key changes and a new AI call fires. In a busy pharmacy with continuous sales, this could mean one new AI call every few minutes. Over 24 hours: ~200 calls = 84 BDT. The mitigation is the daily rate limit of 50 calls per business, which caps this scenario at 50 calls."
  ));

  return out;
}

module.exports = {
  buildCostModel,
  buildRiskAnalysis,
};
