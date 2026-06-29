// Body Part 1: Executive Summary + Product Vision + High-Level Flow
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildExecSummary() {
  const out = [];
  out.push(h1("1. Executive Summary"));

  out.push(bodyPara(
    "The AI Report Scheduling System is the single most important retention feature for InventoryOS. It automatically generates a personalized weekly sales prediction report for every pharmacy client and delivers it via Email and WhatsApp. The report tells the pharmacy owner exactly what to stock, what to order, and what to expect in the coming week \u2014 based on their own 1-year sales history combined with the Bangladesh occasion calendar (Eid, Puja, Fridays, government holidays). This document specifies the complete implementation: data model, prediction algorithm, API endpoints, UI, automation, delivery, cost, and a phased roadmap."
  ));

  out.push(bodyPara(
    "The core insight is that pharmacy sales in Bangladesh are heavily occasion-driven. During Eid week, sales of food-poisoning medications, gifts, and seasonal items spike 200-400 percent. During Puja, first-aid supplies and bandages surge. On Fridays (the weekend), overall footfall increases. A generic inventory tool cannot predict these spikes because it does not know about Bangladeshi occasions. InventoryOS does \u2014 and that is the differentiator that makes this report something clients will actually read every Monday morning, renew their subscription for, and forward to their suppliers."
  ));

  out.push(bodyPara(
    "The system reuses the existing AI cost-control infrastructure from Phases 1-5 (max_tokens cap, circuit breaker, kill-switch, configurable thresholds). This means the feature can scale to thousands of clients without financial risk. At 100 clients receiving a weekly report, the platform AI cost is approximately 78 BDT per month. At 1,000 clients it is 780 BDT per month. The feature is bundled into the Pro+AI tier at no extra cost because it is a retention play, not a revenue play \u2014 the report keeps clients subscribed, and the subscription revenue is what matters."
  ));

  out.push(h2("1.1 What the Client Receives"));

  out.push(bodyPara(
    "Every week (or per the configured schedule), each target pharmacy client receives a report containing four sections. First, an executive summary: a 2-3 sentence overview of the week ahead, highlighting the top opportunity and the top risk. Second, big sales spike predictions: the top 3 products predicted to spike, with the percentage and the occasion driving it. Third, the top 20 high-potential items: a table showing each product's predicted sales quantity, predicted profit, current stock, stock status, recommended purchase quantity, and recommended supplier. Fourth, stock risks and actionable recommendations: a list of products that will stock out during the week, with days-until-stockout, recommended purchase quantity, supplier, and urgency level."
  ));

  out.push(calloutPara(
    "Example: On Monday June 29, City Pharmacy receives a WhatsApp message. The report says: 'Eid-ul-Adha is in 10 days. Based on last year, your Napa Extra sales will spike 340 percent next week. You currently have 200 boxes; you need 880. Order 680 boxes from Square Pharmaceuticals by Wednesday to arrive in time. Your Amoxicillin 500mg will stock out by Friday \u2014 order 300 capsules from Beximco today.' The pharmacy owner forwards this to their supplier. The supplier is impressed. The supplier signs up for InventoryOS.",
    P.aiAccent
  ));

  out.push(h2("1.2 Business Impact"));

  out.push(bodyPara(
    "Three measurable outcomes are expected from this feature. First, reduced churn: clients who receive a weekly report have a weekly touchpoint with the product and are significantly less likely to cancel. Industry benchmarks for SaaS retention tools suggest a 15-25 percent reduction in monthly churn for products with weekly engagement touchpoints. Second, increased perceived value: the report is the most tangible demonstration of the AI features clients are paying for \u2014 it turns abstract AI capabilities into a concrete, weekly, money-saving recommendation. Third, organic growth via forwarding: pharmacy owners will forward the report to their suppliers (to place orders) and to other pharmacy owners (to show off the tool). Each forwarded report is a free lead."
  ));

  return out;
}

