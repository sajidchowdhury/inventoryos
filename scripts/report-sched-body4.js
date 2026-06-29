// Body Part 4: Cost Analysis + Phased Roadmap + Risks + Appendix
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildCostAnalysis() {
  const out = [];
  out.push(h1("12. Cost Analysis & Pricing"));

  out.push(bodyPara(
    "This section quantifies the AI cost of the report scheduling feature and recommends a pricing strategy. The good news: the feature is remarkably cheap to run because the AI call is small (the heavy lifting is done in code, not by the LLM). The feature is bundled into the Pro+AI tier at no extra cost because it is a retention play, not a revenue play."
  ));

  out.push(h2("12.1 Per-Report AI Cost"));

  out.push(bodyPara(
    "Each report requires one AI call. The input is approximately 3,500 tokens: the system prompt (~400 tokens), the business context (~200 tokens), the 1-year sales summary for top 50 products (~1,800 tokens), the upcoming occasions list (~200 tokens), and the current stock levels for top 50 products (~900 tokens). The output is approximately 2,500 tokens: the executive summary (~150 tokens), 3 spike predictions (~300 tokens), 20 top items with recommendations (~1,500 tokens), and stock risks (~550 tokens). Total: approximately 6,000 tokens per report."
  ));

  out.push(bodyPara(
    "At the Z.ai GLM-4 rate of 0.03 BDT per 1,000 tokens (configured in src/lib/ai-rate-limit.ts), the cost per report is 6,000 / 1,000 * 0.03 = 0.18 BDT. This is the AI cost only \u2014 it does not include the database query cost (negligible) or the email/WhatsApp delivery cost (separate, see Section 11)."
  ));

  out.push(h2("12.2 Platform Cost at Scale"));

  out.push(tableCaption("Table 12.1 \u2014 Monthly AI Cost by Client Count (Weekly Reports)"));
  out.push(makeTable(
    ["Clients", "Reports/Week", "Reports/Month", "Tokens/Month", "AI Cost (BDT)", "AI Cost (USD)"],
    [
      ["10", "10", "43", "258,000", "7.74", "$0.07"],
      ["50", "50", "215", "1,290,000", "38.70", "$0.35"],
      ["100", "100", "430", "2,580,000", "77.40", "$0.70"],
      ["500", "500", "2,150", "12,900,000", "387.00", "$3.52"],
      ["1,000", "1,000", "4,300", "25,800,000", "774.00", "$7.04"],
      ["5,000", "5,000", "21,500", "129,000,000", "3,870.00", "$35.18"],
      ["10,000", "10,000", "43,000", "258,000,000", "7,740.00", "$70.36"],
    ],
    [12, 14, 14, 18, 18, 14]
  ));

  out.push(bodyPara(
    "Reading the table: at 100 clients receiving weekly reports, the platform AI cost is 77 BDT per month (about $0.70 USD). At 1,000 clients it is 774 BDT ($7 USD). At 10,000 clients it is 7,740 BDT ($70 USD). These numbers are well within the existing kill-switch threshold of 100,000 BDT/month platform-wide. The feature does not require any adjustment to the kill-switch thresholds \u2014 even at 10,000 clients, the cost is 7.7 percent of the threshold."
  ));

  out.push(h2("12.3 Pricing Recommendation"));

  out.push(bodyPara(
    "Bundle the weekly report into the Pro+AI tier (199 BDT/month) at no extra cost. The report is a retention feature \u2014 its job is to keep clients subscribed, not to generate direct revenue. At 100 Pro+AI clients, the report costs 77 BDT/month (0.77 BDT per client), and the subscription revenue is 19,900 BDT/month. The report cost is 0.4 percent of subscription revenue \u2014 negligible. For the Enterprise tier (future, custom pricing), charge 500 BDT/month extra for daily reports (instead of weekly) plus WhatsApp delivery. Daily reports cost 7x more (4.3 reports/week vs 0.6 reports/week), so the per-client cost rises to ~5.4 BDT/month \u2014 still a 92x margin at 500 BDT pricing."
  ));

  out.push(h2("12.4 Integration with Phase 1-5 Defenses"));

  out.push(bodyPara(
    "The report generation AI calls are subject to all existing defenses. The max_tokens cap (Phase 1) limits the AI response \u2014 the report-generator-worker uses a configurable max_tokens (default 2048, editable from /admin). The circuit breaker (Phase 2) prevents a single business from burning too many tokens in 24 hours \u2014 a single weekly report is 6,000 tokens, well under the 400,000-token circuit breaker threshold. The kill-switch (Phase 4) blocks all AI calls if platform-wide cost exceeds the threshold. The 500K monthly token budget per business covers approximately 80 reports per month \u2014 more than enough for weekly (4-5/month). If a business somehow exceeds the token budget (e.g., the founder sets up daily reports), the report generation falls back to deterministic mode (raw numbers without AI synthesis) so the client still receives a report."
  ));

  return out;
}

