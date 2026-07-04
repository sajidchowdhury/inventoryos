// Subscription Management System — Body builder
const H = require("/home/z/my-project/inventoryos/scripts/ai-report-helpers");
const {
  P, c, NB, noBorders, allNoBorders, tableBorders,
  safeText, bodyPara, bodyParaRich, tr, h1, h2, h3,
  calloutPara, bulletItem, tableCaption, figureCaption,
  tcell, tcellRich, makeTable, spacer, imageBlock,
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType, TableLayoutType,
} = H;

function phaseOverviewTable() {
  return makeTable(
    ["Phase", "Theme", "Features", "Effort", "Status"],
    [
      [{ text: "P1", bold: true, fill: P.surface }, "Schema + Per-Shop Model", "New models + admin phone uniqueness + tier pricing", "1\u20132 sessions", "Pending"],
      [{ text: "P2", bold: true, fill: P.surface }, "Grace Period Lifecycle", "4-stage enforcement: active \u2192 read-only \u2192 data-wiped", "2 sessions", "Pending"],
      [{ text: "P3", bold: true, fill: P.surface }, "Manual Payments (bKash/Nagad)", "User submission + super-admin matching + auto-extend", "2 sessions", "Pending"],
      [{ text: "P4", bold: true, fill: P.surface }, "Super-Admin Monitoring", "Client-wise status dashboard + revenue tracking", "1\u20132 sessions", "Pending"],
      [{ text: "P5", bold: true, fill: P.surface }, "SSL Commerz + Toggle", "Gateway integration + payment-method toggle + annual billing", "1\u20132 sessions", "Pending"],
      [{ text: "P6", bold: true, fill: P.surface }, "Notifications + Polish", "In-app/email alerts + onboarding + edge cases", "1 session", "Pending"],
    ],
    [8, 22, 45, 15, 10]
  );
}

function featureCard(label, title, color) {
  return new Paragraph({
    spacing: { before: 160, after: 80, line: 312 },
    indent: { left: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: c(color || P.accent), space: 12 } },
    children: [
      new TextRun({ text: label.toUpperCase(), size: 16, bold: true, color: c(color || P.accent), font: { ascii: "Calibri" }, characterSpacing: 30 }),
      new TextRun({ text: "  \u2014  ", size: 18, color: c(P.secondary) }),
      new TextRun({ text: title, size: 22, bold: true, color: c(P.primary), font: { ascii: "Calibri" } }),
    ],
  });
}

function acceptanceCriteria(items) {
  return items.map((item) => new Paragraph({
    spacing: { line: 312, before: 0, after: 80 },
    indent: { left: 360, hanging: 240 },
    children: [
      new TextRun({ text: "\u2610  ", size: 22, color: c(P.accent), bold: true }),
      new TextRun({ text: item, size: 22, color: c(P.body), font: { ascii: "Calibri" } }),
    ],
  }));
}