function buildProductVision() {
  const out = [];
  out.push(h1("2. Product Vision & The Client Hook"));

  out.push(h2("2.1 The Retention Problem"));

  out.push(bodyPara(
    "Pharmacy owners in Bangladesh do not log into software every day. They are busy behind the counter, dispensing medicines, talking to customers, and managing staff. A typical InventoryOS user might log in once a week to check stock levels, or once a month to review reports. Between those sessions, the product is invisible to them. This is a retention problem: if the client does not think about the product, they will not renew their subscription when it comes due. The generic SaaS solution is email newsletters or push notifications, but those are easy to ignore and feel like marketing, not value."
  ));

  out.push(h2("2.2 The Hook Solution"));

  out.push(bodyPara(
    "The weekly AI report solves this by creating a touchpoint the client actually wants. Instead of the client having to remember to log in and check InventoryOS, InventoryOS comes to them \u2014 in their WhatsApp inbox (where Bangladeshi business owners already spend hours per day) or their email. The report is not a marketing message; it is a personalized business intelligence brief that tells them exactly what to do this week to make more money. Once a client has received 4-5 of these reports, they start to depend on them. They plan their week around the recommendations. They show the report to their staff. The report becomes part of their workflow \u2014 and canceling InventoryOS means losing that workflow."
  ));

  out.push(h2("2.3 The Occasion-Awareness Differentiator"));

  out.push(bodyPara(
    "The single feature that makes this report better than any competitor is occasion awareness. A generic inventory tool (like Zoho Inventory or QuickBooks) can predict next week's sales by averaging the last 4 weeks. That works for a hardware store in Ohio. It does not work for a pharmacy in Dhaka, where Eid ul-Fitr causes a 300 percent spike in antacid sales (because people overeat during Ramadan breaking-fast meals), where Puja causes a surge in first-aid supplies (because of crowd injuries at pandals), and where every Friday sees a 40 percent increase in overall footfall (because it is the weekly holiday). InventoryOS knows about these occasions because it has a Bangladesh-specific occasion calendar with impact weights, and it knows how each occasion historically affected each product's sales for this specific pharmacy. No competitor has this. This is the moat."
  ));

  out.push(h2("2.4 Day in the Life \u2014 A Client Scenario"));

  out.push(bodyPara(
    "It is Monday morning, 8:00 AM. Rahim, the owner of City Pharmacy in Dhanmondi, opens WhatsApp while drinking his morning tea. He sees a message from InventoryOS. The subject line reads: 'City Pharmacy Weekly Prediction \u2014 Week of June 29 \u2014 Eid Preparation Starts Wednesday.'"
  ));

  out.push(bodyPara(
    "He taps it open. The first thing he sees is the executive summary: 'Next week looks strong \u2014 Eid-ul-Adha preparation starts Wednesday. Your top opportunity is Napa Extra (predicted 340 percent sales spike). Your top risk is Amoxicillin 500mg (will stock out by Friday).' Rahim reads this in 10 seconds and already knows what to focus on."
  ));

  out.push(bodyPara(
    "He scrolls down to the Big Sales Spike Predictions. Three products are listed: Napa Extra (340 percent spike, driven by Eid food poisoning trends), Seclo (220 percent spike, driven by Eid overeating heartburn), and Oral Saline (180 percent spike, driven by Eid dehydration). Each prediction shows the historical basis: 'Last year, Eid week: Napa Extra sold 880 boxes vs. normal 200 boxes.'"
  ));

  out.push(bodyPara(
    "He scrolls to the Top 20 High-Potential Items table. He scans the 'Recommended Purchase Qty' column and sees 6 products flagged in red with 'ORDER NOW' status. He opens his supplier contacts and starts drafting order messages. The report has already told him which supplier to order from and the exact quantity. What used to be a 2-hour Monday morning task (reviewing stock, guessing what to order, calling suppliers) is now a 15-minute task."
  ));

  out.push(bodyPara(
    "Rahim forwards the report to his junior pharmacist with a note: 'Order everything in red by 10 AM.' He forwards it to his Square Pharmaceuticals rep with a note: 'Need 680 boxes of Napa Extra by Wednesday.' The rep replies in 5 minutes: 'Confirmed, dispatching today.' Rahim has now used InventoryOS for 20 minutes on a Monday morning, and it has saved him 100 minutes. He will not cancel this subscription."
  ));

  return out;
}