function buildRoadmap() {
  const out = [];
  out.push(h1("13. Phased Implementation Roadmap"));

  out.push(bodyPara(
    "Five implementation phases over 8 weeks, totaling 38 hours of developer effort. The phases are sequenced so that each one delivers a usable increment \u2014 after Phase B, the founder can manually trigger reports. After Phase D, email delivery is fully automated. After Phase E, WhatsApp delivery is fully automated. Each phase has a clear gate: do not start the next phase until the current one's exit criteria are met."
  ));

  out.push(h2("13.1 Phase A \u2014 Data Model & Occasion Calendar (Week 1-2, 8 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Add the 5 Prisma models, migrate, seed the Bangladesh holiday calendar, and build the basic occasion CRUD API.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Add ReportSchedule, ReportOccasion, HolidayCalendar, GeneratedReport, ReportDelivery to schema.prisma. (2) Run prisma db push + generate. (3) Create scripts/seed-holiday-calendar.js to pre-populate 2026-2027 Bangladesh holidays. (4) Build GET/POST/PUT/DELETE /api/super-admin/occasions. (5) Build GET/POST /api/super-admin/holiday-calendar. (6) Add 'ownerEmail' field to Business model (for email delivery).", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Exit criteria: ", { bold: true, color: P.amber, size: 22 }),
    tr("All 5 models created and migrated. HolidayCalendar seeded with 14+ occasions for 2026-2027. Occasion CRUD API returns correct responses. Postman/curl tests pass for all endpoints.", { size: 22 }),
  ]));

  out.push(h2("13.2 Phase B \u2014 AI Prediction & Report Generation (Week 3-4, 12 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Build the prediction algorithm (Section 6) and the report generator. After this phase, the founder can manually trigger a report for any business and view it in /admin.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Create src/lib/report-predictor.ts with the 5-step algorithm (base demand, occasion overlay, combination handling, stock gap analysis, structured output). (2) Create src/lib/report-generator.ts that calls the predictor, then calls GLM-4 with the system prompt, parses the JSON response, and saves to GeneratedReport. (3) Build POST /api/super-admin/report-schedules/[id]/trigger (manual trigger). (4) Build GET /api/super-admin/generated-reports and GET /api/super-admin/generated-reports/[id]. (5) Build the Generated Reports Viewer UI (Section 9.4). (6) Test with the demo pharmacy \u2014 trigger a report, verify the 4 sections are populated correctly.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Exit criteria: ", { bold: true, color: P.amber, size: 22 }),
    tr("Manual trigger creates a GeneratedReport with all 4 sections populated. Report viewer UI displays the report correctly. AI cost is logged. Prediction confidence is 'medium' or 'high' for the demo pharmacy (which has >1 year of data).", { size: 22 }),
  ]));

  out.push(h2("13.3 Phase C \u2014 Schedule Builder & Checker (Week 5, 6 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Build the schedule builder UI and the schedule checker cron job. After this phase, the founder can create schedules and the system automatically creates pending reports on schedule.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Build the Schedule List UI (Section 9.1). (2) Build the Schedule Builder Form UI (Section 9.2). (3) Build schedule CRUD API (Section 8.1). (4) Create src/lib/schedule-compute.ts with nextRunAt computation logic. (5) Add report-schedule-checker cron job to cron-jobs.ts. (6) Create POST /api/cron/report-schedule-checker endpoint. (7) Add the job to the Background Jobs card in /admin.", { size: 22 }),
  ]));

  out.push(h2("13.4 Phase D \u2014 Email Delivery & Worker (Week 6, 4 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Build the report-generator-worker and report-delivery-worker cron jobs, plus email delivery with PDF attachment. After this phase, the full email pipeline is automated.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Add report-generator-worker cron job (picks up pending reports, calls report-generator.ts). (2) Add report-delivery-worker cron job (picks up queued deliveries, sends via email). (3) Create src/lib/report-pdf.ts that generates a PDF version of the report using the existing PDF skill. (4) Wire email delivery to use the PDF as an attachment. (5) Build retry logic (3 attempts, exponential backoff). (6) Build POST /api/super-admin/report-deliveries/[id]/resend endpoint. (7) Test end-to-end: create schedule, wait for checker, wait for generator, wait for delivery, verify email arrives with PDF.", { size: 22 }),
  ]));

  out.push(h2("13.5 Phase E \u2014 WhatsApp Business API (Week 7-8, 8 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Integrate the WhatsApp Business Cloud API for WhatsApp delivery. This is the final phase because it requires Meta account setup and template approval (3-5 business days).", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Founder creates Meta Business account + WhatsApp Business number (offline, 1-2 days). (2) Founder submits message template for Meta review (offline, 3-5 days). (3) While waiting: build src/lib/whatsapp.ts module. (4) Add WHATSAPP_TOKEN + WHATSAPP_PHONE_ID env var support. (5) Wire WhatsApp delivery into report-delivery-worker. (6) Add WhatsApp phone number field to Business model (or use existing phone field). (7) Test with sandbox number, then production. (8) Update SuperAdminHelp with WhatsApp setup instructions.", { size: 22 }),
  ]));

  out.push(h2("13.6 Roadmap Summary"));

  out.push(tableCaption("Table 13.1 \u2014 Implementation Roadmap Summary"));
  out.push(makeTable(
    ["Phase", "Goal", "Weeks", "Effort", "Gate"],
    [
      ["Phase A", "Data model + occasion calendar seed", "1-2", "8 hours", "Models migrated, holidays seeded, occasion CRUD works"],
      ["Phase B", "AI prediction + report generation", "3-4", "12 hours", "Manual trigger creates complete report with 4 sections"],
      ["Phase C", "Schedule builder + checker cron", "5", "6 hours", "Founder can create schedules, checker auto-creates pending reports"],
      ["Phase D", "Email delivery + workers", "6", "4 hours", "Full email pipeline automated end-to-end"],
      ["Phase E", "WhatsApp Business API", "7-8", "8 hours", "WhatsApp delivery working in production"],
    ],
    [10, 30, 10, 12, 38]
  ));

  out.push(bodyPara(
    "Total: 38 hours over 8 weeks. The phases can be compressed if the founder works full-time on this feature (Phase A-C in week 1, Phase D in week 2, Phase E depends on Meta approval timeline). The most common bottleneck is Phase E \u2014 Meta template approval takes 3-5 business days and cannot be expedited. Start the Meta account setup on Day 1 so it runs in parallel with Phases A-D."
  ));

  return out;
}

