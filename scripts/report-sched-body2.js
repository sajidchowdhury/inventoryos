// Body Part 2: Data Model + Occasion Calendar + AI Prediction + Report Content
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer, imageBlock,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildDataModel() {
  const out = [];
  out.push(h1("4. Data Model (Prisma Schema)"));

  out.push(bodyPara(
    "Five new Prisma models are required. They store schedule configuration, occasion definitions, the Bangladesh holiday calendar, generated reports, and delivery tracking. All models use cuid() primary keys, createdAt/updatedAt timestamps, and appropriate indexes for query performance. The models are designed to be fully multi-tenant \u2014 every report and delivery is scoped to a businessId, and schedules are platform-wide (managed by super-admin)."
  ));

  out.push(h2("4.1 ReportSchedule"));

  out.push(bodyPara(
    "Stores the founder's schedule configuration. Each row defines one recurring schedule (e.g., 'Weekly Monday report for all Pro+AI clients considering Eid and Fridays'). The schedule is platform-wide \u2014 it generates reports for multiple businesses."
  ));

  out.push(tableCaption("Table 4.1 \u2014 ReportSchedule Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["name", "String", "(required)", "Human-readable schedule name, e.g., 'Weekly Eid-Aware Report'"],
      ["description", "String?", "null", "Optional description shown in admin UI"],
      ["frequency", "String", "(required)", "Enum: 'weekly' | 'monthly' | 'date_range'"],
      ["dayOfWeek", "Int?", "null", "For weekly: 0=Sunday, 1=Monday, ..., 6=Saturday"],
      ["dayOfMonth", "Int?", "null", "For monthly: 1-28 (avoids 29/30/31 to prevent skipped months)"],
      ["startDate", "DateTime?", "null", "For date_range: first report date"],
      ["endDate", "DateTime?", "null", "For date_range: last report date"],
      ["occasions", "String", "[]", "JSON array of occasion IDs to consider (e.g., ['eid-ul-fitr','friday']). Empty = consider all active occasions"],
      ["targetClientMode", "String", "'all'", "Enum: 'all' | 'selected'"],
      ["targetClientIds", "String?", "null", "JSON array of businessIds. Null if targetClientMode='all'"],
      ["deliveryChannels", "String", "[\"email\"]", "JSON array: ['email'] | ['whatsapp'] | ['email','whatsapp']"],
      ["reportPeriodDays", "Int", "7", "How many days ahead the report predicts. Default 7 (weekly). Can be 14 for biweekly."],
      ["isActive", "Boolean", "true", "Founder can pause a schedule without deleting it"],
      ["lastRunAt", "DateTime?", "null", "Last time this schedule triggered (auto-updated)"],
      ["nextRunAt", "DateTime?", "null", "Next scheduled run (auto-computed on schedule create/update and after each run)"],
      ["createdBy", "String?", "null", "Super-admin username who created the schedule"],
      ["createdAt", "DateTime", "now()", "Creation timestamp"],
      ["updatedAt", "DateTime", "updatedAt", "Last update timestamp"],
    ],
    [22, 16, 16, 46]
  ));

  out.push(bodyPara(
    "Indexes: @@index([isActive, nextRunAt]) for the schedule checker query, @@index([frequency]) for admin filtering. The nextRunAt field is critical \u2014 the checker cron queries WHERE isActive=true AND nextRunAt <= now() to find due schedules."
  ));

  out.push(h2("4.2 ReportOccasion"));

  out.push(bodyPara(
    "Defines the occasions the system knows about. Pre-seeded with 12+ Bangladesh occasions, but the founder can add custom ones (e.g., 'Local Annual Health Camp'). Each occasion has an impact weight (how much it typically boosts sales) and a duration (how long the spike lasts)."
  ));

  out.push(tableCaption("Table 4.2 \u2014 ReportOccasion Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["name", "String", "(required)", "Display name: 'Eid-ul-Fitr', 'Durga Puja', 'Friday', etc."],
      ["slug", "String @unique", "(auto)", "URL-safe identifier: 'eid-ul-fitr', 'friday'"],
      ["type", "String", "(required)", "Enum: 'religious' | 'national' | 'weekly' | 'seasonal' | 'custom'"],
      ["datePattern", "String", "(required)", "Enum: 'fixed_date' (e.g., Dec 25), 'lunar_approximate' (Eid, shifts each year), 'recurring_weekly' (every Friday), 'recurring_monthly'"],
      ["fixedMonth", "Int?", "null", "For fixed_date: month 1-12"],
      ["fixedDay", "Int?", "null", "For fixed_date: day 1-31"],
      ["weeklyDayOfWeek", "Int?", "null", "For recurring_weekly: 0=Sunday, 5=Friday, 6=Saturday"],
      ["impactWeight", "Float", "1.0", "Sales multiplier: 1.0 = normal, 2.5 = 150% boost, 0.3 = 70% reduction (gov holiday with closed shops)"],
      ["durationDays", "Int", "1", "How long the spike lasts. Eid = 7 days, Friday = 1 day, Ramadan = 30 days"],
      ["leadDays", "Int", "0", "How many days BEFORE the occasion the spike starts (Eid shopping starts 5 days before)"],
      ["description", "String?", "null", "Explanation shown in admin UI"],
      ["isActive", "Boolean", "true", "Founder can disable an occasion without deleting it"],
      ["createdAt", "DateTime", "now()", ""],
      ["updatedAt", "DateTime", "updatedAt", ""],
    ],
    [22, 16, 14, 48]
  ));

  out.push(h2("4.3 HolidayCalendar"));

  out.push(bodyPara(
    "Stores the specific dates of occasions for each year. This is necessary because occasions like Eid shift each year (lunar calendar) and must be manually confirmed. The system uses this table to know exactly which dates in the next 7-14 days have occasions, then looks up the same occasions in historical sales data."
  ));

  out.push(tableCaption("Table 4.3 \u2014 HolidayCalendar Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["occasionId", "String", "(required)", "Foreign key to ReportOccasion"],
      ["date", "DateTime", "(required)", "Specific date of this occasion occurrence (e.g., 2026-06-17 for Eid-ul-Adha 2026)"],
      ["isConfirmed", "Boolean", "false", "Lunar dates are estimates until founder confirms. System warns if upcoming occasion is unconfirmed"],
      ["year", "Int", "(auto)", "Year of the occurrence, derived from date. Used for filtering"],
      ["notes", "String?", "null", "Optional notes, e.g., 'Eid date confirmed by Islamic Foundation Bangladesh'"],
      ["createdAt", "DateTime", "now()", ""],
      ["updatedAt", "DateTime", "updatedAt", ""],
    ],
    [20, 16, 14, 50]
  ));

  out.push(bodyPara(
    "Indexes: @@unique([occasionId, date]) to prevent duplicate entries, @@index([date]) for querying upcoming occasions, @@index([year]) for yearly views. The table is pre-seeded with 2026-2027 Bangladesh holidays during Phase A implementation."
  ));

  out.push(h2("4.4 GeneratedReport"));

  out.push(bodyPara(
    "Stores each generated report. One row per business per schedule run. Contains the full report content as JSON fields, plus cost tracking and status. This is the table the report viewer UI queries."
  ));

  out.push(tableCaption("Table 4.4 \u2014 GeneratedReport Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["scheduleId", "String", "(required)", "Foreign key to ReportSchedule"],
      ["businessId", "String", "(required)", "Foreign key to Business (the client)"],
      ["reportDate", "DateTime", "(required)", "When the report was generated"],
      ["reportPeriodStart", "DateTime", "(required)", "First day of the prediction period (e.g., next Monday)"],
      ["reportPeriodEnd", "DateTime", "(required)", "Last day of the prediction period (e.g., next Sunday)"],
      ["executiveSummary", "String?", "null", "2-3 sentence AI-generated summary"],
      ["spikePredictions", "String?", "null", "JSON array of top 3 spike predictions"],
      ["topItems", "String?", "null", "JSON array of 20 items with predictedQty, profit, supplier, stock status"],
      ["stockRisks", "String?", "null", "JSON array of stock risk items with purchase recommendations"],
      ["aiTokensUsed", "Int", "0", "Tokens consumed by the AI call (for cost tracking)"],
      ["aiCostEstimate", "Float", "0.0", "Cost in BDT (tokens / 1000 * 0.03)"],
      ["generationStatus", "String", "'pending'", "Enum: 'pending' | 'generating' | 'completed' | 'failed'"],
      ["errorMessage", "String?", "null", "Error details if generation failed"],
      ["pdfUrl", "String?", "null", "URL to generated PDF (for email attachment). Null if not yet generated"],
      ["predictionConfidence", "String", "'medium'", "Enum: 'low' | 'medium' | 'high'. Low if <3 months of data"],
      ["createdAt", "DateTime", "now()", ""],
      ["updatedAt", "DateTime", "updatedAt", ""],
    ],
    [22, 14, 14, 50]
  ));

  out.push(bodyPara(
    "Indexes: @@index([scheduleId, reportDate]) for schedule history, @@index([businessId, reportDate]) for client history, @@index([generationStatus]) for the worker query, @@index([reportDate]) for date filtering."
  ));

  out.push(h2("4.5 ReportDelivery"));

  out.push(bodyPara(
    "Tracks the delivery of each report via each channel. One GeneratedReport can have multiple ReportDelivery rows (one per channel). This is the table the delivery status UI queries."
  ));

  out.push(tableCaption("Table 4.5 \u2014 ReportDelivery Model"));
  out.push(makeTable(
    ["Field", "Type", "Default", "Description"],
    [
      ["id", "String @id", "cuid()", "Primary key"],
      ["reportId", "String", "(required)", "Foreign key to GeneratedReport"],
      ["channel", "String", "(required)", "Enum: 'email' | 'whatsapp'"],
      ["recipient", "String", "(required)", "Email address or WhatsApp phone number (with country code)"],
      ["status", "String", "'queued'", "Enum: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'"],
      ["sentAt", "DateTime?", "null", "When the message was sent"],
      ["deliveredAt", "DateTime?", "null", "When the message was delivered (WhatsApp only)"],
      ["readAt", "DateTime?", "null", "When the message was read/opened"],
      ["errorMessage", "String?", "null", "Error details if delivery failed"],
      ["retryCount", "Int", "0", "Number of delivery attempts (max 3)"],
      ["providerMessageId", "String?", "null", "Message ID from SMTP/WhatsApp for tracking"],
      ["createdAt", "DateTime", "now()", ""],
      ["updatedAt", "DateTime", "updatedAt", ""],
    ],
    [22, 14, 14, 50]
  ));

  out.push(bodyPara(
    "Indexes: @@index([reportId]) for report delivery history, @@index([status]) for the worker query (WHERE status='queued'), @@index([channel, status]) for channel-specific monitoring."
  ));

  return out;
}

