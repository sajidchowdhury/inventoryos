// Body Part 3: API Endpoints + Super Admin UI + Background Jobs + Delivery Integration
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildApiEndpoints() {
  const out = [];
  out.push(h1("8. API Endpoints Specification"));

  out.push(bodyPara(
    "Ten new API endpoints are required, all under the /api/super-admin/ path and requiring super-admin Bearer authentication. The endpoints follow the same patterns as the existing Phase 1-5 endpoints (ai-config, kill-switch, ops-health) for consistency. All endpoints return JSON with a success boolean and appropriate error codes (400 for validation, 401 for unauthorized, 404 for not found, 500 for server errors)."
  ));

  out.push(h2("8.1 Schedule CRUD Endpoints"));

  out.push(tableCaption("Table 8.1 \u2014 Schedule Endpoints"));
  out.push(makeTable(
    ["Method", "Path", "Purpose"],
    [
      ["GET", "/api/super-admin/report-schedules", "List all schedules (with pagination, filter by isActive)"],
      ["POST", "/api/super-admin/report-schedules", "Create a new schedule. Body: {name, frequency, dayOfWeek?, dayOfMonth?, startDate?, endDate?, occasions[], targetClientMode, targetClientIds?, deliveryChannels[], reportPeriodDays, isActive}"],
      ["GET", "/api/super-admin/report-schedules/[id]", "Get one schedule with full details"],
      ["PUT", "/api/super-admin/report-schedules/[id]", "Update a schedule. Same body as POST. Recalculates nextRunAt."],
      ["DELETE", "/api/super-admin/report-schedules/[id]", "Delete a schedule (soft delete via isActive=false recommended, hard delete allowed)"],
      ["POST", "/api/super-admin/report-schedules/[id]/trigger", "Manually trigger a schedule (for testing). Creates GeneratedReport rows immediately for all target businesses, bypassing the nextRunAt check."],
    ],
    [10, 36, 54]
  ));

  out.push(h2("8.2 Occasion & Holiday Endpoints"));

  out.push(tableCaption("Table 8.2 \u2014 Occasion Endpoints"));
  out.push(makeTable(
    ["Method", "Path", "Purpose"],
    [
      ["GET", "/api/super-admin/occasions", "List all occasions (filter by isActive, type)"],
      ["POST", "/api/super-admin/occasions", "Create a custom occasion. Body: {name, type, datePattern, fixedMonth?, fixedDay?, weeklyDayOfWeek?, impactWeight, durationDays, leadDays, description}"],
      ["PUT", "/api/super-admin/occasions/[id]", "Update an occasion (e.g., change impactWeight, confirm lunar date)"],
      ["DELETE", "/api/super-admin/occasions/[id]", "Delete an occasion (refuse if it has HolidayCalendar entries)"],
      ["GET", "/api/super-admin/holiday-calendar", "List holidays for a year. Query: ?year=2026. Returns all HolidayCalendar entries for that year with occasion details."],
      ["POST", "/api/super-admin/holiday-calendar", "Add a holiday occurrence. Body: {occasionId, date, isConfirmed, notes}"],
    ],
    [10, 36, 54]
  ));

  out.push(h2("8.3 Report & Delivery Endpoints"));

  out.push(tableCaption("Table 8.3 \u2014 Report & Delivery Endpoints"));
  out.push(makeTable(
    ["Method", "Path", "Purpose"],
    [
      ["GET", "/api/super-admin/generated-reports", "List generated reports. Query: ?scheduleId&businessId&status&dateFrom&dateTo&limit&offset"],
      ["GET", "/api/super-admin/generated-reports/[id]", "Get full report content (executiveSummary, spikePredictions, topItems, stockRisks)"],
      ["POST", "/api/super-admin/generated-reports/[id]/regenerate", "Regenerate a report (useful if AI failed or data changed). Creates a new GeneratedReport row."],
      ["GET", "/api/super-admin/report-deliveries", "List delivery records. Query: ?reportId&channel&status&limit&offset"],
      ["POST", "/api/super-admin/report-deliveries/[id]/resend", "Manually resend a delivery (e.g., if it failed and founder fixed the email address)"],
    ],
    [10, 36, 54]
  ));

  out.push(h2("8.4 Example: Create Schedule Request/Response"));

  out.push(calloutPara(
    "POST /api/super-admin/report-schedules\nAuthorization: Bearer <superAdminToken>\nContent-Type: application/json\n\n{\n  \"name\": \"Weekly Eid-Aware Report\",\n  \"frequency\": \"weekly\",\n  \"dayOfWeek\": 1,\n  \"occasions\": [\"eid-ul-fitr\", \"eid-ul-adha\", \"friday\"],\n  \"targetClientMode\": \"all\",\n  \"deliveryChannels\": [\"email\", \"whatsapp\"],\n  \"reportPeriodDays\": 7,\n  \"isActive\": true\n}\n\nResponse (201):\n{\n  \"success\": true,\n  \"schedule\": {\n    \"id\": \"cmq...\",\n    \"name\": \"Weekly Eid-Aware Report\",\n    \"frequency\": \"weekly\",\n    \"dayOfWeek\": 1,\n    \"nextRunAt\": \"2026-07-06T06:00:00.000Z\",\n    \"targetClientCount\": 42,\n    \"estimatedWeeklyCost\": 7.56\n  }\n}",
    P.aiAccent
  ));

  return out;
}