function buildRisks() {
  const out = [];
  out.push(h1("14. Risks & Mitigation"));

  out.push(bodyPara(
    "Six risks deserve explicit attention. Each is rated by severity (1-5) and likelihood (1-5), with a concrete mitigation strategy. The risks are ordered by combined severity \u00d7 likelihood."
  ));

  out.push(h2("14.1 Risk 1: AI Hallucination on Predictions (Severity 4, Likelihood 3)"));

  out.push(bodyPara(
    "The AI might invent spike numbers or recommend wrong quantities. This is the most dangerous risk \u2014 a wrong purchase recommendation could cost the pharmacy owner real money and destroy trust in the platform. Mitigation: the AI does NOT do the math. All numbers (predicted quantities, spike percentages, stock gaps, purchase recommendations) are computed in code by the report-predictor.ts module. The AI only rephrases the pre-computed numbers into natural language. The AI is explicitly instructed in the system prompt: 'DO NOT calculate any numbers \u2014 all numbers are already computed.' If the AI returns a number that does not match the pre-computed value, the system overrides it with the correct value before saving. This makes hallucination impossible \u2014 the worst the AI can do is phrase a correct number awkwardly."
  ));

  out.push(h2("14.2 Risk 2: Occasion Date Inaccuracy (Severity 3, Likelihood 4)"));

  out.push(bodyPara(
    "Eid dates shift each year based on the lunar calendar. The system pre-populates estimated dates (accurate to within 1-2 days based on astronomical calculations), but the actual date is confirmed by religious authorities only 1-2 months before. If the system predicts an Eid spike for the wrong week, the report is useless (or worse, misleading). Mitigation: the HolidayCalendar table has an isConfirmed boolean. The system warns the founder (via the /admin dashboard and the weekly health email) if an upcoming occasion is unconfirmed. The founder must confirm dates each year via the Occasion Manager UI. As a fallback, if an occasion is unconfirmed and within 7 days, the system uses the estimated date but adds a note to the report: 'Eid date is estimated \u2014 confirm with local authorities.'"
  ));

  out.push(h2("14.3 Risk 3: Insufficient Historical Data (Severity 2, Likelihood 5)"));

  out.push(bodyPara(
    "New clients have less than 1 year of historical sales data. The prediction algorithm relies on comparing current occasion-week sales to last year's occasion-week sales \u2014 if there is no last year, the comparison fails. This affects every new client for their first 12 months. Mitigation: the algorithm uses whatever data is available (even 1 month) and applies the default impact weights from ReportOccasion when historical occasion data is unavailable. The report clearly states the prediction confidence: 'Low' (<3 months of data), 'Medium' (3-12 months), 'High' (>12 months). Clients with 'Low' confidence see a banner: 'This pharmacy has less than 3 months of sales history. Predictions are based on industry benchmarks and will improve as more data is collected.' This sets correct expectations and prevents the client from over-trusting the numbers."
  ));

  out.push(h2("14.4 Risk 4: WhatsApp API Approval Delay (Severity 2, Likelihood 4)"));

  out.push(bodyPara(
    "Meta WhatsApp Business template approval takes 3-5 business days and can be rejected if the template does not meet Meta's content policies. If rejected, the founder must revise and resubmit, adding another 3-5 days. This delays Phase E. Mitigation: Phase E is the last phase. Email delivery (Phase D) works independently and is not blocked by WhatsApp delays. The founder should start the Meta account setup on Day 1 of Phase A so it runs in parallel with all other phases. If WhatsApp is delayed by 2+ weeks, the feature ships with email-only delivery and WhatsApp is added in a follow-up release. The schedule builder UI clearly shows WhatsApp as 'Not yet configured' so the founder knows it is pending."
  ));

  out.push(h2("14.5 Risk 5: Cost Overrun at Scale (Severity 3, Likelihood 2)"));

  out.push(bodyPara(
    "At 10,000 clients receiving weekly reports, the platform AI cost is 7,740 BDT/month. If the founder accidentally sets up daily reports instead of weekly (7x frequency), the cost jumps to 54,180 BDT/month \u2014 over half the kill-switch threshold. Mitigation: all Phase 1-5 defenses apply. The max_tokens cap (Phase 1) limits per-report cost. The circuit breaker (Phase 2) caps per-business daily tokens. The kill-switch (Phase 4) blocks all AI calls if platform cost exceeds 100,000 BDT/month. The founder can also set per-schedule limits (e.g., max 1,000 reports per run) to prevent runaway cost from a misconfigured schedule. The ops-health dashboard (Phase 5) surfaces weekly cost trends so the founder notices a spike within 7 days."
  ));

  out.push(h2("14.6 Risk 6: Client Ignores Reports (Severity 4, Likelihood 3)"));

  out.push(bodyPara(
    "If the report is not useful, clients will tune it out within 2-3 weeks. Once they stop reading, the retention benefit disappears. This is the highest-severity risk because it undermines the entire feature. Mitigation: track open rates (email, via a tracking pixel) and read receipts (WhatsApp). If a client's open rate drops below 30 percent for 3 consecutive weeks, the system flags them in /admin and the founder can reach out personally. A/B test report formats: after 30 days, survey clients asking 'Is this report useful? What would make it better?' Use the feedback to refine the report content. The goal is a report that clients look forward to reading \u2014 if they do not, the feature has failed regardless of how well the AI performs."
  ));

  out.push(h2("14.7 Risk Matrix"));

  out.push(tableCaption("Table 14.1 \u2014 Risk Severity vs Likelihood"));
  out.push(makeTable(
    ["Risk", "Severity (1-5)", "Likelihood (1-5)", "Score", "Mitigation Summary"],
    [
      ["1. AI hallucination", "4", "3", "12", "AI only rephrases pre-computed numbers; cannot invent values"],
      ["2. Occasion date inaccuracy", "3", "4", "12", "isConfirmed flag; founder confirms lunar dates yearly"],
      ["3. Insufficient historical data", "2", "5", "10", "Confidence indicator; industry benchmark fallback"],
      ["4. WhatsApp approval delay", "2", "4", "8", "Phase E is last; email works independently; start Meta setup on Day 1"],
      ["5. Cost overrun at scale", "3", "2", "6", "Phase 1-5 defenses apply; per-schedule report limits"],
      ["6. Client ignores reports", "4", "3", "12", "Open-rate tracking; A/B testing; client surveys after 30 days"],
    ],
    [28, 14, 14, 10, 34]
  ));

  return out;
}

