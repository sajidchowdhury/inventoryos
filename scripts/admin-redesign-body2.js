// Body Part 2: Navigation Redesign + API Setup First + Dynamic Owner Email + Phased Roadmap
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildNavigationRedesign() {
  const out = [];
  out.push(h1("4. Navigation Redesign"));

  out.push(bodyPara(
    "The current super admin panel has no navigation \u2014 everything is on one scrollable page. The redesign introduces a left sidebar (desktop) / bottom tab bar (mobile) navigation with 5 top-level sections. Each section groups related cards and has its own URL (/admin/global, /admin/pharmacy, /admin/cctv, etc.) so the admin can bookmark specific views."
  ));

  out.push(h2("4.1 The 5 Top-Level Navigation Sections"));

  out.push(tableCaption("Table 4.1 \u2014 Super Admin Navigation Structure"));
  out.push(makeTable(
    ["Section", "URL", "Purpose", "Who Sees It"],
    [
      ["Global Dashboard", "/admin", "Cross-project metrics, API status, platform health, project selector", "Always visible \u2014 the landing page"],
      ["API Setup", "/admin/api-setup", "SMTP, Z.ai, database, cron secret, notification recipients \u2014 cross-project infrastructure", "Always visible \u2014 should be configured first"],
      ["Project: Pharmacy", "/admin/pharmacy", "Pharmacy-specific dashboard (AI cost, kill-switch, schedules, reports, businesses)", "Visible when pharmacy module is active"],
      ["Project: CC Camera", "/admin/cctv", "CCTV-specific dashboard (future)", "Visible when cctv module is active"],
      ["Project: [Others]", "/admin/{type}", "Project-specific dashboards for grocery, restaurant, etc.", "Visible when the module is activated"],
    ],
    [18, 14, 46, 22]
  ));

  out.push(h2("4.2 Global Dashboard Layout"));

  out.push(bodyPara(
    "The Global Dashboard is the landing page after login. It shows only cross-project information \u2014 nothing project-specific. The layout is a 3-section vertical stack: API Health (top), Platform Metrics (middle), Project Selector (bottom)."
  ));

  out.push(h3("Section 1: API Health Banner"));

  out.push(bodyPara(
    "A horizontal banner at the top showing the status of 4 critical infrastructure components: SMTP (email delivery), Z.ai (AI features), Database (connection + latency), Cron (external scheduler status). Each component shows a green checkmark (configured + working) or a red warning (not configured or failing). This is the first thing the admin sees \u2014 if any component is red, the admin knows to fix it before anything else. Clicking a component navigates to the API Setup page for that component."
  ));

  out.push(h3("Section 2: Platform Metrics"));

  out.push(bodyPara(
    "4 summary cards showing total businesses (all projects), total AI cost today (all projects), active kill-switches (platform-wide), and total reports sent this week. Below the cards, a project-wise summary table: one row per business type showing business count, AI cost today, AI cost this month, reports sent, active kill-switches. This gives the admin a 10-second overview of the entire platform."
  ));

  out.push(h3("Section 3: Project Selector"));

  out.push(bodyPara(
    "A grid of project cards, one per business type. Each card shows: project name, icon, business count, status badge (Active/Coming Soon), and a 'Open Dashboard' button. Clicking a card navigates to the project-specific dashboard. Inactive projects show a 'Coming Soon' badge and the button is disabled. This replaces the current flat business list with a visual project-oriented entry point."
  ));

  out.push(h2("4.3 API Setup Page Layout"));

  out.push(bodyPara(
    "The API Setup page (/admin/api-setup) consolidates all cross-project infrastructure configuration into one place. This is what the admin should configure FIRST after deploying InventoryOS, before any project-specific setup."
  ));

  out.push(tableCaption("Table 4.2 \u2014 API Setup Page Sections"));
  out.push(makeTable(
    ["Section", "What It Configures", "Current Location", "New Location"],
    [
      ["SMTP / Email", "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM + test send button", "Buried in Notification Recipients card warning", "API Setup \u2192 Email tab"],
      ["Z.ai AI Provider", "AI config (max_tokens per feature), Z.ai connection status, cost per 1K tokens", "AI Configuration card", "API Setup \u2192 AI tab"],
      ["Database", "Connection status, latency, PgBouncer pool status, Redis status", "Health endpoint only", "API Setup \u2192 Database tab"],
      ["Cron Scheduler", "CRON_SECRET, external scheduler URL, last-triggered timestamps for all 7 jobs", "Background Jobs card", "API Setup \u2192 Cron tab"],
      ["Notification Recipients", "Up to 3 email addresses for kill-switch + weekly health alerts", "Notification Recipients card", "API Setup \u2192 Alerts tab"],
      ["Kill-Switch Thresholds", "4 platform-wide trigger thresholds (per-pharmacy monthly, per-pharmacy 24h, platform monthly, Z.ai error rate)", "Kill-Switch card", "API Setup \u2192 Kill-Switch tab (platform-wide only)"],
    ],
    [18, 36, 22, 24]
  ));

  out.push(bodyPara(
    "Each tab has a help icon (?) that opens the off-canvas help panel with the relevant explanation (what it is, what happens if not configured, why you need it, how to use it). The SMTP tab includes a 'Send Test Email' button that sends a test message to the configured recipients, so the admin can verify email delivery works before relying on it for kill-switch alerts."
  ));

  out.push(h2("4.4 Project-Specific Dashboard Layout"));

  out.push(bodyPara(
    "Each project dashboard (e.g., /admin/pharmacy) shows only data for that business type. The layout mirrors the Global Dashboard but scoped: project header (name, icon, business count), project metrics (AI cost, reports, businesses for this project only), and project-specific cards (kill-switch thresholds for this project, report schedules targeting this project, generated reports for this project, background jobs, business list filtered to this project)."
  ));

  out.push(bodyPara(
    "A project selector dropdown at the top of every project dashboard lets the admin switch between projects without going back to the Global Dashboard. The URL changes to reflect the selected project (/admin/pharmacy \u2192 /admin/cctv), so the admin can bookmark specific project views."
  ));

  out.push(h2("4.5 Off-Canvas Help Panel Enhancement"));

  out.push(bodyPara(
    "The existing SuperAdminHelp off-canvas (from Phase 4) is expanded with new entries for the multi-project architecture. Each navigation section gets its own help entry explaining: what it is, what happens if not configured, why you need it, how to use it. The help panel is accessible from every page via the Help button in the header (already exists). New entries: Global Dashboard, API Setup, Project Selector, Project Dashboard, SMTP Configuration, Cron Scheduler Setup, Dynamic Owner Email Management."
  ));

  return out;
}