function buildOccasionCalendar() {
  const out = [];
  out.push(h1("5. Occasion Calendar System"));

  out.push(bodyPara(
    "The occasion calendar is the heart of the prediction system. Without it, the AI would just be averaging historical sales \u2014 which any tool can do. With it, the AI knows that Eid is coming, that Eid historically triples Napa Extra sales for this specific pharmacy, and that the pharmacy needs to order 680 more boxes by Wednesday. This section explains how occasions are defined, how they affect predictions, and how the system matches upcoming occasions to historical sales."
  ));

  out.push(h2("5.1 Why Occasions Matter for Pharmacy Sales"));

  out.push(bodyPara(
    "Pharmacy sales in Bangladesh are not uniform throughout the year. They spike and dip based on occasions, and each occasion affects different product categories differently. During Eid ul-Fitr (the end of Ramadan), sales of antacids, antiemetics, and oral saline spike 200-300 percent because people overeat during iftar and eid meals. During Eid ul-Adha, sales of antiseptics, bandages, and antibiotics spike because of cattle-slaughtering injuries. During Durga Puja, sales of first-aid supplies and antiseptics spike because of crowd injuries at pandals. On Fridays (the weekly holiday), overall footfall increases 30-50 percent. On government holidays where shops are closed, sales drop to near zero. A prediction system that does not account for these patterns will be wrong during the most important weeks of the year \u2014 the weeks where pharmacies make or lose the most money."
  ));

  out.push(h2("5.2 The Three Date Pattern Types"));

  out.push(bodyPara(
    "Occasions fall into three categories based on how their dates are determined, and each requires different handling. Fixed-date occasions (like Christmas on December 25 or Language Day on February 21) occur on the same Gregorian date every year. The system stores the month and day in the ReportOccasion.fixedMonth and fixedDay fields and automatically generates HolidayCalendar rows for each year. Lunar-approximate occasions (like Eid ul-Fitr and Eid ul-Adha) shift each year based on the Islamic lunar calendar. These dates cannot be computed automatically \u2014 they must be confirmed by religious authorities each year. The system pre-populates estimated dates (which are accurate to within 1-2 days based on astronomical calculations) and marks them isConfirmed=false. The founder must confirm them each year via the admin UI. Recurring-weekly occasions (like Friday and Saturday) occur every week. The system stores the day of week in weeklyDayOfWeek and generates HolidayCalendar rows dynamically \u2014 no manual entry needed."
  ));

  out.push(h2("5.3 Impact Weighting System"));

  out.push(bodyPara(
    "Each occasion has an impactWeight field (Float, default 1.0) that represents how much the occasion affects sales. A weight of 1.0 means no effect (normal day). A weight of 2.5 means sales are 150 percent higher than normal (2.5x baseline). A weight of 0.3 means sales are 70 percent lower than normal (e.g., a government holiday where shops are closed). The weight is not a fixed multiplier applied to all products \u2014 it is a starting point that the prediction algorithm refines using the pharmacy's own historical data. For example, the default Eid weight is 2.5, but if a specific pharmacy historically sold 4x normal Napa Extra during Eid, the algorithm uses 4.0 for that product, not 2.5. The impact weight is the fallback when no historical data is available (e.g., a new product or a new pharmacy)."
  ));

  out.push(h2("5.4 Combination Multiplier"));

  out.push(bodyPara(
    "When multiple occasions overlap, their effects are not simply additive. Eid + Friday is not 2.5 + 1.2 = 3.7x. The combination creates a longer shopping window (Eid lasts 7 days, Friday extends the peak), and people shop more aggressively when they have a long weekend plus a festival. The system uses a combination multiplier of 1.15x for two overlapping occasions. So Eid + Friday = (2.5 + 1.2) * 1.15 = 4.25x. This is applied per-day in the prediction algorithm. Three overlapping occasions (rare, but possible \u2014 e.g., Eid + Friday + government holiday) use a 1.3x multiplier. The combination multiplier is configurable in case the founder wants to tune it based on observed data."
  ));

  out.push(h2("5.5 How Occasions Are Matched to Historical Sales"));

  out.push(bodyPara(
    "The prediction algorithm does not just apply the impactWeight blindly. It looks up the actual historical sales for the same occasion in the previous year. The matching process works as follows. For each day in the prediction period (e.g., next Monday through Sunday), the system checks if that day has an occasion in HolidayCalendar. If yes, it finds the same occasion in the previous year's HolidayCalendar, identifies the 7-day window around that occasion, and queries the business's SaleItem data for that window. It calculates the actual spike ratio: (sales during occasion week) / (sales during a normal week 4 weeks before). This actual spike ratio is then applied to the current baseline demand (computed from the last 30 days of sales). If the occasion did not occur in the previous year (e.g., a new occasion the founder just added), the system falls back to the default impactWeight."
  ));

  out.push(h2("5.6 Pre-Seeded Bangladesh Holiday Calendar"));

  out.push(bodyPara(
    "During Phase A implementation, the HolidayCalendar table is pre-seeded with the following Bangladesh occasions for 2026-2027. The founder can edit these, add custom occasions, and confirm lunar dates each year."
  ));

  out.push(tableCaption("Table 5.1 \u2014 Pre-Seeded Bangladesh Occasions"));
  out.push(makeTable(
    ["Occasion", "Type", "Date Pattern", "Impact Weight", "Duration", "Notes"],
    [
      ["Eid-ul-Fitr", "Religious", "Lunar approximate", "2.8", "7 days", "End of Ramadan. Antacids, oral saline, antiemetics spike. Pre-populated with 2026 estimate; founder must confirm"],
      ["Eid-ul-Adha", "Religious", "Lunar approximate", "2.5", "5 days", "Cattle slaughtering. Antiseptics, bandages, antibiotics spike. Pre-populated with 2026 estimate"],
      ["Durga Puja", "Religious", "Lunar approximate", "2.0", "5 days", "Crowd injuries. First-aid, antiseptics spike"],
      ["Ramadan", "Religious", "Lunar approximate", "1.8", "30 days", "Month of fasting. Gradual increase in digestive meds. Overlaps with Eid-ul-Fitr at the end"],
      ["Christmas", "Religious", "Fixed (Dec 25)", "1.3", "1 day", "Gift items, seasonal meds"],
      ["New Year (Jan 1)", "National", "Fixed (Jan 1)", "1.2", "1 day", "Mild increase"],
      ["Language Day (Feb 21)", "National", "Fixed (Feb 21)", "0.8", "1 day", "Slight decrease (morning ceremony, shops open late)"],
      ["Independence Day (Mar 26)", "National", "Fixed (Mar 26)", "0.9", "1 day", "Slight decrease"],
      ["Pohela Boishakh (Apr 14)", "National", "Fixed (Apr 14)", "1.5", "1 day", "Bengali New Year. Mild increase"],
      ["May Day (May 1)", "National", "Fixed (May 1)", "0.7", "1 day", "Government holiday, many shops closed"],
      ["Victory Day (Dec 16)", "National", "Fixed (Dec 16)", "0.9", "1 day", "Slight decrease"],
      ["Friday", "Weekly", "Recurring weekly (day 5)", "1.4", "1 day", "Weekly holiday. Footfall increases 30-50%"],
      ["Saturday", "Weekly", "Recurring weekly (day 6)", "1.1", "1 day", "Half-holiday for some. Mild increase"],
      ["Government Holiday (custom)", "National", "Variable", "0.3", "1 day", "Catch-all for unexpected gov holidays (founder adds specific dates)"],
    ],
    [20, 12, 18, 12, 12, 26]
  ));

  return out;
}

