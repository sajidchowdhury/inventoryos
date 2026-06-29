// Body Part 1: Problem Analysis + Cron Optimization + Multi-Project Architecture
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType,
} = H;

function buildProblemAnalysis() {
  const out = [];
  out.push(h1("1. Problem Analysis"));

  out.push(bodyPara(
    "The current super admin panel at /admin was built incrementally across Phases 1-5 of the AI cost-control roadmap and Phases A-D of the Report Scheduling system. Each phase added a new card to the dashboard, resulting in a single long page with 12+ cards stacked vertically. While functionally complete, the panel has four structural problems that will worsen as InventoryOS expands beyond pharmacy to other business types (CC camera, grocery, restaurant, etc.)."
  ));

  out.push(h2("1.1 Problem 1: Dashboard is Overwhelming"));

  out.push(bodyPara(
    "When a super admin logs in, they see everything at once: Phase 5 Ops Health, Summary Cards, AI Cost Today, Top Spenders, SQL Router, Feature Usage, 7-Day Usage, Background Jobs, AI Configuration, Kill-Switch, Notification Recipients, Schedule Manager, Generated Reports, and Business List. That is 14 sections on one page with no navigation hierarchy. A new admin user has no idea where to start, what is urgent, and what can wait. The cognitive load is too high for a dashboard that should give a 5-second health check."
  ));

  out.push(h2("1.2 Problem 2: No Multi-Project Architecture"));

  out.push(bodyPara(
    "InventoryOS is designed as a multi-business-type platform. The module registry in src/lib/modules.ts already registers 7 business types (pharmacy active, 6 coming soon: grocery, restaurant, cctv, mobile, electric, bakery). But the super admin panel is pharmacy-only. All AI usage, all businesses, all reports are shown in a single flat list with no project grouping. When the second business type launches, the panel will become unusable \u2014 the admin will see CC camera businesses mixed with pharmacy businesses, with no way to filter or navigate between them."
  ));

  out.push(h2("1.3 Problem 3: API Setup Should Come First"));

  out.push(bodyPara(
    "The current panel does not surface API configuration (SMTP, Z.ai, database connection, cron secret) prominently. These are cross-project infrastructure concerns that affect ALL business types. A new admin should see API setup first, because if SMTP is not configured, no reports get delivered regardless of which project they belong to. Currently, SMTP status is buried inside the Notification Recipients card as a small warning. It should be front and center."
  ));

  out.push(h2("1.4 Problem 4: Owner Email is Not Dynamic"));

  out.push(bodyPara(
    "The ownerEmail field was added to the Business model in Phase A of Report Scheduling, but it is only editable via the super-admin Edit Business dialog. It should be a first-class dynamic field visible on the global dashboard and editable per business, because it is used by multiple features (report delivery, kill-switch alerts, weekly health emails). The same applies to ownerWhatsapp. These contact fields should be managed in one place and reused everywhere."
  ));

  return out;
}