function buildApiSetupFirst() {
  const out = [];
  out.push(h1("5. API Setup First \u2014 The Configuration Order"));

  out.push(bodyPara(
    "The user correctly identified that API setup should come before project-specific configuration. If SMTP is not configured, no reports get delivered regardless of which project they belong to. If the cron secret is not set, no background jobs run. If the Z.ai SDK is not connected, no AI features work. These are foundational dependencies that must be configured first."
  ));

  out.push(h2("5.1 The Configuration Checklist"));

  out.push(bodyPara(
    "When a new InventoryOS deployment goes live, the admin should follow this exact order. The Global Dashboard surfaces this as a 'Setup Progress' widget that shows which steps are complete and which are pending."
  ));

  out.push(tableCaption("Table 5.1 \u2014 Configuration Order (Setup Checklist)"));
  out.push(makeTable(
    ["Step", "Configuration", "Where", "Why First", "Verification"],
    [
      ["1", "Database connection (DATABASE_URL, DIRECT_DATABASE_URL)", "Environment variables", "Nothing works without a database", "/api/health returns database status OK"],
      ["2", "Cron secret (CRON_SECRET)", "Environment variables", "Background jobs need this to run", "POST /api/cron/status returns 200 with secret"],
      ["3", "SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)", "Environment variables", "Email delivery for reports + alerts", "Send Test Email button in API Setup"],
      ["4", "Z.ai SDK connection", "Ambient (z-ai-web-dev-sdk)", "All AI features depend on this", "AI Chat endpoint returns a response"],
      ["5", "Notification recipients (1-3 emails)", "API Setup \u2192 Alerts tab", "Kill-switch alerts + weekly health emails need recipients", "Recipients list shows at least 1 email"],
      ["6", "Kill-switch thresholds", "API Setup \u2192 Kill-Switch tab", "Platform-wide cost protection", "Thresholds show non-zero values"],
      ["7", "AI configuration (max_tokens per feature)", "API Setup \u2192 AI tab", "Cost control for all AI features", "All 4 features show configured values"],
      ["8", "Cron scheduler (external)", "External service (cron-job.org, Vercel Cron)", "Background jobs need external trigger", "Cron status shows recent runs"],
      ["9", "Project-specific setup (pharmacy)", "/admin/pharmacy", "Pharmacy-specific schedules, occasions, seasons", "Pharmacy dashboard shows configured data"],
    ],
    [6, 30, 20, 24, 20]
  ));

  out.push(h2("5.2 Setup Progress Widget"));

  out.push(bodyPara(
    "On the Global Dashboard, a 'Setup Progress' widget shows a checklist of the 9 steps above with green checkmarks for completed steps and amber circles for pending steps. The widget queries the system at page load to determine completion: database (health endpoint), cron secret (env var check), SMTP (env var check), Z.ai (attempt a minimal API call), recipients (count > 0), kill-switch (thresholds exist), AI config (all 4 features configured), cron scheduler (CronJobLog has entries in last 24h), project setup (pharmacy has at least 1 schedule or 1 occasion). The admin sees at a glance what still needs configuration."
  ));

  return out;
}