function buildBody() {
  const out = [];

  // ── TOC ──
  out.push(new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: "Table of Contents", size: 32, bold: true, color: c(P.primary), font: { ascii: "Calibri" } })],
  }));
  out.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }));
  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("1. Executive Summary"));

  out.push(bodyPara(
    "InventoryOS currently has a basic subscription model: each Business has a subscriptionTier (free/pro/pro_ai), a subscriptionStatus (trial/active/suspended/cancelled), and a subscriptionEnd date. The hourly cron auto-suspends expired businesses. However, there is no per-shop billing workflow, no payment submission system, no grace-period enforcement beyond simple suspension, and no super-admin monitoring of revenue or client lifecycle stages. This document specifies a complete subscription management system that closes all those gaps."
  ));

  out.push(bodyPara(
    "The system follows the founder's per-shop billing model: a user (Mr. X) can own multiple businesses (Shop A, B, C), each with its own subscription. Mr. X pays per shop, not per user. Employees (E1, E2, E3) created by the admin use the shop's subscription \u2014 they don't need their own. When a shop's subscription expires, it enters a 4-stage grace period: active \u2192 read-only \u2192 data-wiped, with notifications at each transition. The founder (super-admin) monitors all clients from a dedicated panel showing subscription stage, expected revenue, and received revenue."
  ));

  out.push(h3("Key design decisions"));
  out.push(bulletItem("Per-shop billing: each Business has its own subscription invoice + payment history. Users are free (unlimited employees on Pro+ tiers)."));
  out.push(bulletItem("4-stage grace period: active \u2192 expiring_soon (7 days before end) \u2192 expired (7 days after, read-only mode) \u2192 data_wiped (14 days after, login + payment only). Soft-delete with 30-day recovery window before true purge."));
  out.push(bulletItem("Manual payment first (bKash/Nagad TRX ID matching), SSL Commerz in P5. Super-admin toggles which methods are active."));
  out.push(bulletItem("Auto-matching engine: user submits TRX ID + amount \u2192 super-admin uploads received TRX IDs \u2192 system auto-matches and extends subscription. Pending matches go to manual review."));
  out.push(bulletItem("Admin phone uniqueness: one phone number = one admin account. Prevents duplicate accounts and simplifies recovery."));
  out.push(bulletItem("3-tier pricing: Free (0), Pro (800 BDT/mo), Pro AI (1,500 BDT/mo). Annual billing: pay 10 months, get 12."));

  out.push(h3("Phase overview"));
  out.push(tableCaption("Table 1: Phase overview \u2014 themes, features, effort, and tracking status"));
  out.push(phaseOverviewTable());
  out.push(spacer(240));

  out.push(calloutPara(
    "Tracking: After this spec is approved, a new \u00a718 is added to PROJECT_CONTEXT.md. Each phase gets a status row updated as work completes. The worklog.md receives one entry per phase using the Task ID pattern subscription-p1 through subscription-p6.",
    P.aiAccent
  ));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 2. BD MARKET RESEARCH + PACKAGE RECOMMENDATION
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("2. Bangladesh Market Research + Package Recommendation"));

  out.push(h2("2.1 BD pharmacy software pricing landscape"));
  out.push(bodyPara(
    "Research into the Bangladesh pharmacy and POS software market reveals a price-sensitive landscape where bKash/Nagad dominate 80%+ of payments, annual billing is expected (typically 10-month pricing for 12 months), and free trials are standard practice. The table below summarizes competitor pricing."
  ));

  out.push(tableCaption("Table 2: BD pharmacy/POS software pricing comparison"));
  out.push(makeTable(
    ["Software", "Monthly (BDT)", "Annual (BDT)", "Notes"],
    [
      ["Easy Pharma", "800\u20131,200", "8,000\u201312,000", "Basic inventory + POS"],
      ["Pharmacom", "1,000\u20131,500", "10,000\u201315,000", "Mid-tier with reports"],
      ["Pharmacy Manager BD", "500\u2013800", "5,000\u20138,000", "Budget option"],
      ["General POS (Sheba, Sutra)", "500\u20132,000", "5,000\u201320,000", "Multi-vertical"],
      ["Enterprise pharmacy", "2,000\u20135,000", "Custom", "Chain pharmacies"],
    ],
    [25, 20, 20, 35]
  ));
  out.push(spacer(200));

  out.push(h2("2.2 Recommended 3-tier structure"));
  out.push(bodyPara(
    "Based on the market research and the AI cost structure (Z.ai charges ~0.03 BDT per 1K tokens; a heavy user consumes ~50K tokens/month = ~1.5 BDT cost), I recommend a 3-tier structure. Three tiers outperform two because: (a) a Free tier drives adoption in a price-sensitive market, (b) a mid-tier Pro captures established pharmacies who don't need AI, (c) a Pro AI tier covers the AI cost with healthy margin. The current codebase already has this 3-tier structure \u2014 only the prices change."
  ));

  out.push(tableCaption("Table 3: Recommended tier pricing (3-tier structure)"));
  out.push(makeTable(
    ["Tier", "Monthly", "Annual (2 months free)", "Products", "Users", "AI", "Target"],
    [
      [{ text: "Free", bold: true, color: P.accent }, "0 BDT", "0 BDT", "100", "1", "No", "Trial / adoption"],
      [{ text: "Pro", bold: true, color: P.accent }, "800 BDT", "8,000 BDT", "Unlimited", "5", "No", "Established pharmacy"],
      [{ text: "Pro AI", bold: true, color: P.accent }, "1,500 BDT", "15,000 BDT", "Unlimited", "Unlimited", "Full", "Power user"],
    ],
    [12, 13, 17, 13, 10, 8, 27]
  ));
  out.push(spacer(160));

  out.push(bodyPara(
    "Annual billing (pay 10, get 12) locks in customers and reduces monthly churn. The super-admin can edit these prices from the panel (P4). The current codebase prices (500/1000) are below market \u2014 the new prices (800/1500) are competitive with Easy Pharma and Pharmacom while giving AI margin."
  ));

  out.push(h2("2.3 Why not 2 tiers?"));
  out.push(bodyPara(
    "A 2-tier structure (Free + Pro AI only) would force every paying customer onto the AI tier at 1,500 BDT/month. This is 87% more expensive than the cheapest competitor (Pharmacy Manager BD at 800 BDT) and would lose price-sensitive pharmacies who don't want AI. The 3-tier structure lets pharmacies start at Pro (800 BDT, competitive) and upgrade to Pro AI (1,500 BDT) when they want AI features \u2014 a natural upsell path."
  ));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 3. CURRENT STATE + GAP ANALYSIS
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("3. Current State & Gap Analysis"));

  out.push(h2("3.1 What exists today"));
  out.push(bodyPara(
    "The Business model has subscriptionTier (free/pro/pro_ai), subscriptionStatus (trial/active/suspended/cancelled), subscriptionStart, and subscriptionEnd fields. The feature-gate.ts module maps tiers to limits (max products, AI enabled, multi-user). An hourly cron job (runHourlySubscriptionsJob) auto-suspends businesses whose subscriptionEnd has passed. A GET /api/businesses/[id]/subscription endpoint returns the current subscription state. There is no payment system, no invoice generation, no grace-period stages, no read-only enforcement, and no super-admin revenue monitoring."
  ));

  out.push(h2("3.2 The 8 gaps"));
  out.push(tableCaption("Table 4: Gap analysis with resolving phase"));
  out.push(makeTable(
    ["#", "Gap", "Impact", "Phase"],
    [
      ["1", "No per-shop billing workflow", "Can't collect payments or track who paid", "P1+P3"],
      ["2", "No payment submission system", "Users have no way to pay", "P3"],
      ["3", "No invoice generation", "No record of what's owed or paid", "P1"],
      ["4", "No grace-period stages (read-only, data-wipe)", "Expired users either work fully or are fully suspended \u2014 no middle ground", "P2"],
      ["5", "No read-only enforcement", "Suspended users can't view their historical data", "P2"],
      ["6", "No super-admin revenue monitoring", "Founder can't see expected vs received revenue", "P4"],
      ["7", "No auto-matching for bKash/Nagad TRX IDs", "Manual payment verification is error-prone", "P3"],
      ["8", "No SSL Commerz / payment-method toggle", "Only manual payment possible; no cards", "P5"],
    ],
    [6, 35, 45, 14]
  ));
  out.push(spacer(200));

  out.push(h2("3.3 The 4-stage grace period (founder's spec)"));
  out.push(bodyPara(
    "The founder specified a 4-stage subscription lifecycle that balances customer recovery with data protection. The system transitions businesses through these stages automatically via a daily cron job:"
  ));

  out.push(tableCaption("Table 5: 4-stage grace period lifecycle"));
  out.push(makeTable(
    ["Stage", "Timing", "What happens", "User experience"],
    [
      [{ text: "1. Active", bold: true, color: P.accent }, "Before subscriptionEnd", "Full access", "Everything works"],
      [{ text: "2. Expiring Soon", bold: true, color: "F59E0B" }, "7 days before end", "Full access + notification", "Banner: 'Pay within 7 days'"],
      [{ text: "3. Read-Only", bold: true, color: "EF4444" }, "0\u201314 days after end", "Can view reports but no sales/purchase/entry", "All write buttons disabled; banner: 'Data will be lost in 14 days'"],
      [{ text: "4. Data Wiped", bold: true, color: "6B7280" }, "14+ days after end", "Login works but no data \u2014 only payment option", "Empty dashboard + 'Pay to restore' screen. Data soft-deleted (recoverable 30 days)."],
    ],
    [18, 18, 32, 32]
  ));
  out.push(spacer(200));

  out.push(calloutPara(
    "Soft-delete recommendation: Stage 4 marks data as 'wiped' (hidden from queries) but keeps it in the DB for 30 days. If the user pays within 30 days, data is restored. After 30 days, a true purge runs. This protects against 'I paid but it didn't process' disputes.",
    P.aiAccent
  ));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 4. PHASE 1 — SCHEMA + PER-SHOP MODEL + ADMIN PHONE UNIQUENESS
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("4. Phase 1 \u2014 Schema + Per-Shop Model + Admin Phone Uniqueness"));

  out.push(h2("4.1 Rationale"));
  out.push(bodyPara(
    "Phase 1 builds the data foundation: new models for subscription invoices + payment transactions, updated Business fields for the 4-stage lifecycle, admin phone number uniqueness, and the updated 3-tier pricing. No user-facing behavior changes yet \u2014 just the schema + config that later phases build on."
  ));

  out.push(h2("4.2 Scope"));

  out.push(featureCard("Feature 1.1", "New Prisma models for billing", P.accent));
  out.push(bodyPara(
    "SubscriptionInvoice: one per billing period per business (monthly or annual). Fields: id, businessId, tier, billingPeriod (month/year), amount, status (pending/paid/overdue/cancelled), dueDate, paidAt, paymentMethod, createdAt. Generated automatically by a monthly cron or on-demand from the super-admin panel."
  ));
  out.push(bodyPara(
    "PaymentTransaction: one per payment attempt. Fields: id, businessId, invoiceId, method (bkash/nagad/ssl_commerz/manual), trxId, amount, status (pending/matched/rejected/refunded), submittedBy (user phone), submittedAt, matchedAt, matchedBy (super-admin id), notes. The auto-matching engine (P3) updates status from pending to matched."
  ));
  out.push(bodyPara(
    "ReceivedPayment: super-admin's record of money received in bKash/Nagad. Fields: id, method, trxId, amount, receivedAt, uploadedBy (super-admin id), matchedTransactionId (nullable \u2014 set when a user submission matches). The super-admin uploads these via the panel (P3)."
  ));

  out.push(featureCard("Feature 1.2", "Updated Business model for 4-stage lifecycle", P.accent));
  out.push(bodyPara(
    "Add fields to Business: subscriptionStage (active/expiring_soon/read_only/data_wiped \u2014 computed from subscriptionEnd + cron), gracePeriodEnd (14 days after subscriptionEnd), dataWipeDate (subscriptionEnd + 14 days), dataSoftDeletedAt (nullable \u2014 set when stage 4 begins), dataPurgeDate (dataSoftDeletedAt + 30 days). The nightly cron (P2) transitions these stages."
  ));

  out.push(featureCard("Feature 1.3", "Admin phone uniqueness", P.accent));
  out.push(bodyPara(
    "Update the registration flow: when a user selects 'I have a business' and enters their phone number, the system checks if that phone is already an admin on another business. If yes, the user must log in as that admin (not create a new account). If no, a new admin account is created. Phone number becomes the unique identifier for admin accounts. This prevents duplicate accounts and simplifies recovery (one phone = one admin, regardless of how many shops they own)."
  ));

  out.push(featureCard("Feature 1.4", "Updated 3-tier pricing in feature-gate.ts", P.accent));
  out.push(bodyPara(
    "Update TIER_CONFIGS: free (0 BDT, 100 products, 1 user, no AI), pro (800 BDT, unlimited products, 5 users, no AI), pro_ai (1,500 BDT, unlimited products, unlimited users, full AI). Add annualPrice field (8,000 / 15,000 BDT). The super-admin can edit these prices from the panel (P4)."
  ));

  out.push(h2("4.3 Schema changes"));
  out.push(tableCaption("Table 6: P1 Prisma schema additions"));
  out.push(makeTable(
    ["Model", "New fields/relations", "Purpose"],
    [
      ["SubscriptionInvoice (NEW)", "id, businessId, tier, billingPeriod, amount, status, dueDate, paidAt, paymentMethod, createdAt", "Monthly/annual billing record per business"],
      ["PaymentTransaction (NEW)", "id, businessId, invoiceId, method, trxId, amount, status, submittedBy, submittedAt, matchedAt, matchedBy, notes", "User payment submissions"],
      ["ReceivedPayment (NEW)", "id, method, trxId, amount, receivedAt, uploadedBy, matchedTransactionId", "Super-admin's received money log"],
      ["Business (update)", "+subscriptionStage, +gracePeriodEnd, +dataWipeDate, +dataSoftDeletedAt, +dataPurgeDate", "4-stage lifecycle tracking"],
      ["BusinessUser (update)", "+isAdmin (Boolean, default false for employees)", "Distinguish admin (owner) from employees"],
    ],
    [22, 48, 30]
  ));
  out.push(spacer(160));

  out.push(h2("4.4 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "SubscriptionInvoice model created with all fields + relations",
    "PaymentTransaction model created with status enum (pending/matched/rejected/refunded)",
    "ReceivedPayment model created with matchedTransactionId nullable relation",
    "Business model has subscriptionStage, gracePeriodEnd, dataWipeDate, dataSoftDeletedAt, dataPurgeDate fields",
    "BusinessUser has isAdmin field (default false)",
    "feature-gate.ts updated: free=0, pro=800, pro_ai=1500, annualPrice field added",
    "Registration flow checks phone uniqueness for admin accounts (returns error if phone already an admin)",
    "prisma db push + generate run successfully",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 5. PHASE 2 — GRACE PERIOD LIFECYCLE + ENFORCEMENT
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("5. Phase 2 \u2014 Grace Period Lifecycle + Read-Only Enforcement"));

  out.push(h2("5.1 Rationale"));
  out.push(bodyPara(
    "Phase 2 implements the 4-stage subscription lifecycle: active \u2192 expiring_soon \u2192 read_only \u2192 data_wiped. A daily cron job transitions businesses between stages based on their subscriptionEnd date. A server-side guard blocks write operations (sales, purchases, stock entries) when a business is in read-only or data_wiped stage. Notifications fire at each transition."
  ));

  out.push(h2("5.2 Scope"));

  out.push(featureCard("Feature 2.1", "Daily subscription-lifecycle cron job", P.accent));
  out.push(bodyPara(
    "New cron job subscription-lifecycle runs daily at 02:00 UTC. For each business: (a) if subscriptionEnd is within 7 days \u2192 set stage to expiring_soon + send notification, (b) if subscriptionEnd has passed \u2192 set stage to read_only + send 'data loss in 14 days' notification, (c) if 14 days past subscriptionEnd \u2192 set stage to data_wiped + soft-delete data (mark dataSoftDeletedAt) + send final notification, (d) if 30 days past dataSoftDeletedAt \u2192 true purge (delete all business data except the Business row itself + payment history)."
  ));

  out.push(featureCard("Feature 2.2", "Server-side read-only guard", P.amber));
  out.push(bodyPara(
    "New middleware function requireActiveSubscription(businessId) called at the top of every write endpoint (POST/PUT/DELETE on sales, purchases, batches, stock, products, customers, suppliers). If the business is in read_only or data_wiped stage, returns 403 with a clear message: 'Subscription expired. Pay to restore full access.' Reports + export endpoints remain accessible. The client UI also disables write buttons (client-side), but the server guard is the real enforcement."
  ));

  out.push(featureCard("Feature 2.3", "Client-side UI adaptation", P.accent));
  out.push(bodyPara(
    "When a business is in read_only stage: all 'Add', 'Sell', 'Purchase', 'Dispense' buttons are replaced with a disabled state + tooltip 'Subscription expired \u2014 pay to restore'. A persistent banner shows at the top of every screen: 'Your subscription expired on {date}. Data will be permanently lost in {N} days. Pay now to restore.' When in data_wiped stage: the dashboard shows only the payment screen + 'Your data was archived on {date}. Pay within {N} days to restore.'"
  ));

  out.push(featureCard("Feature 2.4", "Soft-delete + recovery", P.amber));
  out.push(bodyPara(
    "When stage transitions to data_wiped, set dataSoftDeletedAt = now. All product/batch/sale/purchase/customer queries filter out businesses with dataSoftDeletedAt set (unless the request is from the super-admin panel or a payment-restore endpoint). If the user pays within 30 days, a restore endpoint clears dataSoftDeletedAt + resets subscriptionStage to active + extends subscriptionEnd. After 30 days, the nightly cron purges all data except the Business row + SubscriptionInvoice + PaymentTransaction (kept for audit)."
  ));

  out.push(h2("5.3 Schema changes"));
  out.push(bodyPara("None beyond P1 (the fields added in P1 are used here)."));

  out.push(h2("5.4 API + cron changes"));
  out.push(tableCaption("Table 7: P2 API + cron changes"));
  out.push(makeTable(
    ["Component", "Change", "Purpose"],
    [
      ["CRON_JOB_NAMES", "+ SUBSCRIPTION_LIFECYCLE: 'subscription-lifecycle'", "New daily job"],
      ["CRON_JOB_SCHEDULES", "schedule: '0 2 * * *' (02:00 UTC daily)", "Daily stage transitions"],
      ["cron-jobs.ts", "New runSubscriptionLifecycleJob() function", "Stage transitions + notifications + purge"],
      ["src/lib/subscription-guard.ts (NEW)", "requireActiveSubscription(businessId) helper", "Server-side read-only enforcement"],
      ["All write API routes", "Add requireActiveSubscription() call at top", "Block writes in read_only/data_wiped"],
      ["POST /api/businesses/[id]/restore-data (NEW)", "Restore soft-deleted data after payment", "Recovery within 30-day window"],
    ],
    [30, 40, 30]
  ));
  out.push(spacer(160));

  out.push(h2("5.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "Daily cron job transitions businesses through 4 stages based on subscriptionEnd",
    "Businesses 7 days before expiry get 'expiring_soon' stage + notification",
    "Businesses past expiry get 'read_only' stage + 'data loss in 14 days' notification",
    "Businesses 14 days past expiry get 'data_wiped' stage + soft-delete + final notification",
    "Write endpoints (sales, purchases, batches, stock) return 403 in read_only/data_wiped stages",
    "Report + export endpoints remain accessible in all stages",
    "Client UI disables write buttons + shows persistent banner in read_only stage",
    "Data-wiped businesses see only payment screen on login",
    "Soft-deleted data is restorable within 30 days via restore endpoint",
    "True purge runs after 30 days (keeps Business + invoices + payments for audit)",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 6. PHASE 3 — MANUAL PAYMENTS (bKash/Nagad)
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("6. Phase 3 \u2014 Manual Payments (bKash/Nagad)"));

  out.push(h2("6.1 Rationale"));
  out.push(bodyPara(
    "Phase 3 implements the manual payment workflow: user selects bKash or Nagad, sends money to the super-admin's account, enters the TRX ID + amount in the app. The super-admin uploads received TRX IDs + amounts from their bKash/Nagad statement. The auto-matching engine matches user submissions to received payments by TRX ID + amount (\u00b15 BDT tolerance). On match, the subscription is auto-extended."
  ));

  out.push(h2("6.2 Scope"));

  out.push(featureCard("Feature 3.1", "User payment submission", P.accent));
  out.push(bodyPara(
    "New page in the pharmacy UI: 'Pay Subscription'. Shows the current invoice (amount due, due date), a method selector (bKash / Nagad \u2014 only methods enabled by super-admin), the super-admin's bKash/Nagad account number (configurable from admin panel), and a form: TRX ID (10 chars) + amount + optional note. On submit, creates a PaymentTransaction with status='pending'. Shows pending submissions + payment history."
  ));

  out.push(featureCard("Feature 3.2", "Super-admin received-payments panel", P.accent));
  out.push(bodyPara(
    "New section in /admin: 'Received Payments'. The super-admin enters TRX IDs + amounts they received in bKash/Nagad (can bulk-paste from their statement). Each entry creates a ReceivedPayment row. The panel shows: all received payments, which are matched (matchedTransactionId set) vs unmatched, and a list of pending user submissions awaiting match."
  ));

  out.push(featureCard("Feature 3.3", "Auto-matching engine", P.aiAccent));
  out.push(bodyPara(
    "When a super-admin uploads a ReceivedPayment, the system searches for a pending PaymentTransaction with the same TRX ID + amount (\u00b15 BDT tolerance). If found: set PaymentTransaction.status='matched', set ReceivedPayment.matchedTransactionId, extend the business's subscriptionEnd by 1 month (or 1 year for annual), set subscriptionStage='active', create a SubscriptionInvoice with status='paid'. If no match: the received payment stays unmatched (super-admin can manually review pending submissions)."
  ));

  out.push(featureCard("Feature 3.4", "Manual review for unmatched submissions", P.amber));
  out.push(bodyPara(
    "If a user submits a TRX ID that doesn't match any received payment (typo, wrong amount, or super-admin hasn't uploaded yet), the submission stays 'pending'. The super-admin panel shows all pending submissions with a 'Match manually' button \u2014 the super-admin can link it to a received payment or reject it with a reason. This prevents false rejections from TRX ID typos."
  ));

  out.push(h2("6.3 Schema changes"));
  out.push(bodyPara("None beyond P1 (uses PaymentTransaction + ReceivedPayment + SubscriptionInvoice from P1)."));

  out.push(h2("6.4 API changes"));
  out.push(tableCaption("Table 8: P3 API changes"));
  out.push(makeTable(
    ["Route", "Method", "Purpose"],
    [
      ["/api/businesses/[id]/subscription/pay", "POST", "User submits bKash/Nagad TRX ID + amount"],
      ["/api/businesses/[id]/subscription/payments", "GET", "User's payment history"],
      ["/api/super-admin/received-payments", "GET/POST", "Super-admin uploads received TRX IDs"],
      ["/api/super-admin/received-payments/[id]/match", "POST", "Manually match a received payment to a pending submission"],
      ["/api/super-admin/pending-payments", "GET", "List pending user submissions for manual review"],
      ["/api/super-admin/payments/[id]/reject", "POST", "Reject a pending submission with reason"],
    ],
    [42, 13, 45]
  ));
  out.push(spacer(160));

  out.push(h2("6.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "User sees current invoice (amount + due date) + bKash/Nagad account numbers on Pay Subscription page",
    "User can submit TRX ID (10 chars) + amount + optional note \u2014 creates pending PaymentTransaction",
    "Super-admin can upload received TRX IDs + amounts (single or bulk paste) from /admin",
    "Auto-matching: TRX ID + amount (\u00b15 BDT) match \u2192 status='matched' + subscription extended",
    "On match: subscriptionEnd extended by 1 month (or 1 year for annual), stage reset to 'active'",
    "Unmatched submissions appear in super-admin 'Pending Payments' list for manual review",
    "Super-admin can manually match or reject pending submissions with a reason",
    "User sees payment history (pending + matched + rejected) on the Pay Subscription page",
    "TRX ID tolerance: exact match first, then \u00b15 BDT amount tolerance, then manual review",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 7. PHASE 4 — SUPER-ADMIN MONITORING DASHBOARD
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("7. Phase 4 \u2014 Super-Admin Monitoring Dashboard"));

  out.push(h2("7.1 Rationale"));
  out.push(bodyPara(
    "Phase 4 gives the founder a single dashboard to monitor every client's subscription stage, expected revenue, and received revenue. The founder can see at a glance: how many businesses are active, expiring, read-only, or data-wiped; how much money is expected this month; how much has been received; how much is outstanding. Per-client detail shows the full subscription timeline + payment history."
  ));

  out.push(h2("7.2 Scope"));

  out.push(featureCard("Feature 4.1", "Client list with subscription stage badges", P.accent));
  out.push(bodyPara(
    "New page at /admin/clients: searchable, filterable table of all businesses. Columns: business name, owner phone, tier, stage (color-coded badge: green=active, amber=expiring_soon, red=read_only, gray=data_wiped), subscriptionEnd, monthly amount, last payment date, status (paid/pending/overdue). Filter by stage, tier, or payment status. Search by name or phone."
  ));

  out.push(featureCard("Feature 4.2", "Revenue summary cards", P.accent));
  out.push(bodyPara(
    "Top of /admin/clients: 4 summary cards. (1) Monthly Expected: sum of all active businesses' tier prices. (2) Monthly Received: sum of matched PaymentTransactions this month. (3) Outstanding: expected minus received. (4) Churn Risk: count of businesses in expiring_soon + read_only stages (potential revenue loss). Below the cards: a simple bar chart of received vs expected over the last 6 months."
  ));

  out.push(featureCard("Feature 4.3", "Client detail view", P.accent));
  out.push(bodyPara(
    "Clicking a client opens a detail page: business info, subscription timeline (visual timeline of stage transitions), payment history (all PaymentTransactions + ReceivedPayments), expected vs received for this client, quick actions (extend subscription manually, change tier, override stage, send payment reminder)."
  ));

  out.push(featureCard("Feature 4.4", "Package price management", P.accent));
  out.push(bodyPara(
    "New section in /admin: 'Packages'. The founder can edit tier prices (monthly + annual), toggle which payment methods are active (bKash/Nagad/SSL Commerz \u2014 P5 adds SSL), and set the bKash/Nagad account numbers that users see on the Pay Subscription page. Changes take effect immediately for new invoices."
  ));

  out.push(h2("7.3 Schema changes"));
  out.push(bodyPara("None beyond P1. Uses existing models + the new billing models."));

  out.push(h2("7.4 API changes"));
  out.push(tableCaption("Table 9: P4 API changes"));
  out.push(makeTable(
    ["Route", "Method", "Purpose"],
    [
      ["/api/super-admin/clients", "GET", "List all businesses with subscription stage + revenue"],
      ["/api/super-admin/clients/[id]", "GET", "Client detail: timeline + payments + expected/received"],
      ["/api/super-admin/clients/[id]/extend", "POST", "Manually extend subscription (admin override)"],
      ["/api/super-admin/revenue-summary", "GET", "Monthly expected, received, outstanding, churn risk"],
      ["/api/super-admin/packages", "GET/PUT", "Edit tier prices + payment method toggles + account numbers"],
    ],
    [38, 14, 48]
  ));
  out.push(spacer(160));

  out.push(h2("7.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "/admin/clients shows all businesses with color-coded stage badges",
    "Filter by stage (active/expiring_soon/read_only/data_wiped) + tier + payment status",
    "Search by business name or owner phone",
    "4 revenue summary cards: Monthly Expected, Monthly Received, Outstanding, Churn Risk",
    "6-month received vs expected bar chart",
    "Client detail page shows subscription timeline + payment history",
    "Founder can manually extend a subscription from the client detail page",
    "Founder can edit tier prices (monthly + annual) from /admin/packages",
    "Founder can toggle active payment methods (bKash/Nagad) + set account numbers",
    "Changes to package prices apply to new invoices immediately",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 8. PHASE 5 — SSL COMMERZ + PAYMENT METHOD TOGGLE
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("8. Phase 5 \u2014 SSL Commerz + Payment Method Toggle + Annual Billing"));

  out.push(h2("8.1 Rationale"));
  out.push(bodyPara(
    "Phase 5 adds SSL Commerz (card payments) alongside the manual bKash/Nagad system. The super-admin chooses which payment methods are active from the panel. SSL Commerz payments are instant (no TRX ID matching needed) \u2014 the gateway callback auto-extends the subscription on success. Annual billing (pay 10, get 12) is also added as a billing-period option."
  ));

  out.push(h2("8.2 Scope"));

  out.push(featureCard("Feature 5.1", "SSL Commerz gateway integration", P.accent));
  out.push(bodyPara(
    "Integrate the SSL Commerz sandbox (test) + production API. New endpoint POST /api/businesses/[id]/subscription/pay/ssl initiates a payment session: calls SSL Commerz EasyCheckout with the invoice amount + business info, returns the gateway URL. SSL Commerz sends callbacks to POST /api/payment/ssl/success + POST /api/payment/ssl/fail + POST /api/payment/ssl/cancel. On success callback: verify the transaction with SSL Commerz's validation API, then auto-extend the subscription (same as a matched manual payment)."
  ));

  out.push(featureCard("Feature 5.2", "Payment method toggle", P.accent));
  out.push(bodyPara(
    "The super-admin panel (P4 /packages) has toggles for each payment method: bKash (manual), Nagad (manual), SSL Commerz (cards). Only enabled methods appear on the user's Pay Subscription page. The founder can enable SSL Commerz only, manual only, or both side by side. SSL Commerz requires API keys (store_id + store_passwd) configured via env vars or the admin panel."
  ));

  out.push(featureCard("Feature 5.3", "Annual billing option", P.accent));
  out.push(bodyPara(
    "On the Pay Subscription page, the user sees two billing period options: Monthly (1 month, 800/1500 BDT) and Annual (12 months for the price of 10: 8,000/15,000 BDT). Selecting annual generates a SubscriptionInvoice with billingPeriod='year' + amount=annualPrice. On payment (manual match or SSL success), subscriptionEnd extends by 12 months instead of 1."
  ));

  out.push(featureCard("Feature 5.4", "SSL Commerz config in admin panel", P.accent));
  out.push(bodyPara(
    "New section in /admin: 'SSL Commerz Configuration'. Fields: store_id, store_passwd, mode (sandbox/production), callback URL. Test button initiates a 10 BDT test transaction. The config is stored in the SmtpConfig-style table (or a new PaymentConfig table) so the founder can change it without redeploying."
  ));

  out.push(h2("8.3 Schema changes"));
  out.push(tableCaption("Table 10: P5 schema additions"));
  out.push(makeTable(
    ["Model", "Fields", "Purpose"],
    [
      ["PaymentConfig (NEW)", "id, sslStoreId, sslStorePasswd, sslMode, activeMethods (Json), bkashNumber, nagadNumber, updatedAt", "Admin-editable payment config"],
      ["SubscriptionInvoice (update)", "+billingPeriod already in P1", "Already supports 'month' / 'year'"],
    ],
    [25, 50, 25]
  ));
  out.push(spacer(160));

  out.push(h2("8.4 API changes"));
  out.push(tableCaption("Table 11: P5 API changes"));
  out.push(makeTable(
    ["Route", "Method", "Purpose"],
    [
      ["/api/businesses/[id]/subscription/pay/ssl", "POST", "Initiate SSL Commerz payment session"],
      ["/api/payment/ssl/success", "POST", "SSL Commerz success callback"],
      ["/api/payment/ssl/fail", "POST", "SSL Commerz failure callback"],
      ["/api/payment/ssl/cancel", "POST", "SSL Commerz cancel callback"],
      ["/api/super-admin/payment-config", "GET/PUT", "Edit SSL Commerz config + active methods + account numbers"],
    ],
    [40, 13, 47]
  ));
  out.push(spacer(160));

  out.push(h2("8.5 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "SSL Commerz payment session initiates with correct amount + business info",
    "SSL Commerz success callback verifies transaction + auto-extends subscription",
    "SSL Commerz fail/cancel callbacks handle gracefully (no subscription change)",
    "Super-admin can toggle bKash/Nagad/SSL Commerz on/off from /admin",
    "User's Pay Subscription page shows only enabled payment methods",
    "Annual billing option (pay 10, get 12) available for both manual + SSL",
    "Annual payment extends subscriptionEnd by 12 months",
    "SSL Commerz config (store_id, store_passwd, mode) editable from /admin",
    "Test transaction button in admin verifies SSL Commerz config",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 9. PHASE 6 — NOTIFICATIONS + POLISH
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("9. Phase 6 \u2014 Notifications + Polish + Edge Cases"));

  out.push(h2("9.1 Rationale"));
  out.push(bodyPara(
    "Phase 6 adds the notification system for all subscription events, first-time onboarding for the payment page, edge-case handling (refunds, partial payments, plan changes), and super-admin documentation. This phase ensures the subscription system is production-ready and the founder + users know what to expect at each stage."
  ));

  out.push(h2("9.2 Scope"));

  out.push(featureCard("Feature 6.1", "Subscription event notifications", P.accent));
  out.push(bodyPara(
    "NotificationLog entries (in-app) + optional emails for: (a) invoice generated (7 days before due), (b) payment received (matched/SSL success), (c) subscription expiring soon (7 days before end), (d) subscription expired + read-only mode entered, (e) data wipe warning (7 days before wipe), (f) data wiped (stage 4 entered), (g) data restored after payment. Each notification is per-business (shop-wise as the founder specified)."
  ));

  out.push(featureCard("Feature 6.2", "First-time payment onboarding", P.accent));
  out.push(bodyPara(
    "When a trial business first approaches the subscription end, a one-time tooltip highlights the 'Subscription' page + explains the billing cycle. A dismissible banner on the dashboard shows: 'Your free trial ends in {N} days. Subscribe now to keep full access.' with a 'Subscribe' CTA."
  ));

  out.push(featureCard("Feature 6.3", "Refund + adjustment handling", P.amber));
  out.push(bodyPara(
    "Super-admin can issue a refund from the client detail page: sets PaymentTransaction.status='refunded', reverses the subscription extension (shortens subscriptionEnd by the refunded period), logs the refund reason. Super-admin can also make manual adjustments (extend/reduce subscription by N days) with a required reason field. All refunds + adjustments are logged in a SubscriptionAdjustment model for audit."
  ));

  out.push(featureCard("Feature 6.4", "Plan changes (upgrade/downgrade)", P.accent));
  out.push(bodyPara(
    "User can upgrade (Free\u2192Pro, Pro\u2192Pro AI) or downgrade (Pro AI\u2192Pro) from the Subscription page. Upgrades: prorate the remaining days, charge the difference, extend subscriptionEnd. Downgrades: take effect at the next billing cycle (no immediate change, no refund). Plan changes create a new SubscriptionInvoice for the prorated amount."
  ));

  out.push(featureCard("Feature 6.5", "SuperAdminHelp entries", P.accent));
  out.push(bodyPara(
    "Add help entries for: Subscription Lifecycle (4 stages), Manual Payment Matching (bKash/Nagad), SSL Commerz Configuration, Package Price Management, Client Monitoring Dashboard, Refunds + Adjustments. Each entry follows the existing whatItIs/whatHappensIfNotSet/whyYouNeedIt/howToUse format."
  ));

  out.push(h2("6.3 Schema changes"));
  out.push(tableCaption("Table 12: P6 schema additions"));
  out.push(makeTable(
    ["Model", "Fields", "Purpose"],
    [
      ["SubscriptionAdjustment (NEW)", "id, businessId, type (refund/extension/reduction), daysAdjusted, amount, reason, createdBy, createdAt", "Audit trail for manual changes"],
    ],
    [25, 55, 20]
  ));
  out.push(spacer(160));

  out.push(h2("6.4 Acceptance criteria"));
  out.push(...acceptanceCriteria([
    "In-app notifications fire at each subscription stage transition",
    "Emails sent for stage transitions if ownerEmail + SMTP configured",
    "All notifications are per-business (shop-wise)",
    "First-time tooltip highlights Subscription page when trial nears end",
    "Dismissible trial-ending banner on dashboard with Subscribe CTA",
    "Super-admin can issue refunds from client detail page",
    "Refunds reverse the subscription extension + log the reason",
    "Super-admin can make manual adjustments (extend/reduce) with required reason",
    "User can upgrade tier (prorated charge + immediate effect)",
    "Downgrades take effect at next billing cycle (no immediate change)",
    "All adjustments + refunds logged in SubscriptionAdjustment for audit",
    "SuperAdminHelp has 6 new entries covering all subscription features",
  ]));

  out.push(new Paragraph({ children: [new PageBreak()] }));

  // ════════════════════════════════════════════════════════════════════════
  // 10. IMPLEMENTATION TRACKING
  // ════════════════════════════════════════════════════════════════════════
  out.push(h1("10. Implementation Tracking"));

  out.push(h2("10.1 Phase status"));
  out.push(bodyPara(
    "The table below is the single source of truth for subscription system progress. It is duplicated in PROJECT_CONTEXT.md \u00a718 so any agent starting a new session can see the current state at a glance."
  ));
  out.push(tableCaption("Table 13: Phase status tracker"));
  out.push(phaseOverviewTable());
  out.push(spacer(240));

  out.push(h2("10.2 Worklog protocol"));
  out.push(bodyPara(
    "Each phase gets one worklog.md entry on completion, using the Task ID pattern subscription-pN (where N is the phase number). The entry follows the standard template (Task ID / Agent / Task / Work Log / Stage Summary) and must reference this spec doc. After committing a phase, update the status column in Table 13 above and in PROJECT_CONTEXT.md \u00a718 to 'Done' with the tag."
  ));

  out.push(h2("10.3 Commit + tag convention"));
  out.push(bulletItem("Commit message: feat(subscription): P1 \u2014 schema + per-shop model + admin phone uniqueness"));
  out.push(bulletItem("Tag on phase completion: v1.8.0-subscription-p1, v1.8.1-subscription-p2, etc."));
  out.push(bulletItem("All changes go through the pre-push guardrail (scripts/pre-push-check.sh) per DEPLOYMENT_WORKFLOW.md"));

  out.push(h2("10.4 Sequencing dependencies"));
  out.push(bodyPara(
    "Phases are strictly sequential \u2014 each builds on the previous:"
  ));
  out.push(bulletItem("P2 (lifecycle) depends on P1 (schema) \u2014 the stage fields + cron use the P1 models"));
  out.push(bulletItem("P3 (payments) depends on P1 (schema) + P2 (lifecycle) \u2014 payments extend subscriptions which use the stage system"));
  out.push(bulletItem("P4 (monitoring) depends on P1+P2+P3 \u2014 the dashboard shows stages + payments from all prior phases"));
  out.push(bulletItem("P5 (SSL Commerz) depends on P3 (payments) \u2014 SSL uses the same SubscriptionInvoice + extension logic"));
  out.push(bulletItem("P6 (polish) depends on all prior phases \u2014 notifications + onboarding reference the full system"));
  out.push(calloutPara(
    "Recommended order: P1 \u2192 P2 \u2192 P3 \u2192 P4 \u2192 P5 \u2192 P6. No parallelism \u2014 each phase's output is the next phase's input.",
    P.aiAccent
  ));

  out.push(h2("10.5 Estimated total effort"));
  out.push(tableCaption("Table 14: Effort estimate per phase"));
  out.push(makeTable(
    ["Phase", "Sessions", "Notes"],
    [
      ["P1", "1\u20132", "Schema + config. Largest schema phase."],
      ["P2", "2", "Cron + server guard + client UI adaptation. Largest enforcement phase."],
      ["P3", "2", "Payment submission + matching engine. Core business logic."],
      ["P4", "1\u20132", "Dashboard + client detail. UI-heavy."],
      ["P5", "1\u20132", "SSL Commerz integration. Requires SSL Commerz account."],
      ["P6", "1", "Notifications + onboarding + edge cases"],
      [{ text: "Total", bold: true, fill: P.surface }, { text: "8\u201311 sessions", bold: true, fill: P.surface }, { text: "Approx 2\u20133 weeks of part-time work", fill: P.surface }],
    ],
    [15, 20, 65]
  ));

  out.push(h2("10.6 Risk + mitigation"));
  out.push(tableCaption("Table 15: Key risks and mitigations"));
  out.push(makeTable(
    ["Risk", "Likelihood", "Mitigation"],
    [
      ["Data wipe is permanent + disputed", "High", "Soft-delete with 30-day recovery window before true purge"],
      ["bKash TRX ID typos cause false rejections", "High", "Auto-match with \u00b15 BDT tolerance + manual review queue for unmatched"],
      ["SSL Commerz callback fails silently", "Medium", "Daily reconciliation cron: check pending SSL sessions vs received callbacks"],
      ["Read-only enforcement bypassed via direct API", "Medium", "Server-side guard on every write endpoint (not just client UI)"],
      ["Subscription cron misses a transition", "Low", "Idempotent cron + manual stage override in super-admin panel"],
      ["Price change breaks existing subscriptions", "Low", "Price changes apply to new invoices only; existing subscriptions keep their price until renewal"],
    ],
    [35, 15, 50]
  ));

  return out;
}

module.exports = { buildBody, phaseOverviewTable };