function buildSuperAdminUI() {
  const out = [];
  out.push(h1("9. Super Admin UI \u2014 Schedule Builder"));

  out.push(bodyPara(
    "Four new screens in the /admin dashboard. All follow the existing design system (Emerald Pharmacy palette, shadcn/ui components, consistent with the Phase 1-5 cards). Every field has a tooltip/help icon explaining what it does \u2014 consistent with the Phase 4 help off-canvas pattern. The screens are accessible from a new 'Report Schedules' tab in the admin navigation."
  ));

  out.push(h2("9.1 Screen 1: Schedule List"));

  out.push(bodyPara(
    "The landing page for the report scheduling feature. Shows a table of all schedules with columns: Name | Frequency | Occasions | Clients | Channels | Status | Last Run | Next Run | Actions. The 'Actions' column has Edit, Delete, and Trigger (manual run) buttons. A 'Create Schedule' button at the top opens the Schedule Builder form. The table supports search by name and filtering by status (active/inactive). Each row shows a chip per occasion (e.g., 'Eid', 'Friday') and a chip per channel (e.g., 'Email', 'WhatsApp'). 'Next Run' is computed from the schedule's frequency and lastRunAt. If nextRunAt is in the past and the schedule is active, the row is highlighted amber (indicating the checker cron may not be running)."
  ));

  out.push(h2("9.2 Screen 2: Schedule Builder Form"));

  out.push(bodyPara(
    "A single-page form (not multi-step \u2014 the founder wants to see everything at once) with 5 sections. Section 1: Basic Info \u2014 name (required), description (optional). Section 2: Frequency \u2014 radio buttons for weekly/monthly/date_range. For weekly, a day-of-week picker (Mon/Tue/Wed/...). For monthly, a day-of-month picker (1-28). For date_range, two date pickers (start, end). Section 3: Occasions \u2014 multi-select chips. Each chip shows the occasion name and its impact weight (e.g., 'Eid-ul-Fitr (2.8x)'). A 'Select All' and 'Clear All' button. An 'Add Custom Occasion' link that opens the Occasion Manager. Section 4: Target Clients \u2014 radio buttons for 'All active businesses' or 'Selected businesses'. If selected, a multi-select dropdown with search showing all business names. Shows count: '42 businesses selected'. Section 5: Delivery Channels \u2014 checkboxes for Email and WhatsApp. If Email is checked, shows a note: 'Reports will be sent to each business owner's email. Businesses without an email will be skipped.' If WhatsApp is checked, shows a note: 'Requires WhatsApp Business API configuration. See Help.' At the bottom: a 'Preview' panel showing the next 3 scheduled run dates, the estimated number of reports per run, and the estimated weekly AI cost. A 'Save Schedule' button."
  ));

  out.push(h2("9.3 Screen 3: Occasion Manager"));

  out.push(bodyPara(
    "A list of all occasions with inline editing. Each row shows: Name | Type | Date Pattern | Impact Weight (editable number input) | Duration (editable) | Lead Days (editable) | Active toggle | Actions (Edit, Delete). The 'Impact Weight' is the most-edited field \u2014 the founder will tune these over time as they observe actual sales patterns. An 'Add Custom Occasion' button opens a dialog with all fields. The HolidayCalendar entries for each occasion are shown in an expandable sub-row (e.g., 'Eid-ul-Fitr: 2026-04-10 (unconfirmed), 2027-03-31 (unconfirmed)'). The founder can confirm lunar dates here by checking a 'Confirmed' checkbox."
  ));

  out.push(h2("9.4 Screen 4: Generated Reports Viewer"));

  out.push(bodyPara(
    "A filterable list of all generated reports. Filters: schedule (dropdown), business (dropdown with search), status (pending/generating/completed/failed), date range (date pickers). Each row shows: Business Name | Schedule Name | Report Date | Status | AI Cost | Delivery Status (chips: Email sent/failed, WhatsApp sent/failed). Clicking a row opens a detail view showing the full report content rendered as it would appear to the client: executive summary, spike predictions, top 20 items table, stock risks. The detail view has buttons: 'Re-send Email', 'Re-send WhatsApp', 'Download PDF', 'Regenerate Report' (creates a new report with fresh data)."
  ));

  out.push(h2("9.5 UX Principle: Tooltips Everywhere"));

  out.push(bodyPara(
    "Every field in every screen has a tooltip/help icon (the same pattern as the Phase 4 help off-canvas). When the founder hovers over a field label, a tooltip explains what the field does, what the default is, and what happens if left blank. This is critical because the founder will configure these schedules infrequently \u2014 they need to be reminded what each option means without reading the full documentation. The tooltips are also added to the SuperAdminHelp off-canvas as 4 new help entries (one per screen)."
  ));

  return out;
}