function buildDynamicOwnerEmail() {
  const out = [];
  out.push(h1("6. Dynamic Owner Email & Contact Management"));

  out.push(bodyPara(
    "The ownerEmail and ownerWhatsapp fields on the Business model are currently afterthoughts \u2014 added in Phase A for report delivery but not surfaced in the UI as first-class fields. They should be dynamic, visible, and editable from multiple places, because they are used by multiple features across all projects."
  ));

  out.push(h2("6.1 Where Owner Contacts Are Used"));

  out.push(tableCaption("Table 6.1 \u2014 Features That Use Owner Contacts"));
  out.push(makeTable(
    ["Feature", "Uses ownerEmail", "Uses ownerWhatsapp", "When"],
    [
      ["Report delivery (email)", "Yes", "No", "When a scheduled report is generated and delivered via email"],
      ["Report delivery (WhatsApp)", "No", "Yes", "When a scheduled report is generated and delivered via WhatsApp (Phase E)"],
      ["Kill-switch alerts", "No (uses notification recipients)", "No", "Kill-switch alerts go to notification recipients, not business owners. But owner email could be added as a CC for per-pharmacy triggers."],
      ["Weekly health email", "No (uses notification recipients)", "No", "Platform-wide health email goes to notification recipients only"],
      ["Subscription expiry notices", "Yes (planned)", "Yes (planned)", "Future feature: notify business owner when their subscription is about to expire"],
      ["Abuse alerts", "No (uses notification recipients)", "No", "Abuse alerts go to the founder, not the business owner"],
      ["Onboarding welcome email", "Yes (planned)", "No", "Future feature: send a welcome email when a business is first created"],
    ],
    [28, 20, 20, 32]
  ));

  out.push(h2("6.2 Contact Management UI"));

  out.push(bodyPara(
    "Owner contacts should be managed in 3 places. First, the Global Dashboard shows a 'Contacts' section listing all businesses with their ownerEmail and ownerWhatsapp, with inline edit capability. This is the admin's master view for managing contacts across all projects. Second, each Project Dashboard shows the same contacts but filtered to that project. Third, the Edit Business dialog (already exists) includes ownerEmail and ownerWhatsapp fields \u2014 these should be promoted from hidden fields to visible, labeled inputs at the top of the dialog."
  ));

  out.push(h2("6.3 Fallback Logic"));

  out.push(bodyPara(
    "When a feature needs the owner email but it is not set, the system should fall back gracefully. For report delivery, if ownerEmail is null, the delivery is marked 'failed' with errorMessage 'No email address on file for this business. Set ownerEmail in the Business Edit dialog.' and the report is still viewable in /admin. For future features like subscription expiry notices, if both ownerEmail and ownerWhatsapp are null, the notice is logged to NotificationLog but not sent. The fallback logic should be centralized in a helper function getBusinessContact(businessId, channel) that returns the contact or null, so all features use the same fallback behavior."
  ));

  out.push(h2("6.4 Contact Validation"));

  out.push(bodyPara(
    "Owner emails should be validated on save (basic regex: must contain @ and a domain). WhatsApp numbers should be validated (must start with + and be 10-15 digits). Invalid contacts are rejected with a clear error message. The validation happens in the Business Update API and the Edit Business dialog. This prevents typos that would cause silent delivery failures weeks later when a report is generated."
  ));

  return out;
}