function buildPredictionAlgorithm() {
  const out = [];
  out.push(h1("6. AI Prediction Algorithm"));

  out.push(bodyPara(
    "The prediction algorithm is the intelligence that turns raw sales data into actionable forecasts. It is a 5-step process that runs entirely in code (Prisma queries + JavaScript math) before any AI is involved. The AI's job is only to synthesize the pre-computed numbers into natural language \u2014 it does not do the math itself. This separation is critical for cost control (Phase 1-5 defenses apply to the AI call) and for accuracy (LLMs are bad at arithmetic and would hallucinate numbers if asked to compute them)."
  ));

  out.push(h2("6.1 Inputs"));

  out.push(bodyPara(
    "The algorithm takes four inputs per business. First, 365 days of daily sales data per product, aggregated from the SaleItem table. This is the baseline for understanding normal demand patterns. Second, current stock levels per product, from the Inventory table. This is used for the stock gap analysis. Third, upcoming occasions in the next 7-14 days, from the HolidayCalendar table. This is what makes the prediction occasion-aware. Fourth, occasion impact weights from the ReportOccasion table, used as fallbacks when historical occasion data is unavailable."
  ));

  out.push(h2("6.2 The 5-Step Process"));

  out.push(h3("Step 1 \u2014 Base Demand Calculation"));

  out.push(bodyPara(
    "For each active product in the business, compute the 30-day moving average daily sales. This is the baseline demand: how many units per day the product sells on a normal day with no occasions. Exclude the last 7 days from the average (to avoid skewing with an ongoing occasion). If a product has less than 30 days of history, use whatever is available. If a product has zero sales in the last 30 days, mark it as 'dormant' and exclude it from the report (no point predicting zero)."
  ));

  out.push(h3("Step 2 \u2014 Occasion Overlay"));

  out.push(bodyPara(
    "For each day in the prediction period (e.g., next Monday through Sunday), check if that day has an occasion in HolidayCalendar. If yes, look up the same occasion in the previous year's data. Find the 7-day window around that occasion (3 days before, the occasion day, 3 days after). Query the business's SaleItem data for that window. Calculate the actual historical spike ratio: (sales during occasion window) / (sales during a normal 7-day window 4 weeks before the occasion). Apply this ratio to the baseline demand for the occasion days in the prediction period. If the occasion did not occur in the previous year (new occasion, or the business is less than 1 year old), fall back to the default impactWeight from ReportOccasion."
  ));

  out.push(h3("Step 3 \u2014 Combination Handling"));

  out.push(bodyPara(
    "If multiple occasions overlap on the same day (e.g., Eid + Friday), apply the combination multiplier. The base multiplier is the sum of the individual occasion impact weights. The combination multiplier is 1.15x for two overlapping occasions, 1.3x for three. So for Eid (2.8) + Friday (1.4) on the same day: (2.8 + 1.4) * 1.15 = 4.83x baseline demand. This is applied per-day. Days with no occasion use 1.0x (baseline only)."
  ));

  out.push(h3("Step 4 \u2014 Stock Gap Analysis"));

  out.push(bodyPara(
    "For each product, sum the predicted daily demand across the 7-day prediction period (after occasion adjustments). This is the predicted 7-day demand. Compare it to current stock level. If current stock >= predicted demand * 1.2 (20 percent safety margin), the product is 'good' \u2014 no action needed. If current stock < predicted demand but > 0, the product is 'low' \u2014 will stock out during the week. Calculate the day of stockout (current stock / daily demand). If current stock = 0, the product is 'out' \u2014 already stocked out. For 'low' and 'out' products, calculate recommended purchase quantity = predicted demand * 1.2 - current stock, rounded up to the nearest standard pack size (from the product's stripSize/boxSize fields)."
  ));

  out.push(h3("Step 5 \u2014 AI Synthesis"));

  out.push(bodyPara(
    "Pass the structured data to GLM-4 via the z-ai-web-dev-sdk. The AI receives: business name, prediction period dates, the top 20 products by predicted profit (with predicted qty, current stock, stock status, recommended purchase qty), the top 3 spike predictions (with occasion and spike percentage), and the stock risk list. The system prompt instructs the AI to return a JSON object with four sections: executiveSummary (2-3 sentences), spikePredictions (the top 3, rephrased in natural language with the occasion context), topItems (the 20 items, with a one-line AI-generated 'why this matters' note for each), and stockRisks (the risk items, with urgency and action recommendation). The AI does NOT compute any numbers \u2014 it only rephrases the pre-computed numbers. This prevents hallucination and keeps the AI call bounded (Phase 1 max_tokens cap applies)."
  ));

  out.push(h2("6.3 The System Prompt Template"));

  out.push(calloutPara(
    "You are a pharmacy business analyst AI. You will receive pre-computed sales prediction data for a pharmacy for the upcoming week. Your job is to synthesize this data into a clear, actionable report. DO NOT calculate any numbers \u2014 all numbers are already computed. Your job is to explain what the numbers mean and what the pharmacist should do. Return ONLY a JSON object with this structure: { executiveSummary: '2-3 sentence overview', spikePredictions: [{product, spikePercent, occasion, recommendation}], topItems: [{product, predictedQty, predictedProfit, currentStock, stockStatus, recommendation}], stockRisks: [{product, daysUntilStockout, recommendedPurchaseQty, supplier, urgency}] }. Be specific, actionable, and pharmacy-focused. Use the business name in the executive summary. Mention specific occasions by name. Keep recommendations practical \u2014 a pharmacy owner should be able to act on them immediately.",
    P.aiAccent
  ));

  out.push(h2("6.4 Cost Control Integration"));

  out.push(bodyPara(
    "The AI call in Step 5 is subject to all Phase 1-5 defenses. The max_tokens cap (Phase 1, configurable from /admin) limits the response size. The circuit breaker (Phase 2) prevents a single business from burning too many tokens in 24 hours. The kill-switch (Phase 4) blocks all AI calls if platform-wide cost exceeds the threshold. The 500K monthly token budget per business covers approximately 80 reports per month (at 6,000 tokens per report) \u2014 more than enough for weekly reports (4-5 per month). If a business somehow exceeds the token budget, the report generation falls back to a deterministic mode (raw numbers without AI synthesis) so the client still receives a report."
  ));

  return out;
}

