// Feature Catalog Body Part 4: Dashboards + Reports + Expiry + AI Features + Alerts + User/Sub + Audit + Summary
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType, PageBreak,
} = H;

function buildDashboardsSection() {
  const out = [];
  out.push(h1("11. Dashboards & Analytics"));

  out.push(bodyPara(
    "InventoryOS provides multiple dashboard views tailored to different user needs. The Pharmacy Dashboard (Home tab) is optimized for daily operations \u2014 quick stats and recent activity. The Unified Business Dashboard provides a complete KPI snapshot across all modules for the owner. The Sales Analytics Dashboard is a deep-dive view for analyzing sales trends over time. Together, these three dashboards cover the information needs of every role in the pharmacy."
  ));

  out.push(h2("11.1 Pharmacy Dashboard (Home Tab)"));

  out.push(bodyPara(
    "The PharmacyDashboard component is the first screen users see after logging in. It shows four summary cards (total products, low stock count, expiring soon count, total categories), a recent products list, quick action buttons (Add Product, New Sale, etc.), an expiry alerts widget (showing critical, warning, and expired counts with suggested actions), and a notification center popover. This is the daily starting point for pharmacy staff \u2014 everything they need to know about the day's priorities is on this one screen."
  ));

  out.push(h2("11.2 Unified Business Dashboard"));

  out.push(bodyPara(
    "The BusinessDashboard component provides a complete KPI snapshot across all modules. It pulls data from the /api/businesses/[id]/dashboard endpoint, which uses Promise.all to run multiple Prisma aggregations in parallel for performance. The dashboard shows: sales KPIs (today, week, month), purchases KPIs, payments KPIs, returns KPIs, inventory KPIs (cost value, MRP value, potential profit), expiry KPIs (expired, near-expiry, quarantined, value at risk), contacts KPIs (total customers, total suppliers), financials (receivables, payables, cash flow), profit metrics (revenue, COGS, gross profit, margin), and a 7-day trend chart. This is the screen the pharmacy owner uses to understand the overall health of the business."
  ));

  out.push(h2("11.3 Sales Analytics Dashboard"));

  out.push(bodyPara(
    "The SalesAnalytics component is the most detailed analytics view. A period selector (7 days, 30 days, 90 days, 365 days) controls the time range. The dashboard shows KPIs (total sales, sale count, average sale value, total collected, refunds, net revenue, discounts given, tax collected, growth percentage vs. previous period), a daily trend bar chart with hover tooltips showing sales, count, refunds, and net per day, top products by revenue and quantity, top customers by spend, payment method breakdown (cash, card, mobile banking, etc.), peak hours heatmap, day-of-week analysis, and discount rules used. This is the screen a manager uses to identify trends and make decisions about pricing, promotions, and inventory."
  ));

  out.push(h2("11.4 Hubs and Stats"));

  out.push(bodyPara(
    "Three hub components organize navigation. The InventoryHub (Stock tab) links to batches, expiry dashboard, products, add product, CSV import, and categories. The ReportsHub provides a central list of all 7 report types. The MoreHub consolidates admin, operations, and reports sections. Two stats endpoints provide additional data: GET /sales/stats returns today/week/month/year aggregations plus top products, and GET /payments/stats returns today/week/month totals plus a 7-day breakdown plus payment-method breakdown."
  ));

  return out;
}