function buildCronOptimization() {
  const out = [];
  out.push(h1("2. Cron Trigger Frequency Optimization"));

  out.push(bodyPara(
    "The user raised a valid concern: the current cron schedule has jobs running every 1 minute (report-delivery-worker), every 5 minutes (report-generator-worker), every 15 minutes (report-schedule-checker), every hour (hourly-subscriptions), and daily (nightly-stats, daily-maintenance, weekly-ai-health). That is potentially 1,440 + 288 + 96 + 24 + 3 = 1,851 cron triggers per day. On a BDIX (Bangladesh Internet Exchange) server with limited resources, this could be a problem. This section analyzes the actual load and recommends optimizations."
  ));

  out.push(h2("2.1 Actual Load Analysis"));

  out.push(bodyPara(
    "The key insight is that most cron jobs do almost nothing when there is no work. The report-delivery-worker runs every 1 minute, but if there are no queued deliveries (which is 99 percent of the time), it does one database query (SELECT WHERE status=queued LIMIT 20), finds zero rows, and exits. The same applies to the generator worker (queries pending, finds none, exits) and the schedule checker (queries due schedules, finds none, exits). The actual resource cost of an empty cron run is one database query taking 2-5 milliseconds. At 1,851 triggers per day, that is roughly 4-9 seconds of total database time per day \u2014 negligible."
  ));

  out.push(tableCaption("Table 2.1 \u2014 Current Cron Schedule and Actual Load"));
  out.push(makeTable(
    ["Job", "Frequency", "Triggers/Day", "Empty-Run Cost", "Actual Work"],
    [
      ["report-delivery-worker", "Every 1 min", "1,440", "~3ms (1 query)", "Only when deliveries are queued. At 100 clients weekly, that is ~100 deliveries per week = 14/day. 99% of runs are empty."],
      ["report-generator-worker", "Every 5 min", "288", "~3ms (1 query)", "Only when reports are pending. At 100 clients weekly, that is ~100 reports/week = 14/day. 95% of runs are empty."],
      ["report-schedule-checker", "Every 15 min", "96", "~3ms (1 query)", "Only finds work when a schedule is due. At weekly frequency, that is 1 trigger per schedule per week. 99% of runs are empty."],
      ["hourly-subscriptions", "Every 1 hour", "24", "~50ms (queries all businesses)", "Checks for expired subscriptions. Always runs but is lightweight."],
      ["nightly-stats", "Daily 01:00", "1", "~2-5 sec (aggregates all businesses)", "Heavy job but only once per day."],
      ["daily-maintenance", "Daily 01:30", "1", "~1-3 sec (prunes old records)", "Heavy job but only once per day."],
      ["weekly-ai-health", "Weekly Mon 06:00", "0.14", "~500ms (aggregates + sends email)", "Only runs once per week."],
    ],
    [24, 14, 12, 18, 32]
  ));

  out.push(h2("2.2 BDIX Server Feasibility"));

  out.push(bodyPara(
    "A typical BDIX-hosted VPS has 2-4 CPU cores, 4-8 GB RAM, and a local SSD. The InventoryOS Next.js server uses ~200MB RAM idle. Each cron trigger spawns a Node.js process (or reuses the existing server process if using internal scheduling), does one database query, and exits. At 1,851 triggers per day, the average is 1 trigger every 47 seconds. Each trigger takes 3-50 milliseconds of CPU time. Total daily CPU time for all cron jobs combined: under 30 seconds. This is well within the capacity of any BDIX server."
  ));

  out.push(bodyPara(
    "The real concern is not CPU or memory \u2014 it is database connections. If the cron endpoints are triggered via HTTP (external scheduler like cron-job.org hitting POST /api/cron/*), each trigger opens a new HTTP connection, which opens a new database connection (via PgBouncer in production). With 1,440 HTTP requests per day to the delivery worker, that is 1 HTTP request per minute \u2014 trivial for any web server. PgBouncer's transaction pooling mode (already configured with 200 max clients, 20 default pool) handles this easily."
  ));

  out.push(h2("2.3 Recommended Optimizations"));

  out.push(bodyPara(
    "While the current schedule is technically fine, three optimizations will reduce load and simplify operations:"
  ));

  out.push(h3("Optimization 1: Merge delivery + generator workers"));

  out.push(bodyPara(
    "Instead of two separate workers (generator every 5 min, delivery every 1 min), merge them into a single report-worker that runs every 2 minutes. The worker first processes pending reports (generates AI content), then processes queued deliveries (sends emails). This halves the number of cron triggers (from 1,440 + 288 = 1,728/day to 720/day) and simplifies the external scheduler configuration (one endpoint instead of two)."
  ));

  out.push(h3("Optimization 2: Use internal interval instead of external cron for workers"));

  out.push(bodyPara(
    "Instead of relying on an external scheduler (cron-job.org, Vercel Cron) to hit HTTP endpoints, run the workers on an internal JavaScript interval (setInterval) within the Next.js server process. This eliminates the HTTP overhead entirely and means the workers run as part of the app, not as separate HTTP requests. The external cron is still needed for nightly-stats, hourly-subscriptions, and daily-maintenance (because those should not run during server restarts), but the high-frequency workers (delivery, generator, checker) can run internally. This is the approach used by most production SaaS platforms."
  ));

  out.push(h3("Optimization 3: Batch the schedule checker"));

  out.push(bodyPara(
    "The schedule checker runs every 15 minutes, but schedules are typically weekly or monthly. Instead of checking every 15 minutes, check every hour (4 times less frequently). The maximum delay between a schedule becoming due and the report being created would be 60 minutes instead of 15 minutes \u2014 acceptable for a weekly report. This reduces schedule checker triggers from 96/day to 24/day."
  ));

  out.push(tableCaption("Table 2.2 \u2014 Optimized Cron Schedule"));
  out.push(makeTable(
    ["Job", "Current", "Optimized", "Savings"],
    [
      ["report-delivery-worker", "Every 1 min (1,440/day)", "Merged into report-worker", "Eliminated"],
      ["report-generator-worker", "Every 5 min (288/day)", "Merged into report-worker", "Eliminated"],
      ["report-worker (NEW merged)", "Does not exist", "Every 2 min, internal interval (720/day)", "Net new but replaces 2 jobs"],
      ["report-schedule-checker", "Every 15 min (96/day)", "Every 1 hour (24/day)", "75% reduction"],
      ["hourly-subscriptions", "Every 1 hour (24/day)", "Unchanged", "0%"],
      ["nightly-stats", "Daily (1/day)", "Unchanged", "0%"],
      ["daily-maintenance", "Daily (1/day)", "Unchanged", "0%"],
      ["weekly-ai-health", "Weekly (0.14/day)", "Unchanged", "0%"],
      ["TOTAL", "1,851/day", "770/day", "58% reduction"],
    ],
    [28, 24, 24, 12]
  ));

  return out;
}