function buildReportContent() {
  const out = [];
  out.push(h1("7. Report Content Structure"));

  out.push(bodyPara(
    "Every generated report contains four sections, in a fixed order. The structure is designed for quick scanning \u2014 a busy pharmacy owner should be able to extract the key action items in under 60 seconds. The full report is delivered as HTML in email and as a formatted message in WhatsApp, with a PDF attachment containing the complete details."
  ));

  out.push(h2("7.1 Section 1: Executive Summary"));

  out.push(bodyPara(
    "Two to three sentences summarizing the week ahead. Always includes: the overall outlook (strong/normal/quiet), the top opportunity (product + reason), and the top risk (product + consequence). Example: 'Next week looks strong \u2014 Eid-ul-Adha preparation starts Wednesday. Your top opportunity is Napa Extra (predicted 340 percent sales spike driven by Eid overeating). Your top risk is Amoxicillin 500mg (will stock out by Friday if you do not order today).' This section is AI-generated from the structured data \u2014 the AI is instructed to be specific and actionable, never vague."
  ));

  out.push(h2("7.2 Section 2: Big Sales Spike Predictions"));

  out.push(bodyPara(
    "The top 3 products predicted to spike during the prediction period, ranked by spike magnitude. Each entry shows: product name, predicted spike percentage, the occasion driving the spike, and a one-line recommended action. Example: '1. Napa Extra \u2014 340 percent spike (Eid-ul-Adha overeating). Order 680 boxes by Wednesday. 2. Seclo \u2014 220 percent spike (Eid heartburn). Stock is adequate. 3. Oral Saline \u2014 180 percent spike (Eid dehydration). Order 200 sachets by Thursday.' The historical basis is shown in a sub-line: 'Last year Eid week: 880 boxes sold vs. normal 200 boxes.'"
  ));

  out.push(h2("7.3 Section 3: Top 20 High-Potential Items"));

  out.push(bodyPara(
    "A table of the 20 products with the highest predicted profit during the prediction period, sorted by predicted profit descending. This is the main actionable section \u2014 the pharmacy owner scans the 'Recommended Purchase Qty' column and places orders for everything flagged red."
  ));

  out.push(tableCaption("Table 7.1 \u2014 Top 20 Items Table Columns"));
  out.push(makeTable(
    ["Column", "Description", "Example"],
    [
      ["Product", "Name + strength + form", "Napa Extra 500mg Tablet"],
      ["Predicted Qty", "Units predicted to sell in the period", "880 boxes"],
      ["Predicted Profit", "Predicted revenue minus COGS in BDT", "৳17,600"],
      ["Current Stock", "Units in inventory now", "200 boxes"],
      ["Stock Status", "Color-coded: green (good) / amber (low) / red (order now)", "RED \u2014 Order Now"],
      ["Recommended Purchase Qty", "Units to order (with 20% safety margin, rounded to pack size)", "680 boxes"],
      ["Recommended Supplier", "Supplier name from last purchase", "Square Pharmaceuticals"],
    ],
    [22, 40, 38]
  ));

  out.push(h2("7.4 Section 4: Stock Risks & Recommendations"));

  out.push(bodyPara(
    "A list of products that will stock out during the prediction period, with urgency levels. Each entry shows: product name, days until stockout (e.g., 'Friday' or '3 days'), recommended purchase quantity, recommended supplier, and urgency (critical/high/medium). Critical means stockout in 1-2 days. High means stockout in 3-4 days. Medium means stockout in 5-7 days. Example: 'Amoxicillin 500mg \u2014 stocks out Friday (3 days). Order 300 capsules from Beximco today. Urgency: CRITICAL.' This section is sorted by urgency (critical first), then by days until stockout."
  ));

  out.push(h2("7.5 Report Branding & Format"));

  out.push(bodyPara(
    "Every report includes the InventoryOS logo at the top, the pharmacy name, the prediction period dates, and a 'Prediction confidence' indicator (Low/Medium/High based on how much historical data is available). The report is generated in English by default, with a Bangla toggle planned for a future phase. For email delivery, the report is sent as an HTML email with a PDF attachment (generated via the existing PDF skill). For WhatsApp delivery, the report summary is sent as a template message, with a link to the full report in the InventoryOS web app (and optionally a PDF document attachment, subject to WhatsApp template approval)."
  ));

  return out;
}

module.exports = {
  buildDataModel,
  buildOccasionCalendar,
  buildPredictionAlgorithm,
  buildReportContent,
};