function buildReportsSection() {
  const out = [];
  out.push(h1("12. Financial & Compliance Reports"));

  out.push(bodyPara(
    "InventoryOS ships with seven report types covering financial, tax, inventory, audit, and compliance needs. All reports support a period selector (today, week, month, quarter, year, or custom date range), can be printed via window.print(), and most support CSV export via a ?format=csv query parameter. These reports are the primary way the pharmacy owner communicates with their accountant, the National Board of Revenue (NBR), and the Directorate General of Drug Administration (DGDA)."
  ));

  out.push(h2("12.1 Profit & Loss Report"));

  out.push(bodyPara(
    "The P&L report provides a complete income statement. It calculates revenue (gross sales, returns, net revenue), COGS (cost of goods sold as total + percentage of revenue), gross profit (amount + margin percentage), expenses (purchases + purchase count + discounts given + tax collected), cash flow (payments received, payments made, net cash flow), and net profit. It also identifies top profit products and loss products (products with negative margin). The report supports period selection and is printable and CSV-exportable. This is the report the pharmacy owner shows to their accountant at month-end."
  ));

  out.push(h2("12.2 Tax/VAT Compliance Report"));

  out.push(bodyPara(
    "The tax report is specifically formatted for Bangladesh VAT compliance. It calculates output tax (VAT collected on sales), input tax (VAT paid on purchases), net VAT payable (output minus input, with an isRefund flag if input exceeds output), VAT-by-rate breakdown (15 percent, 7.5 percent, 5 percent, 0 percent), output tax details per invoice with HSN codes, and input tax details per purchase. This is the report the pharmacy owner files with the NBR. The format matches the NBR's expected structure, reducing manual preparation time."
  ));

  out.push(h2("12.3 Inventory Valuation Report"));

  out.push(bodyPara(
    "The inventory valuation report calculates the value of current stock at cost and at MRP, by product, by category, and by batch. It shows total potential profit (MRP value minus cost value) and average margin. This is the report the pharmacy owner uses for insurance purposes, for business valuation, and for identifying slow-moving inventory. The report supports CSV export for spreadsheet analysis."
  ));

  out.push(h2("12.4 Comprehensive Business Report"));

  out.push(bodyPara(
    "The business report is a one-stop executive summary covering inventory health, contacts, financials, top products, top customers, and top suppliers. It is designed for monthly review meetings \u2014 the pharmacy owner can generate this report and have a complete picture of the business in one document. It supports period selection and is printable."
  ));

  out.push(h2("12.5 Audit Trail Report"));

  out.push(bodyPara(
    "The audit trail report provides a unified timeline of all events across the system. It can be filtered by module (sales, purchases, inventory, payments, returns), entity type (Product, Batch, Sale, etc.), entity ID, and date range. The report queries the Transaction table (which records every stock movement) plus other audit tables (Sale.cancellation, FefoOverride, etc.) and presents a unified chronological view. This is the report used for internal investigations and for compliance audits."
  ));

  out.push(h2("12.6 FEFO Override Report"));

  out.push(bodyPara(
    "The FEFO override report is specifically for DGDA compliance. It lists every instance where staff manually picked a non-FEFO batch, with date, user, product, expected batch (the one FEFO would have picked), selected batch (the one actually picked), and reason. The report can be filtered by date, user, and product. CSV export is supported for submission to DGDA inspectors."
  ));

  out.push(h2("12.7 Expiry Report"));

  out.push(bodyPara(
    "The expiry report is a printable daily, weekly, or monthly report with a business header (pharmacy name, address, license number), alert preferences, summary (total batches, expired count, near-expiry count, value at risk), and batch-level details (product name, batch number, expiry date, quantity, value, suggested action). This is the report the pharmacist uses for daily expiry review and for monthly regulatory submissions."
  ));

  return out;
}