function buildBackgroundJobs() {
  const out = [];
  out.push(h1("10. Background Jobs & Automation"));

  out.push(bodyPara(
    "Three new cron jobs are required. They are added to the existing cron system (src/lib/cron-jobs.ts) alongside the existing 4 jobs (nightly-stats, hourly-subscriptions, daily-maintenance, weekly-ai-health). All three use the same auth pattern: x-cron-secret header for external schedulers OR super-admin Bearer token for manual triggering from /admin. The jobs are designed to be idempotent \u2014 running them twice does not create duplicate reports."
  ));

  out.push(h2("10.1 Job 1: report-schedule-checker"));

  out.push(bodyPara(
    "Runs every 15 minutes. Queries the ReportSchedule table for active schedules where nextRunAt <= now(). For each due schedule, determines the target client list (all active businesses or the selected list), and for each target business, creates a GeneratedReport row with status 'pending'. Updates the schedule's lastRunAt to now() and computes the next nextRunAt based on frequency. If a schedule's nextRunAt is more than 1 hour overdue (indicating the checker was down), it still runs once but logs a warning. Schedule: */15 * * * * (every 15 minutes)."
  ));

  out.push(h2("10.2 Job 2: report-generator-worker"));

  out.push(bodyPara(
    "Runs every 5 minutes. Queries for GeneratedReport rows with status 'pending', takes the first 10 (configurable batch size), and processes them. For each report, marks status 'generating', calls the AI prediction algorithm (Section 6), saves the result, marks status 'completed' (or 'failed' with errorMessage). After completion, creates ReportDelivery rows for each configured channel (email, WhatsApp) with status 'queued'. If the AI call fails (Z.ai outage, timeout, JSON parse error), the report is marked 'failed' and a deterministic fallback report is generated (raw numbers without AI synthesis) so the client still receives something. Schedule: */5 * * * * (every 5 minutes)."
  ));

  out.push(h2("10.3 Job 3: report-delivery-worker"));

  out.push(bodyPara(
    "Runs every 1 minute. Queries for ReportDelivery rows with status 'queued', takes the first 20, and sends them. For email, uses the existing src/lib/email.ts module (Phase 4 SMTP infrastructure) with a PDF attachment. For WhatsApp, uses the new src/lib/whatsapp.ts module (Phase E, WhatsApp Business API). Updates status to 'sent' on success, or increments retryCount and schedules a retry (1min, 5min, 15min exponential backoff) on failure. After 3 failures, marks status 'failed' and sends an alert to the founder via the existing kill-switch notification recipients. Schedule: * * * * * (every minute)."
  ));

  out.push(h2("10.4 Cron Schedule Summary"));

  out.push(tableCaption("Table 10.1 \u2014 New Cron Jobs"));
  out.push(makeTable(
    ["Job Name", "Schedule", "Purpose", "Auth"],
    [
      ["report-schedule-checker", "*/15 * * * * (every 15 min)", "Detect due schedules, create pending GeneratedReport rows", "x-cron-secret OR super-admin Bearer"],
      ["report-generator-worker", "*/5 * * * * (every 5 min)", "Process pending reports, call AI, create delivery rows", "x-cron-secret OR super-admin Bearer"],
      ["report-delivery-worker", "* * * * * (every 1 min)", "Send queued deliveries via email/WhatsApp, handle retries", "x-cron-secret OR super-admin Bearer"],
    ],
    [24, 22, 36, 18]
  ));

  out.push(h2("10.5 External Scheduler Setup"));

  out.push(bodyPara(
    "Like the existing cron jobs, these endpoints require an external scheduler to trigger them. The founder should configure a service like Vercel Cron, cron-job.org, or a systemd timer to hit POST /api/cron/report-schedule-checker, /api/cron/report-generator-worker, and /api/cron/report-delivery-worker at the schedules above, with the x-cron-secret header. The cron secret is the same CRON_SECRET env var used by the existing jobs. All three endpoints also accept super-admin Bearer auth for manual testing from /admin (via the Background Jobs card 'Run Now' button)."
  ));

  return out;
}