function buildHighLevelFlow() {
  const out = [];
  out.push(h1("3. How It Works \u2014 High-Level Flow"));

  out.push(bodyPara(
    "This section traces the complete journey of a single report, from schedule trigger to client inbox. Understanding this flow is essential before reading the detailed technical sections that follow."
  ));

  out.push(h2("3.1 The 8-Step Flow"));

  out.push(bodyPara(
    "Step 1 \u2014 Cron job fires. A background cron job named report-schedule-checker runs every 15 minutes. It queries the ReportSchedule table for all active schedules where the current time has passed the next scheduled run date. For example, if a schedule is set to run every Monday at 6:00 AM, the checker at 6:00 AM on Monday will pick it up."
  ));

  out.push(bodyPara(
    "Step 2 \u2014 Load target client list. For each due schedule, the system determines which businesses should receive a report. If targetClientMode is 'all', all active businesses on the platform are included. If 'selected', only the businesses in targetClientIds are included. A typical schedule might target 5, 50, or 500 businesses."
  ));

  out.push(bodyPara(
    "Step 3 \u2014 Create pending report rows. For each target business, a GeneratedReport row is created with status 'pending'. This separates schedule detection from report generation \u2014 a slow AI call for one business will not block report creation for the others. The pending rows are picked up by a separate worker."
  ));

  out.push(bodyPara(
    "Step 4 \u2014 Report generator worker picks up pending rows. A second cron job named report-generator-worker runs every 5 minutes. It queries for GeneratedReport rows with status 'pending', takes the first N (configurable batch size, default 10), and processes them. For each report, it calls the AI prediction algorithm (Section 6) which gathers the business's 1-year sales data, current stock levels, and upcoming occasions, runs the 5-step prediction, and calls GLM-4 to synthesize the report content."
  ));

  out.push(bodyPara(
    "Step 5 \u2014 AI generates the report. The AI receives structured data (not raw queries) and returns a JSON object with four sections: executiveSummary, spikePredictions, topItems (array of 20), stockRisks. The system saves this JSON to the GeneratedReport row, marks status 'completed', and records aiTokensUsed and aiCostEstimate for cost tracking."
  ));

  out.push(bodyPara(
    "Step 6 \u2014 Delivery queued. Once a report is completed, the system creates ReportDelivery rows for each configured channel (email, WhatsApp). If the schedule has deliveryChannels = ['email', 'whatsapp'], two delivery rows are created per business. Each row has status 'queued'."
  ));

  out.push(bodyPara(
    "Step 7 \u2014 Delivery worker sends. A third cron job named report-delivery-worker runs every 1 minute. It picks up 'queued' delivery rows, sends them via the appropriate channel (SMTP for email, WhatsApp Business API for WhatsApp), and updates status to 'sent'. For email, a PDF version of the report is attached. For WhatsApp, a template message is sent with a link to the full report (or a PDF document attachment, depending on WhatsApp template approval)."
  ));

  out.push(bodyPara(
    "Step 8 \u2014 Status tracking and retry. The delivery worker tracks status transitions: queued \u2192 sent \u2192 delivered \u2192 read (for WhatsApp) or queued \u2192 sent \u2192 opened (for email, via a tracking pixel). If a delivery fails, the worker retries up to 3 times with exponential backoff (1 minute, 5 minutes, 15 minutes). After 3 failures, the delivery is marked 'failed' and an alert is sent to the founder via the existing kill-switch notification recipients."
  ));

  out.push(h2("3.2 Edge Cases & Fallbacks"));

  out.push(bodyPara(
    "Three edge cases deserve special handling. First, what if a client has less than 1 year of historical data? The prediction algorithm uses whatever data is available (even 1 month) and applies industry benchmark multipliers for occasions. The report clearly states 'Prediction confidence: Low (less than 3 months of data)' so the client knows to take the numbers with a grain of salt. Second, what if the AI call fails (Z.ai outage, timeout, JSON parse error)? The system generates a deterministic fallback report using just the pre-computed numbers (no AI synthesis) \u2014 it shows the raw spike predictions and stock risks without the executive summary prose. The report is still useful, just less polished. Third, what if delivery fails permanently (wrong email, WhatsApp number not registered)? The delivery is marked 'failed' after 3 retries, the GeneratedReport is still saved (so the founder can view it in /admin), and the next week's report will be attempted again automatically."
  ));

  return out;
}

module.exports = {
  buildExecSummary,
  buildProductVision,
  buildHighLevelFlow,
};