function buildExpirySection() {
  const out = [];
  out.push(h1("13. Expiry Management (FEFO)"));

  out.push(bodyPara(
    "Expiry management is one of InventoryOS's strongest differentiators. Pharmacies lose significant money to expired stock \u2014 industry estimates suggest 2-5 percent of inventory value expires unused. InventoryOS attacks this problem from multiple angles: FEFO allocation ensures the earliest-expiry stock is sold first, the expiry dashboard provides a complete view of upcoming expiries, the AI expiry optimizer recommends specific actions (discount, return, dispose) for at-risk batches, and the expiry alerts system pushes notifications before batches become unsellable."
  ));

  out.push(h2("13.1 FEFO (First-Expiry-First-Out)"));

  out.push(bodyPara(
    "FEFO is the default allocation strategy for all sales and dispenses. When the system needs to deduct stock for a sale, it automatically picks the batch with the earliest expiry date first, skipping any expired or quarantined batches. This is implemented in the /api/businesses/[id]/products/[productId]/allocate endpoint, which supports both dry-run (preview allocation without modifying stock) and execute (actually deduct stock) modes. The FEFO allocation engine is also used by the dispense and sale APIs internally."
  ));

  out.push(h2("13.2 Expiry Dashboard"));

  out.push(bodyPara(
    "The ExpiryDashboard component provides a full management view. It shows summary cards (expired count, critical count <30 days, warning count 30-90 days, total value at risk), filter tabs (All, Expired, Critical, Warning, Quarantined), a search bar, a 13-week timeline chart showing when batches will expire, and a bulk action bar for applying actions to multiple batches. This is the primary screen a pharmacist uses to manage upcoming expiries."
  ));

  out.push(h2("13.3 Expiry Alerts"));

  out.push(bodyPara(
    "Three layers of expiry alerts ensure nothing slips through. The ExpiryAlertsWidget on the home dashboard shows critical/warning/expired counts with suggested actions. The Expiry Alerts API (GET /expiry-alerts) returns batches grouped by severity (expired, critical <30 days, warning 30-90 days) with a suggestedAction field (Dispose, Sell first, FEFO priority) and a totalValueAtRisk amount. The Notification Center pushes expiry_critical, expiry_warning notifications that appear in real time. Alert preferences are configurable: critical threshold (default 7 days), warning threshold (default 30 days), notice threshold (default 90 days)."
  ));

  out.push(h2("13.4 Expiry Timeline Chart"));

  out.push(bodyPara(
    "The ExpiryTimelineChart component visualizes the next 13 weeks (one quarter) of upcoming expiries as a bar chart. Bars are color-coded by urgency: rose (red) for expired batches, amber for critical (within 30 days), emerald for warning (30-90 days). Hovering over a bar shows the count and value of batches expiring that week. This visual makes it immediately obvious when a cluster of expiries is approaching, allowing the pharmacist to take action (discount, return to supplier) before they become losses."
  ));

  out.push(h2("13.5 Quarantine, Dispose, and AI Optimizer"));

  out.push(bodyPara(
    "Three workflows handle problematic batches. Quarantine and Dispose are detailed in Section 8.8. The AI Expiry Optimizer (detailed in Section 14.3) analyzes near-expiry batches and recommends specific actions: sell at full price (if demand is high enough), discount by X percent (to accelerate sales), return to supplier (if return window is still open), or dispose (if no other option). The optimizer considers historical sales velocity, current stock levels, days until expiry, and the batch's purchase cost to make its recommendation. This is one of the highest-ROI AI features \u2014 even a 10 percent reduction in expired stock value pays for the AI subscription many times over."
  ));

  return out;
}

function buildAIFeaturesSection() {
  const out = [];
  out.push(h1("14. AI & Smart Features"));

  out.push(bodyPara(
    "InventoryOS integrates six AI-branded features, four of which call the Z.ai GLM-4 LLM and two of which are deterministic (pure statistical math, no LLM). All six are gated behind the pro_ai subscription tier. The AI Hub (AI tab) is the central entry point, showing gradient cards for each feature. The four LLM features share the cost-control infrastructure detailed in Section 4 (5-tier rate limit, 24h cache, SQL router, fallback system, AIUsageLog)."
  ));

  out.push(h2("14.1 AI Chat Assistant"));

  out.push(bodyPara(
    "The AI Chat component allows the pharmacist to ask natural-language questions about their inventory and get instant answers. Examples: 'Show me low stock items', 'What sold today?', 'Which customers owe me money?', 'What's my inventory value?'. The SQL Router intercepts 20 common question patterns and answers them with deterministic Prisma queries (zero LLM tokens consumed). For questions that do not match any pattern, the chat falls back to GLM-4 with the 24-hour cache and full rate limiting. The UI shows suggested questions to help users discover what they can ask."
  ));

  out.push(h2("14.2 AI Insights"));

  out.push(bodyPara(
    "The AI Insights component provides a daily business health analysis. It returns a health score (0-100), a summary paragraph, an insights array (each with a type: success, warning, danger, info, or tip), and prioritized recommendations with expected impact (e.g., 'Discount the 23 batches expiring in 30 days to recover approximately 15,000 BDT'). This is the feature a pharmacy owner opens every morning to get a quick read on the business. The response is cached for 24 hours, so opening it multiple times in a day costs only one LLM call."
  ));

  out.push(h2("14.3 AI Expiry Optimizer"));

  out.push(bodyPara(
    "The AI Expiry Optimizer analyzes near-expiry batches and recommends a specific action for each: sell (at full price, if demand is sufficient), discount (by a suggested percentage, to accelerate sales), return to supplier (if the return window is still open), or dispose (if no other option). For each batch, it shows the recommended action, urgency level (critical, high, medium, low), suggested discount percentage (if applicable), and estimated recovery amount. This is the highest-ROI AI feature \u2014 recovering even a fraction of the value-at-risk stock pays for the AI subscription."
  ));

  out.push(h2("14.4 AI Product Assistant"));

  out.push(bodyPara(
    "The AI Product Assistant provides four sub-actions on the product page: generate_description (writes a patient-friendly product description), check_interactions (checks for drug interactions between a list of medications, up to 20), suggest_category (suggests the best category for a new product), and suggest_dosage (suggests standard dosage information). The check_interactions feature is particularly valuable for pharmacists verifying prescriptions \u2014 they can paste a list of medications and get an instant interaction check before dispensing."
  ));

  out.push(h2("14.5 Smart Reorder Suggestions"));

  out.push(bodyPara(
    "The ReorderSuggestions component shows products that need reordering, ranked by urgency. For each product, it calculates: sales velocity (30-day daily average), days of stock remaining (current quantity divided by velocity), urgency level (critical <7 days, high <14 days, medium <30 days, low <60 days), suggested order quantity (based on velocity and lead time), estimated cost (suggested quantity times purchase price), and a near-expiry flag (if current stock is near expiry, reorder is more urgent). Despite being branded as AI, this feature is deterministic (pure statistical math, no LLM call) \u2014 which is actually the correct design, since LLMs are bad at numeric forecasting."
  ));

  out.push(h2("14.6 Demand Forecast"));

  out.push(bodyPara(
    "The DemandForecast component shows a 90-day historical sales analysis with a forecast for the next N days. For each product, it calculates: daily sales buckets for the past 90 days, trend (increasing, decreasing, or stable), and forecasted sales and revenue for the next 7/14/30 days. Like Smart Reorder, this feature is deterministic (no LLM call) \u2014 forecasting is a math problem, not a language problem. The 'AI' branding is aspirational; the implementation is solid statistical analysis."
  ));

  out.push(h2("14.7 AI Hub"));

  out.push(bodyPara(
    "The AIHub component (AI tab) is the central entry point to all AI features. It shows four gradient cards (Chat, Insights, Expiry Optimizer, Product Assistant) with brief descriptions and tap-to-open behavior. The card design uses the violet AI accent color (matching the bottom nav's AI tab glow), distinguishing AI features from the rest of the app's emerald palette."
  ));

  return out;
}