function buildDeliveryIntegration() {
  const out = [];
  out.push(h1("11. Delivery Integration \u2014 Email & WhatsApp"));

  out.push(bodyPara(
    "Two delivery channels are supported. Email is Phase 1 (immediate, reuses Phase 4 SMTP infrastructure). WhatsApp is Phase 2 (future, requires WhatsApp Business API setup). Both channels can be enabled per schedule, and a single report can be delivered via both channels simultaneously."
  ));

  out.push(h2("11.1 Email Delivery (Phase D)"));

  out.push(bodyPara(
    "Email delivery uses the existing src/lib/email.ts module built in Phase 4. The module uses nodemailer with SMTP credentials from environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). No new infrastructure is needed \u2014 the same module that sends kill-switch alerts sends report emails. The email contains: an HTML body with the report content styled with the InventoryOS brand (emerald header, clean typography, the top 20 items as an HTML table), a PDF attachment (generated via the existing PDF skill with the same brand styling), and a subject line like 'Weekly Sales Prediction \u2014 City Pharmacy \u2014 Week of June 29'. The recipient is the business owner's email \u2014 a new field ownerEmail should be added to the Business model (or the email of the user with the 'owner' role can be used). If the business has no email configured, the delivery is marked 'failed' with errorMessage 'No email address on file' and the report is still viewable in /admin."
  ));

  out.push(h2("11.2 WhatsApp Delivery (Phase E \u2014 Future)"));

  out.push(bodyPara(
    "WhatsApp delivery uses the Meta WhatsApp Business Cloud API. This is a separate phase because it requires Meta account setup, template message approval (3-5 business days), and a paid WhatsApp Business account. The integration plan is as follows."
  ));

  out.push(h3("11.2.1 WhatsApp Business API Setup Steps"));

  out.push(bodyPara(
    "Step 1: Create a Meta Business account at business.facebook.com if not already exists. Step 2: Add a WhatsApp Business phone number (different from any personal WhatsApp number). Step 3: Verify the business (requires business documents \u2014 trade license, etc.). Step 4: Apply for production access (default is sandbox with 5 test numbers). Step 5: Create a message template for the report summary. WhatsApp requires business-initiated messages to use pre-approved templates. The template might be: 'Hello {{1}}, your weekly sales prediction for {{2}} is ready. Top opportunity: {{3}}. Top risk: {{4}}. View full report: {{5}}.' Template variables: {{1}} = pharmacy owner name, {{2}} = business name, {{3}} = top opportunity summary, {{4}} = top risk summary, {{5}} = link to full report in InventoryOS. Step 6: Submit the template for Meta review (3-5 business days). Step 7: Once approved, configure WHATSAPP_TOKEN and WHATSAPP_PHONE_ID environment variables."
  ));

  out.push(h3("11.2.2 WhatsApp Module (src/lib/whatsapp.ts)"));

  out.push(bodyPara(
    "A new module parallel to email.ts. Exports: sendWhatsAppMessage(phoneNumber, templateName, templateParams), isWhatsAppConfigured(), getWhatsAppPhoneId(). Uses the fetch API to call the Meta Graph API (https://graph.facebook.com/v18.0/{phone_id}/messages). If WHATSAPP_TOKEN is not set, fails safe to console.warn (same pattern as email.ts). The module is used by the report-delivery-worker cron job when a delivery has channel='whatsapp'."
  ));

  out.push(h3("11.2.3 WhatsApp Pricing & Rate Limits"));

  out.push(tableCaption("Table 11.1 \u2014 WhatsApp Business API Costs (Bangladesh)"));
  out.push(makeTable(
    ["Message Type", "Cost (USD)", "Cost (BDT)", "Notes"],
    [
      ["Business-initiated (template)", "$0.040", "~4.4 BDT", "Per conversation. A conversation = 24h window after first business message"],
      ["User-initiated (reply)", "$0.011", "~1.2 BDT", "When client replies to the report"],
      ["First 1,000 conversations/month", "FREE", "0 BDT", "Meta waives first 1K per month per number"],
    ],
    [30, 18, 18, 34]
  ));

  out.push(bodyPara(
    "Rate limit: 1,000 business-initiated messages per 24 hours per WhatsApp Business number. At 1,000+ clients, a second WhatsApp Business number is needed. The system should support multiple phone numbers (round-robin) in a future iteration. For Phase E, a single number supports up to ~1,000 weekly report recipients \u2014 sufficient for the first 12-18 months of growth."
  ));

  out.push(h2("11.3 Fail-Safe Pattern"));

  out.push(bodyPara(
    "Both email and WhatsApp modules follow the same fail-safe pattern established in Phase 4: if the channel is not configured (SMTP env vars missing for email, WHATSAPP_TOKEN missing for WhatsApp), the delivery is logged to the console and the ReportDelivery row is marked 'failed' with a clear errorMessage. The report itself is still saved to the GeneratedReport table and is viewable in /admin \u2014 the client just does not receive the push notification. This ensures no report is ever lost, even if delivery infrastructure is down. The founder can manually re-send from /admin once the issue is fixed."
  ));

  return out;
}

module.exports = {
  buildApiEndpoints,
  buildSuperAdminUI,
  buildBackgroundJobs,
  buildDeliveryIntegration,
};