function buildAppendix() {
  const out = [];
  out.push(h1("15. Appendix \u2014 Prompt Templates & Example Report"));

  out.push(bodyPara(
    "This appendix is the developer cheat sheet. It contains the actual system prompt, an example user-content payload, a complete sample report, and the Bangladesh holiday calendar for 2026-2027. A developer can reference this appendix directly while implementing Phase B."
  ));

  out.push(h2("15.1 AI System Prompt Template"));

  out.push(calloutPara(
    "You are a pharmacy business analyst AI for InventoryOS, a Bangladesh pharmacy inventory management platform. You will receive pre-computed sales prediction data for a pharmacy for the upcoming week. Your job is to synthesize this data into a clear, actionable report.\n\nCRITICAL RULE: DO NOT calculate any numbers. All numbers (predicted quantities, spike percentages, stock levels, purchase recommendations) are already computed by the system. Your job is to explain what the numbers mean and what the pharmacist should do. If you are tempted to do math, stop \u2014 just rephrase the numbers you are given.\n\nReturn ONLY a JSON object with this exact structure:\n{\n  \"executiveSummary\": \"2-3 sentence overview mentioning the business name, overall outlook, top opportunity, and top risk\",\n  \"spikePredictions\": [\n    {\"product\": \"name\", \"spikePercent\": number, \"occasion\": \"occasion name\", \"historicalBasis\": \"last year X sold vs normal Y\", \"recommendation\": \"one-line action\"}\n  ],\n  \"topItems\": [\n    {\"product\": \"name\", \"predictedQty\": number, \"predictedProfit\": number, \"currentStock\": number, \"stockStatus\": \"good|low|order_now\", \"recommendation\": \"one-line note\"}\n  ],\n  \"stockRisks\": [\n    {\"product\": \"name\", \"daysUntilStockout\": number, \"recommendedPurchaseQty\": number, \"supplier\": \"name\", \"urgency\": \"critical|high|medium\"}\n  ]\n}\n\nReturn 3 spikePredictions, 20 topItems, and all stockRisks. Be specific and actionable. Mention occasions by name (Eid-ul-Fitr, Durga Puja, Friday, etc.). Keep recommendations practical \u2014 a pharmacy owner should be able to act on them immediately. Use BDT for all monetary values. Do not include dosing or medical advice.",
    P.aiAccent
  ));

  out.push(h2("15.2 Example User-Content Payload"));

  out.push(bodyPara(
    "The user content sent to GLM-4 is a JSON string containing the pre-computed data. Example for City Pharmacy, week of June 29 - July 5, 2026 (Eid-ul-Adha approaching on July 7):"
  ));

  out.push(calloutPara(
    "{\n  \"businessName\": \"City Pharmacy\",\n  \"reportPeriod\": \"2026-06-29 to 2026-07-05\",\n  \"predictionConfidence\": \"high\",\n  \"upcomingOccasions\": [\n    {\"name\": \"Eid-ul-Adha\", \"date\": \"2026-07-07\", \"daysUntil\": 8, \"impactWeight\": 2.5, \"durationDays\": 5}\n  ],\n  \"baseDemand\": [\n    {\"product\": \"Napa Extra 500mg\", \"baselineDaily\": 28.5, \"baselineWeekly\": 200},\n    {\"product\": \"Seclo 20mg\", \"baselineDaily\": 14.2, \"baselineWeekly\": 100},\n    {\"product\": \"Amoxicillin 500mg\", \"baselineDaily\": 21.4, \"baselineWeekly\": 150}\n  ],\n  \"occasionAdjustedPredictions\": [\n    {\"product\": \"Napa Extra 500mg\", \"predictedQty\": 880, \"spikePercent\": 340, \"historicalBasis\": \"Last year Eid week: 880 boxes vs normal 200\", \"currentStock\": 200, \"predictedProfit\": 17600, \"stockStatus\": \"order_now\", \"recommendedPurchaseQty\": 680, \"supplier\": \"Square Pharmaceuticals\"},\n    {\"product\": \"Seclo 20mg\", \"predictedQty\": 320, \"spikePercent\": 220, \"historicalBasis\": \"Last year Eid week: 320 vs normal 100\", \"currentStock\": 150, \"predictedProfit\": 9600, \"stockStatus\": \"low\", \"recommendedPurchaseQty\": 170, \"supplier\": \"Square Pharmaceuticals\"},\n    {\"product\": \"Amoxicillin 500mg\", \"predictedQty\": 180, \"spikePercent\": 20, \"historicalBasis\": \"Normal week\", \"currentStock\": 60, \"predictedProfit\": 5400, \"stockStatus\": \"order_now\", \"recommendedPurchaseQty\": 120, \"supplier\": \"Beximco Pharmaceuticals\"}\n  ],\n  \"stockRisks\": [\n    {\"product\": \"Amoxicillin 500mg\", \"daysUntilStockout\": 3, \"recommendedPurchaseQty\": 120, \"supplier\": \"Beximco Pharmaceuticals\", \"urgency\": \"critical\"},\n    {\"product\": \"Napa Extra 500mg\", \"daysUntilStockout\": 5, \"recommendedPurchaseQty\": 680, \"supplier\": \"Square Pharmaceuticals\", \"urgency\": \"high\"}\n  ]\n}",
    P.aiAccent
  ));

  out.push(h2("15.3 Example Report Output"));

  out.push(bodyPara(
    "The following is what the pharmacy owner sees in their email/WhatsApp. This is the rendered output after the AI synthesizes the payload above:"
  ));

  out.push(calloutPara(
    "INVENTORYOS WEEKLY PREDICTION REPORT\nCity Pharmacy \u2014 Week of June 29 - July 5, 2026\nPrediction confidence: High\n\nEXECUTIVE SUMMARY\nNext week looks strong \u2014 Eid-ul-Adha preparation starts Wednesday. Your top opportunity is Napa Extra (predicted 340 percent sales spike driven by Eid overeating). Your top risk is Amoxicillin 500mg (will stock out by Friday if you do not order today).\n\nBIG SALES SPIKE PREDICTIONS\n1. Napa Extra 500mg \u2014 340 percent spike (Eid-ul-Adha overeating). Last year Eid week: 880 boxes sold vs normal 200. Order 680 boxes from Square Pharmaceuticals by Wednesday.\n2. Seclo 20mg \u2014 220 percent spike (Eid heartburn). Last year: 320 vs normal 100. Stock is low \u2014 order 170 capsules.\n3. Oral Saline \u2014 180 percent spike (Eid dehydration). Order 200 sachets by Thursday.\n\nTOP 20 HIGH-POTENTIAL ITEMS\n[Table: Product | Predicted Qty | Predicted Profit | Current Stock | Status | Order Qty | Supplier]\n1. Napa Extra 500mg | 880 boxes | 17,600 BDT | 200 | ORDER NOW | 680 | Square\n2. Seclo 20mg | 320 boxes | 9,600 BDT | 150 | LOW | 170 | Square\n3. Amoxicillin 500mg | 180 caps | 5,400 BDT | 60 | ORDER NOW | 120 | Beximco\n... (17 more items)\n\nSTOCK RISKS & RECOMMENDATIONS\nCRITICAL: Amoxicillin 500mg \u2014 stocks out Friday (3 days). Order 120 capsules from Beximco today.\nHIGH: Napa Extra 500mg \u2014 stocks out Sunday (5 days). Order 680 boxes from Square by Wednesday.\n\n---\nGenerated by InventoryOS AI | Prediction confidence: High | Based on 365 days of sales data",
    P.accent
  ));

  out.push(h2("15.4 Bangladesh Holiday Calendar 2026-2027"));

  out.push(bodyPara(
    "The following holidays should be pre-seeded into the HolidayCalendar table during Phase A. Lunar dates (Eid) are estimates \u2014 the founder must confirm each year via the Occasion Manager UI."
  ));

  out.push(tableCaption("Table 15.1 \u2014 Bangladesh Holidays 2026"));
  out.push(makeTable(
    ["Date", "Occasion", "Type", "Confirmed?", "Impact Weight"],
    [
      ["2026-02-21", "Language Day", "National", "Yes", "0.8x"],
      ["2026-03-26", "Independence Day", "National", "Yes", "0.9x"],
      ["2026-04-10", "Eid-ul-Fitr (estimated)", "Religious", "No", "2.8x"],
      ["2026-04-14", "Pohela Boishakh", "National", "Yes", "1.5x"],
      ["2026-05-01", "May Day", "National", "Yes", "0.7x"],
      ["2026-07-07", "Eid-ul-Adha (estimated)", "Religious", "No", "2.5x"],
      ["2026-08-15", "National Mourning Day", "National", "Yes", "0.9x"],
      ["2026-10-02", "Durga Puja (estimated)", "Religious", "No", "2.0x"],
      ["2026-12-16", "Victory Day", "National", "Yes", "0.9x"],
      ["2026-12-25", "Christmas", "Religious", "Yes", "1.3x"],
      ["Every Friday", "Friday (weekly holiday)", "Weekly", "Yes", "1.4x"],
      ["Every Saturday", "Saturday (half holiday)", "Weekly", "Yes", "1.1x"],
    ],
    [16, 28, 14, 14, 14]
  ));

  out.push(bodyPara(
    "The 2027 calendar follows the same pattern. Eid-ul-Fitr 2027 is estimated around March 31, Eid-ul-Adha 2027 around June 27, Durga Puja 2027 around September 22. These must be confirmed by the founder in early 2027 via the Occasion Manager UI. The system will send a reminder (via the weekly health email) in January each year to prompt the founder to confirm the year's lunar occasion dates."
  ));

  out.push(h2("15.5 Implementation Checklist"));

  out.push(bodyPara(
    "Use this checklist to track implementation progress. Each item maps to a task in the phased roadmap (Section 13)."
  ));

  out.push(tableCaption("Table 15.2 \u2014 Implementation Checklist"));
  out.push(makeTable(
    ["#", "Task", "Phase", "Done?"],
    [
      ["1", "Add 5 Prisma models (ReportSchedule, ReportOccasion, HolidayCalendar, GeneratedReport, ReportDelivery)", "A", "[ ]"],
      ["2", "Add ownerEmail field to Business model", "A", "[ ]"],
      ["3", "Run prisma db push + generate", "A", "[ ]"],
      ["4", "Seed HolidayCalendar with 2026-2027 Bangladesh holidays", "A", "[ ]"],
      ["5", "Build occasion CRUD API (GET/POST/PUT/DELETE /api/super-admin/occasions)", "A", "[ ]"],
      ["6", "Build holiday calendar API (GET/POST /api/super-admin/holiday-calendar)", "A", "[ ]"],
      ["7", "Create src/lib/report-predictor.ts (5-step algorithm)", "B", "[ ]"],
      ["8", "Create src/lib/report-generator.ts (calls GLM-4, parses JSON, saves report)", "B", "[ ]"],
      ["9", "Build manual trigger endpoint (POST /api/super-admin/report-schedules/[id]/trigger)", "B", "[ ]"],
      ["10", "Build generated reports API (GET list + GET by id)", "B", "[ ]"],
      ["11", "Build Generated Reports Viewer UI", "B", "[ ]"],
      ["12", "Build Schedule List UI", "C", "[ ]"],
      ["13", "Build Schedule Builder Form UI", "C", "[ ]"],
      ["14", "Build schedule CRUD API", "C", "[ ]"],
      ["15", "Create src/lib/schedule-compute.ts (nextRunAt logic)", "C", "[ ]"],
      ["16", "Add report-schedule-checker cron job", "C", "[ ]"],
      ["17", "Add report-generator-worker cron job", "D", "[ ]"],
      ["18", "Add report-delivery-worker cron job", "D", "[ ]"],
      ["19", "Create src/lib/report-pdf.ts (PDF generation)", "D", "[ ]"],
      ["20", "Wire email delivery with PDF attachment", "D", "[ ]"],
      ["21", "Build retry logic (3 attempts, exponential backoff)", "D", "[ ]"],
      ["22", "Founder: create Meta Business account + WhatsApp number", "E", "[ ]"],
      ["23", "Founder: submit WhatsApp template for Meta review", "E", "[ ]"],
      ["24", "Create src/lib/whatsapp.ts module", "E", "[ ]"],
      ["25", "Wire WhatsApp delivery into report-delivery-worker", "E", "[ ]"],
      ["26", "Add 4 new help entries to SuperAdminHelp off-canvas", "E", "[ ]"],
    ],
    [6, 60, 10, 10]
  ));

  return out;
}

module.exports = {
  buildCostAnalysis,
  buildRoadmap,
  buildRisks,
  buildAppendix,
};