function buildMultiProjectArchitecture() {
  const out = [];
  out.push(h1("3. Multi-Project Architecture"));

  out.push(bodyPara(
    "The core redesign is moving from a single flat dashboard to a two-level hierarchy: a Global Dashboard (cross-project metrics) and Project-Specific Dashboards (pharmacy, cctv, grocery, etc.). The super admin lands on the Global Dashboard, sees platform-wide health, then clicks a project to drill into project-specific metrics and configuration."
  ));

  out.push(h2("3.1 The Two-Level Hierarchy"));

  out.push(bodyPara(
    "Level 1 is the Global Dashboard. This is what the super admin sees immediately after login. It shows metrics that span ALL projects: total AI cost across all business types, total businesses across all projects, platform-wide kill-switch status, API configuration status (SMTP, Z.ai, database), and a project selector grid. From here, the admin can see at a glance whether the platform is healthy and which projects need attention."
  ));

  out.push(bodyPara(
    "Level 2 is the Project-Specific Dashboard. When the admin clicks a project card (e.g., Pharmacy), they navigate to a project-scoped view showing only pharmacy-related metrics: pharmacy AI cost, pharmacy businesses, pharmacy-specific kill-switch thresholds, pharmacy report schedules, pharmacy generated reports, pharmacy background jobs. Each project dashboard has the same structure (so the admin does not need to relearn the UI for each project) but is filtered to that project's data. A project selector at the top of the page lets the admin switch between projects without going back to the Global Dashboard."
  ));

  out.push(h2("3.2 The 7 Business Types"));

  out.push(bodyPara(
    "InventoryOS is designed to support 7 business types, each with different business logic. The module registry in src/lib/modules.ts already defines them. Only pharmacy is currently active. The super admin panel must be ready for all 7 from day one, even if 6 are not yet implemented."
  ));

  out.push(tableCaption("Table 3.1 \u2014 Business Types and Implementation Status"));
  out.push(makeTable(
    ["Business Type", "Module Key", "Status", "Unique Features"],
    [
      ["Pharmacy", "pharmacy", "ACTIVE", "FEFO expiry, batches, prescription drugs, DGDA compliance, AI expiry optimizer"],
      ["CC Camera", "cctv", "Coming Soon", "Installation tracking, maintenance contracts, warranty management"],
      ["Grocery", "grocery", "Coming Soon", "Perishable tracking, barcode-heavy, lower margins, no expiry regulations"],
      ["Restaurant", "restaurant", "Coming Soon", "Recipe costing, ingredient tracking, menu engineering, no batches"],
      ["Mobile Shop", "mobile", "Coming Soon", "IMEI tracking, warranty, trade-in, high-value low-volume"],
      ["Electrical", "electric", "Coming Soon", "Project-based inventory, BOM (bill of materials), contractor pricing"],
      ["Bakery", "bakery", "Coming Soon", "Daily production, perishable (24-48hr), recipe costing, no batches"],
    ],
    [16, 14, 14, 56]
  ));

  out.push(h2("3.3 Data Model Changes for Multi-Project"));

  out.push(bodyPara(
    "Every model that is currently scoped to pharmacy needs a businessType field so the super admin panel can filter by project. The Business model already has businessTypeId (foreign key to BusinessType), so the data model supports multi-project already. The issue is that the super admin panel queries do not filter by businessTypeId \u2014 they show all businesses regardless of type. The fix is to add a businessTypeId filter to every super-admin query, defaulting to 'all' on the Global Dashboard and to the selected project on Project Dashboards."
  ));

  out.push(bodyPara(
    "For the Report Scheduling system, the ReportSchedule model should also get an optional businessTypeId field. Currently, a schedule targets 'all Pro+AI businesses' or 'selected businesses'. With multi-project, a schedule should be able to target 'all pharmacy businesses' or 'all cctv businesses' or 'selected businesses across projects'. This is a backward-compatible change \u2014 null means 'all projects' (current behavior)."
  ));

  return out;
}

module.exports = {
  buildProblemAnalysis,
  buildCronOptimization,
  buildMultiProjectArchitecture,
};