function buildAlertsSection() {
  const out = [];
  out.push(h1("15. Alerts & Notifications"));

  out.push(bodyPara(
    "The alerts and notifications system ensures the pharmacy staff never misses an important event \u2014 a batch expiring, stock running low, a quarantined batch needing attention. The system is configurable per business, so each pharmacy can tune the thresholds to their preferences. All alerts are also logged to the NotificationLog table for audit purposes."
  ));

  out.push(h2("15.1 Alerts Center"));

  out.push(bodyPara(
    "The AlertsCenter component provides a combined view of all alert types: low stock alerts (products below reorder level), expiry alerts (using the business's configured thresholds), and quarantine alerts (batches currently in quarantine). Each alert is color-coded by severity (red for critical, amber for warning, emerald for info). The combined alerts endpoint (GET /combined-alerts) returns all three types in a single response for efficient loading."
  ));

  out.push(h2("15.2 Alert Preferences"));

  out.push(bodyPara(
    "The AlertPreferences component allows configuring: expiry thresholds (critical default 7 days, warning default 30 days, notice default 90 days), low-stock threshold (products below this quantity trigger an alert), quarantine alerts toggle (on/off), email and SMS channels (schema-only \u2014 email/SMS sending is not yet implemented), digest frequency (daily, weekly, monthly, none), and quiet hours (start and end times when notifications should not be pushed \u2014 also schema-only, not yet enforced)."
  ));

  out.push(h2("15.3 Alert Digest"));

  out.push(bodyPara(
    "The alert digest endpoint (POST /alerts/digest) generates a summary suitable for email or SMS sending. It respects the digestFrequency setting: if set to 'none', the digest is skipped. Otherwise, it generates a summary of all active alerts and logs a NotificationLog entry. The actual email/SMS sending is not yet implemented \u2014 this is a schema-ready feature awaiting integration with an email/SMS provider."
  ));

  out.push(h2("15.4 Notification Center"));

  out.push(bodyPara(
    "The NotificationCenter component is a popover accessible from the top bar. It shows an unread count badge, a list of recent notifications with type-styled entries (expiry_critical, expiry_warning, low_stock, quarantine, disposed), mark-as-read individual, and mark-all-read buttons. Notifications are stored in the NotificationLog table with severity, title, message, entity reference (for deep linking), isRead, isResolved, and readAt fields."
  ));

  return out;
}