function buildPhasedRoadmap() {
  const out = [];
  out.push(h1("7. Phased Implementation Roadmap"));

  out.push(bodyPara(
    "The redesign is broken into 6 phases over 4 weeks. Each phase is independently shippable \u2014 the admin panel remains functional after every phase. The phases are ordered by impact: Phase 1 fixes the most urgent problem (messy dashboard), Phase 2 adds the navigation structure, and subsequent phases add multi-project support and polish."
  ));

  out.push(h2("7.1 Phase 1 \u2014 Sidebar Navigation + Page Split (Week 1, 6 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Replace the single-page dashboard with a sidebar navigation and 5 top-level pages. No data changes \u2014 just reorganize existing cards into the new structure.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Create sidebar nav component with 5 sections. (2) Split admin/page.tsx into 5 route segments: /admin (global), /admin/api-setup, /admin/pharmacy, /admin/cctv (placeholder), /admin/[type] (dynamic). (3) Move existing cards to appropriate pages. (4) Add project selector dropdown to project pages. (5) Update header to show current page name + project selector.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Exit criteria: ", { bold: true, color: P.amber, size: 22 }),
    tr("Admin can navigate between Global Dashboard, API Setup, and Pharmacy Dashboard via sidebar. All existing cards are accessible. No data loss.", { size: 22 }),
  ]));

  out.push(h2("7.2 Phase 2 \u2014 API Setup Page (Week 1, 4 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Build the dedicated API Setup page with 6 tabs (SMTP, Z.ai, Database, Cron, Alerts, Kill-Switch). Move cross-project config here from scattered cards.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Create ApiSetupPage component with tabbed layout. (2) Move AI Configuration card to AI tab. (3) Move Kill-Switch card to Kill-Switch tab. (4) Move Notification Recipients to Alerts tab. (5) Build SMTP config panel with test-send button. (6) Build Database status panel. (7) Build Cron config panel with scheduler URL + last-triggered timestamps. (8) Add help icons per tab linking to off-canvas.", { size: 22 }),
  ]));

  out.push(h2("7.3 Phase 3 \u2014 Global Dashboard Redesign (Week 2, 5 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Rebuild the Global Dashboard as a 3-section page: API Health Banner, Platform Metrics, Project Selector. Add Setup Progress widget.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Build API Health Banner component (4 status indicators). (2) Build Platform Metrics cards (total businesses, total AI cost, active kill-switches, reports sent). (3) Build Project Selector grid (7 project cards with icons + status badges). (4) Build Setup Progress widget (9-step checklist). (5) Remove project-specific cards from Global Dashboard (move to Pharmacy Dashboard).", { size: 22 }),
  ]));

  out.push(h2("7.4 Phase 4 \u2014 Cron Optimization (Week 2, 3 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Merge generator + delivery workers into a single report-worker. Change schedule checker to hourly. Add internal interval scheduling option.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Merge runReportGeneratorWorker + runReportDeliveryWorker into runReportWorker (generator first, then delivery). (2) Create POST /api/cron/report-worker endpoint. (3) Deprecate the two old endpoints (keep for backward compat). (4) Change schedule checker from every 15 min to every 1 hour. (5) Add optional internal interval scheduling (setInterval in a server-side useEffect or a separate background process). (6) Update Background Jobs card to show the merged worker.", { size: 22 }),
  ]));

  out.push(h2("7.5 Phase 5 \u2014 Dynamic Owner Email Management (Week 3, 3 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Surface ownerEmail + ownerWhatsapp as first-class fields. Add contact management UI. Add validation.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Create getBusinessContact(businessId, channel) helper in src/lib/business-contacts.ts. (2) Add Contacts section to Global Dashboard (master list with inline edit). (3) Add Contacts section to Pharmacy Dashboard (filtered). (4) Promote ownerEmail + ownerWhatsapp in Edit Business dialog. (5) Add email + phone validation to Business Update API. (6) Update report delivery worker to use getBusinessContact helper. (7) Add help entry for Contact Management.", { size: 22 }),
  ]));

  out.push(h2("7.6 Phase 6 \u2014 Multi-Project Filtering + Help Expansion (Week 4, 4 hours)"));

  out.push(bodyParaRich([
    tr("Goal: ", { bold: true, color: P.accent, size: 22 }),
    tr("Add businessTypeId filtering to all super-admin queries. Add businessTypeId to ReportSchedule. Expand help panel with new entries.", { size: 22 }),
  ]));

  out.push(bodyParaRich([
    tr("Tasks: ", { bold: true, size: 22 }),
    tr("(1) Add businessTypeId filter to all super-admin API endpoints (schedules, generated-reports, kill-switch, ops-health). (2) Add businessTypeId field to ReportSchedule model (optional, null = all projects). (3) Update schedule builder UI with project selector. (4) Add 7 new help entries to SuperAdminHelp off-canvas. (5) Build placeholder dashboards for 6 inactive projects (Coming Soon page with feature preview). (6) Update project selector to show all 7 projects with status badges.", { size: 22 }),
  ]));

  out.push(h2("7.7 Roadmap Summary"));

  out.push(tableCaption("Table 7.1 \u2014 Super Admin Redesign Roadmap"));
  out.push(makeTable(
    ["Phase", "Goal", "Week", "Effort", "Gate"],
    [
      ["Phase 1", "Sidebar navigation + page split", "1", "6 hours", "Admin can navigate between 5 pages via sidebar"],
      ["Phase 2", "API Setup page (6 tabs)", "1", "4 hours", "All cross-project config in one place"],
      ["Phase 3", "Global Dashboard redesign", "2", "5 hours", "3-section layout with API health + metrics + project selector"],
      ["Phase 4", "Cron optimization", "2", "3 hours", "58% fewer cron triggers, merged worker"],
      ["Phase 5", "Dynamic owner email", "3", "3 hours", "Contacts managed in 3 places with validation"],
      ["Phase 6", "Multi-project filtering", "4", "4 hours", "All queries filter by businessTypeId, 7 project cards"],
    ],
    [10, 30, 10, 12, 38]
  ));

  out.push(bodyPara(
    "Total: 25 hours over 4 weeks. The phases can be compressed if the founder works full-time (Phases 1-2 in week 1, Phases 3-4 in week 2, Phases 5-6 in week 3). The most impactful phase is Phase 1 (navigation) \u2014 it immediately makes the panel usable. The most architecturally significant is Phase 6 (multi-project filtering) \u2014 it prepares the platform for the second business type launch."
  ));

  out.push(calloutPara(
    "Print Table 7.1 and pin it above your desk. Work through the phases in order. After Phase 1, the panel is immediately less overwhelming. After Phase 6, the platform is ready for the second business type (CC camera, grocery, etc.) to launch without any admin panel changes.",
    P.aiAccent
  ));

  return out;
}

module.exports = {
  buildNavigationRedesign,
  buildApiSetupFirst,
  buildDynamicOwnerEmail,
  buildPhasedRoadmap,
};