function buildUserSubSection() {
  const out = [];
  out.push(h1("16. User Management, Roles & Subscription"));

  out.push(bodyPara(
    "InventoryOS supports multi-user pharmacies with full RBAC (detailed in Section 2.2) and a tiered subscription model. A typical pharmacy has 1-3 users: the owner (with the 'owner' role, full permissions), the head pharmacist (with the 'pharmacist' or 'manager' role), and optionally a counter assistant (with the 'cashier' role). Each user has their own credentials, and their permissions determine what they can see and do in the app."
  ));

  out.push(h2("16.1 User Management"));

  out.push(bodyPara(
    "The UserManagement component allows creating, editing, and deleting users. Each user has: username (scoped to the business), password (hashed with bcrypt), role (one of 6), custom permissions (optional JSON override of role defaults), active toggle (suspend a user without deleting), and last-login display. The change password dialog supports self-service (requires current password) or admin reset (no current password required), with an optional 'invalidate all other sessions' flag for security."
  ));

  out.push(h2("16.2 Session and Login Management"));

  out.push(bodyPara(
    "The SessionManager component shows all active sessions for all users in the business, with masked tokens (first 8 characters only), device info (user agent, IP), and expiry indicators. The owner can force-logout any session. The LoginActivity component shows recent login events and a summary (total users, active users, never-logged-in users). Both feed from the Session table, which records every login event."
  ));

  out.push(h2("16.3 Subscription Tiers"));

  out.push(bodyPara(
    "InventoryOS uses a three-tier subscription model defined in src/lib/feature-gate.ts. The Free tier (0 BDT/month) is for trial: 100 products maximum, single user, no AI features, all reports and analytics enabled. The Pro tier (500 BDT/month) is for small pharmacies: unlimited products, multi-user, no AI features. The Pro+AI tier (1000 BDT/month) is the full-featured plan: unlimited products, multi-user, all AI features (chat, insights, expiry optimizer, product assistant, smart reorder, demand forecast), with AI rate limits of 50 calls per day, 1000 calls per month, and 500,000 tokens per month."
  ));

  out.push(tableCaption("Table 16.1 \u2014 Subscription Tier Comparison"));
  out.push(makeTable(
    ["Feature", "Free (0 BDT)", "Pro (500 BDT)", "Pro+AI (1000 BDT)"],
    [
      ["Max products", "100", "Unlimited", "Unlimited"],
      ["Multi-user accounts", "No (1 user only)", "Yes", "Yes"],
      ["All 7 reports (P&L, Tax, etc.)", "Yes", "Yes", "Yes"],
      ["Analytics dashboard", "Yes", "Yes", "Yes"],
      ["Supplier + customer management", "Yes", "Yes", "Yes"],
      ["Customer credit accounts", "Yes", "Yes", "Yes"],
      ["Payments + returns", "Yes", "Yes", "Yes"],
      ["Discount rules engine", "Yes", "Yes", "Yes"],
      ["CSV import + template", "Yes", "Yes", "Yes"],
      ["Audit trail + transaction log", "Yes", "Yes", "Yes"],
      ["AI Chat Assistant", "No", "No", "Yes"],
      ["AI Insights (health score)", "No", "No", "Yes"],
      ["AI Expiry Optimizer", "No", "No", "Yes"],
      ["AI Product Assistant", "No", "No", "Yes"],
      ["Smart Reorder", "No", "No", "Yes"],
      ["Demand Forecast", "No", "No", "Yes"],
      ["AI rate limits", "n/a", "n/a", "50/day, 1000/mo, 500K tok/mo"],
    ],
    [38, 18, 20, 24]
  ));

  out.push(h2("16.4 Subscription Lifecycle"));

  out.push(bodyPara(
    "The Business model tracks subscriptionTier (free, pro, pro_ai), subscriptionStatus (trial, active, suspended, cancelled), subscriptionStart, and subscriptionEnd. The hourly-subscriptions cron job auto-suspends businesses with subscriptionEnd in the past, and disables AI for suspended pro_ai businesses. The SubscriptionStatus UI component shows the current tier, plan details, AI usage meters (daily calls used, monthly calls used, tokens used), feature comparison, and an upgrade CTA. Tier upgrades are performed by the super-admin via the /admin dashboard."
  ));

  return out;
}

function buildAuditFinalSection() {
  const out = [];
  out.push(h1("17. Audit, Compliance & Data Management"));

  out.push(bodyPara(
    "InventoryOS maintains six distinct audit log types, ensuring every meaningful action in the system is traceable. This depth of audit logging is required for Bangladesh pharmacy regulations (DGDA compliance) and is a significant competitive advantage \u2014 many competing pharmacy software solutions in Bangladesh have no audit trail at all."
  ));

  out.push(h2("17.1 Audit Log Types"));

  out.push(tableCaption("Table 17.1 \u2014 Audit Log Types"));
  out.push(makeTable(
    ["Log Type", "Table", "What It Tracks"],
    [
      ["Transaction audit trail", "Transaction", "Every stock movement (PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN, QUARANTINE, RELEASE) with type, quantity, unitPrice, note, createdBy"],
      ["FEFO override audit", "FefoOverride", "Every manual non-FEFO batch pick with reason, userId, expected batch, selected batch \u2014 required for DGDA compliance"],
      ["Login activity log", "Session (createdAt)", "Every login event with device info, IP, expiry \u2014 used for security monitoring"],
      ["AI usage log", "AIUsageLog", "Every AI call with feature, tokens, cost (BDT), success/error \u2014 used for cost monitoring"],
      ["Cron job log", "CronJobLog", "Every background job execution with status, duration, records written, error message, full log text"],
      ["Notification log", "NotificationLog", "Every alert with severity, title, message, entity ref, isRead/isResolved \u2014 used for audit + dedup"],
    ],
    [22, 18, 60]
  ));

  out.push(h2("17.2 Transaction Log UI"));

  out.push(bodyPara(
    "The TransactionLog component provides a filterable view of the Transaction audit trail. The user can filter by movement type (PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN, QUARANTINE, RELEASE), date range, product, and batch. This is the screen a pharmacist uses to investigate discrepancies \u2014 for example, if the stock count of a product does not match the physical count, they can review every movement of that product to find the discrepancy."
  ));

  out.push(h2("17.3 Sale Cancellation Audit"));

  out.push(bodyPara(
    "When a sale is cancelled (distinct from a return), the Sale model records cancelledAt (timestamp), cancelledBy (userId), and cancelReason (text). The original sale data is preserved \u2014 the cancellation does not delete the sale, it only changes its status. This preserves the audit trail while allowing the system to reverse the stock deduction and payment. Double-cancellation is blocked by the status check (a cancelled sale cannot be cancelled again)."
  ));

  return out;
}

function buildSummarySection() {
  const out = [];
  out.push(h1("18. Summary & What's Next"));

  out.push(h2("18.1 Strengths to Highlight in Sales Pitches"));

  out.push(bodyPara(
    "When pitching InventoryOS to a prospective pharmacy client, lead with the business strengths \u2014 they resonate with the pharmacy owner's daily pain points. The top five are: (1) Three-tap Quick Dispense for fast counter service, (2) Complete FEFO + expiry management suite that recovers value from at-risk stock, (3) AI Insights that give a daily health score and prioritized recommendations, (4) Bangladesh VAT-compliant tax report formatted for NBR submission, and (5) Full audit trail satisfying DGDA compliance requirements. These five features address the highest-priority concerns of every pharmacy owner: speed at the counter, reducing expired-stock losses, business intelligence, tax compliance, and regulatory compliance."
  ));

  out.push(bodyPara(
    "When pitching to technical stakeholders or investors, lead with the technical strengths. The top five are: (1) True multi-tenant architecture with businessId isolation on every entity, (2) Complete RBAC with 6 roles and 41 permissions across 13 namespaces, (3) Five-tier AI cost control that makes BDT-priced AI features economically viable, (4) FEFO + DGDA compliance built into the data model (FefoOverride audit table), and (5) Disaster-recovery-ready backup infrastructure with monthly DR drills and 8-point backup verification. These five demonstrate that the platform is built for scale, security, cost-control, regulatory compliance, and reliability."
  ));

  out.push(h2("18.2 Features in Code but NOT Yet Wired to UI"));

  out.push(bodyPara(
    "The audit identified thirteen features that exist in code but are not yet fully wired to the user experience. These are not bugs \u2014 they are gaps that should be closed in future iterations. They are listed here so the founder has a complete and honest picture of what is shipping today versus what is technically possible but not yet exposed."
  ));

  out.push(tableCaption("Table 18.1 \u2014 Features in Code but Not Yet Wired to UI"));
  out.push(makeTable(
    ["#", "Feature", "Status", "Recommended Action"],
    [
      ["1", "AI Demand Forecast (claimed LLM, actually deterministic)", "Code-complete, no LLM call", "Rebrand as 'Smart Forecast' in UI"],
      ["2", "AI Smart Reorder (claimed LLM, actually deterministic)", "Code-complete, no LLM call", "Rebrand as 'Smart Reorder' in UI"],
      ["3", "Email/SMS alert channels", "Schema-only (AlertPreference fields exist)", "Integrate with email/SMS provider"],
      ["4", "Quiet hours for notifications", "Schema-only (quietHoursStart/End exist)", "Enforce in alert digest endpoint"],
      ["5", "6 non-pharmacy business modules (grocery, restaurant, etc.)", "Registered with isActive=false, no components", "Build modules when expanding verticals"],
      ["6", "Cron job external scheduler", "Endpoints exist, no vercel.json/systemd timer", "Configure external cron in production"],
      ["7", "Unused npm dependencies (next-auth, next-intl, @dnd-kit, etc.)", "Installed but not used", "Remove in next dependency cleanup"],
      ["8", "Product.maxStock (overstock warning)", "Column exists, no UI surfaces it", "Add overstock alert to dashboard"],
      ["9", "Category hierarchy (parentId)", "API supports it, UI shows flat list", "Render as tree in CategoryManager"],
      ["10", "PharmacyProduct / PharmacyExpiryAlert types", "Defined but not used", "Remove or use them"],
      ["11", "services/index.ts, routes/index.ts, schema/index.ts", "Placeholder export {} files", "Remove or populate"],
      ["12", "UserRole type (3 roles) vs rbac.ts (6 roles)", "Type is stale", "Update type to match rbac.ts"],
      ["13", "Websocket examples", "Reference only, no production integration", "Implement for real-time notifications"],
    ],
    [6, 38, 26, 30]
  ));

  out.push(h2("18.3 Recommended Next Steps"));

  out.push(bodyPara(
    "Three priorities emerge from this inventory. First, close the AI brand honesty gap: rename 'AI Demand Forecast' and 'AI Smart Reorder' to 'Smart Forecast' and 'Smart Reorder' in the UI. This is a 30-minute fix that prevents user confusion and sets correct expectations. Second, implement the email/SMS alert channel integration \u2014 the schema is ready, just needs a provider integration (SendGrid for email, a Bangladeshi SMS gateway like Reve Systems or SSL Wireless for SMS). This unlocks a major value-add for the Pro+AI tier. Third, configure an external cron scheduler in production \u2014 the cron endpoints exist and work, but they need an external trigger (Vercel Cron, systemd timer, or a service like cron-job.org) to actually run on schedule."
  ));

  out.push(h2("18.4 Founder's Pitch Summary"));

  out.push(calloutPara(
    "InventoryOS is a complete, production-ready pharmacy inventory management system built for the Bangladesh market. It tracks products and batches with full FEFO expiry management, processes sales in three taps, manages suppliers and customers with credit tracking, generates seven financial and compliance reports including NBR-ready VAT and DGDA-ready FEFO override audits, and integrates six AI features (chat, insights, expiry optimizer, product assistant, smart reorder, demand forecast) with five-tier cost control that makes BDT-priced AI economically viable. The platform runs on a multi-tenant architecture with 30 database models, 84 API routes, 61 UI components, full RBAC with 6 roles, hourly subscription auto-suspension, nightly KPI snapshots, daily maintenance, Sentry error tracking, PgBouncer connection pooling, Redis caching, and disaster-recovery-ready backups with monthly DR drills. It is everything a Bangladeshi pharmacy needs to run their operations professionally, priced at 0 BDT for trial, 500 BDT for Pro, and 1000 BDT for Pro+AI \u2014 affordable for any pharmacy in the country.",
    P.accent
  ));

  return out;
}

module.exports = {
  buildDashboardsSection,
  buildReportsSection,
  buildExpirySection,
  buildAIFeaturesSection,
  buildAlertsSection,
  buildUserSubSection,
  buildAuditFinalSection,
  buildSummarySection,
};
