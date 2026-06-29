// Feature Catalog Body Part 2: AI Infra + Background Jobs + DevOps + Security/SuperAdmin/DataPortability
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType, PageBreak,
} = H;

function buildAIInfraSection() {
  const out = [];
  out.push(h1("4. AI Infrastructure"));

  out.push(bodyPara(
    "InventoryOS ships with a complete AI cost-control stack in src/lib/ that prevents the platform from ever losing money on AI calls. The stack has five layers, executed in order: subscription status check (is the business on a pro_ai tier?), aiEnabled flag check (has the founder manually disabled AI for this business?), burst rate limit (5 calls per 60 seconds), daily rate limit (50 calls per day), monthly rate limit (1000 calls per month), and token budget (500,000 tokens per month). If any layer rejects the call, the request falls through to the bilingual fallback system rather than hitting the LLM. This stack is shared by all four LLM endpoints (chat, insights, expiry-optimizer, product-assistant) via the checkAILimit() function in src/lib/ai-rate-limit.ts."
  ));

  out.push(h2("4.1 AI Cost Control"));

  out.push(bodyPara(
    "Every LLM call is logged to the AIUsageLog table with the businessId, feature name (e.g., 'chat', 'insights', 'expiry-optimizer', 'product-assistant:check_interactions'), tokensUsed (estimated via a length-divided-by-3.5 heuristic for English/Bangla mixed text), costEstimate (in BDT, computed as tokensUsed divided by 1000 multiplied by 0.03), success boolean, errorMessage, and timestamp. This data feeds the super-admin AI usage dashboard, which shows total platform cost today, top spenders, per-feature breakdown, 7-day trend, and abuse alerts. The cost rate of 0.03 BDT per 1,000 tokens is hardcoded in src/lib/ai-rate-limit.ts and reflects Z.ai GLM-4 pricing \u2014 roughly 18 times cheaper than OpenAI GPT-4o."
  ));

  out.push(h2("4.2 AI Response Cache"));

  out.push(bodyPara(
    "A 24-hour AI response cache is implemented in src/lib/ai-cache.ts and stored in the AIResponseCache Prisma model (not in Redis \u2014 the cache needs to survive Redis restarts). The cache key is a compound of (businessId, feature, normalizedQuery, dataHash). The normalizedQuery is the user's input lowercased with punctuation stripped, so 'Low stock?' and 'low stock' hit the same cache entry. The dataHash is a SHA-256 hex of the underlying data summary (e.g., inventory snapshot, sales history), so if the data changes, the cache automatically misses \u2014 the user never sees a stale AI response. Expired rows are lazily deleted on read, and the daily maintenance cron job runs pruneExpiredCacheEntries() to bulk-clean old rows."
  ));

  out.push(h2("4.3 SQL Router (Zero-Token Path)"));

  out.push(bodyPara(
    "Twenty common natural-language questions are intercepted by the SQL Router in src/lib/sql-router.ts and answered with deterministic Prisma queries \u2014 zero LLM tokens consumed. This single piece of infrastructure can absorb 40 to 60 percent of chat traffic based on the patterns it recognizes. The router matches the user's query against twenty patterns and, on a hit, returns a markdown-formatted response with real data. Only queries that do not match any pattern fall through to the LLM. The super-admin AI usage dashboard tracks SQL router hit count separately from LLM call count, so the founder can see exactly how much money the router is saving."
  ));

  out.push(tableCaption("Table 4.1 \u2014 SQL Router Patterns (Zero-Token Shortcuts)"));
  out.push(makeTable(
    ["#", "User Query Pattern", "What It Returns"],
    [
      ["1", "low stock / low-stock", "Products below reorder level, with current qty + reorder level"],
      ["2", "out of stock / out-of-stock", "Products with zero inventory"],
      ["3", "product count / product-count", "Total product count + active vs. inactive breakdown"],
      ["4", "today sales / today-sales", "Today's sales total, count, top 3 products"],
      ["5", "top selling / top-selling", "Top 10 products by sales quantity (last 30 days)"],
      ["6", "expiring soon / expiring-soon", "Batches expiring in next 30 days, with value at risk"],
      ["7", "expired", "Already-expired batches, with value"],
      ["8", "customers owe / customers-owe", "Outstanding customer credit totals + top debtors"],
      ["9", "owe suppliers / owe-suppliers", "Outstanding supplier payable totals + top creditors"],
      ["10", "inventory value / inventory-value", "Total inventory at cost + at MRP + potential profit"],
      ["11", "total customers / total-customers", "Customer count + new this month"],
      ["12", "total suppliers / total-suppliers", "Supplier count + active this month"],
      ["13", "month sales / month-sales", "This month's sales total + comparison to last month"],
      ["14", "week sales / week-sales", "This week's sales total + comparison to last week"],
      ["15", "recent purchases / recent-purchases", "Last 5 purchase orders with supplier + total"],
      ["16", "categories", "All categories with product count per category"],
      ["17", "today purchases / today-purchases", "Today's purchase total + count"],
      ["18", "returns", "Recent returns with reason + refund amount"],
      ["19", "payments received / payments-received", "Today's payments received by method"],
      ["20", "dashboard summary / dashboard-summary", "Full KPI snapshot (sales, purchases, inventory, expiry)"],
    ],
    [6, 32, 62]
  ));

  out.push(h2("4.4 Fallback System"));

  out.push(bodyPara(
    "When an LLM call fails (Z.ai down, timeout, JSON parse error, rate limit hit), the fallback system in src/lib/ai-fallback.ts returns a graceful response instead of a 500 error. Nine reason codes are defined: llm_unavailable, llm_timeout, rate_limit_daily, rate_limit_monthly, rate_limit_tokens, rate_limit_burst, no_cached_data, parse_error, unknown. Each reason code has both English and Bangla user-facing messages, so the user sees 'AI is temporarily unavailable. Please try again in a few minutes. / \u098f\u0987 \u09b8\u09be\u09ae\u09af\u09bc\u09bf\u0995 \u09b8\u09ae\u09af\u09bc\u09c7 \u09ac\u09cd\u09af\u09b8\u09cd\u09a4 \u0964 \u0995\u09af\u09bc\u09c7\u0995 \u09ae\u09bf\u09a8\u09bf\u099f \u09aa\u09b0 \u0986\u09ac\u09be\u09b0 \u099a\u09c7\u09b7\u09cd\u099f\u09be \u0995\u09b0\u09c1\u09a8 \u0964' An error classifier (classifyError()) matches substrings like 'timeout', 'econnrefused', 'json', '503' to the right reason code. A getLastSuccessfulCall(maxAgeHours) helper surfaces stale-but-safe cached responses when fresh calls fail, so the user still gets value during Z.ai outages."
  ));

  out.push(h2("4.5 AI Usage Logging"));

  out.push(bodyPara(
    "Every AI call, whether successful or failed, writes a row to the AIUsageLog table. The row captures businessId, feature (with sub-action for product-assistant, e.g., 'product-assistant:check_interactions'), tokensUsed (estimated), costEstimate (in BDT), success boolean, errorMessage (if failed), and createdAt. Indexes on (businessId), (feature), (createdAt), and (businessId, createdAt) make the super-admin dashboard queries fast even at scale. This audit trail is the data source for all AI cost reporting in the platform."
  ));

  return out;
}

function buildBackgroundJobsSection() {
  const out = [];
  out.push(h1("5. Background Jobs & Monitoring"));

  out.push(h2("5.1 Cron Jobs"));

  out.push(bodyPara(
    "Three background jobs run on fixed schedules to keep the platform healthy. All three are implemented as API endpoints (POST /api/cron/*) that require an x-cron-secret header for authentication \u2014 the secret refuses placeholder values like 'change-me', 'placeholder', or 'replace-me' as a hardening measure. The cron jobs can be triggered manually by the super-admin via POST /api/super-admin/trigger-cron/[jobName], and their status can be inspected via GET /api/cron/status (which accepts either the cron secret or a super-admin Bearer token)."
  ));

  out.push(bodyPara(
    "Every cron job execution is logged to the CronJobLog table with status (running, success, failed), durationMs, businessesProcessed, recordsWritten, errorMessage, and the full log text. This makes cron job debugging trivial \u2014 the founder can read the exact log of any past execution in the super-admin dashboard. The getCronJobStatuses() helper returns the schedule, latest run, total runs, and 5 most recent failures for each job."
  ));

  out.push(tableCaption("Table 5.1 \u2014 Cron Job Schedule and Purpose"));
  out.push(makeTable(
    ["Job Name", "Schedule (UTC)", "Purpose"],
    [
      ["nightly-stats", "01:00 daily", "Snapshots yesterday's KPIs for every active business into BusinessDailyStats (sales, purchases, payments, returns, inventory valuation, expiry, customers/suppliers, receivables, payables, AI usage). Invalidates dashboard cache after write."],
      ["hourly-subscriptions", "top of every hour", "Auto-suspends businesses with subscriptionEnd < now. Disables AI for suspended pro_ai businesses. Catches expired trials and converts them to suspended status."],
      ["daily-maintenance", "01:30 daily", "Prunes CronJobLog (>90 days), NotificationLog (>30 days), expired OTPs, expired Sessions, expired AIResponseCache entries. Keeps the database lean."],
    ],
    [22, 18, 60]
  ));

  out.push(h2("5.2 Error Tracking & Monitoring"));

  out.push(bodyPara(
    "Sentry is integrated on both client and server. The client config (sentry.client.config.ts) samples 10 percent of production transactions for performance tracing (100 percent in development), captures 100 percent of error replays, denies URLs from browser extensions, and ignores known-noise errors (AbortError, ResizeObserver loop, NEXT_NOT_FOUND, NEXT_REDIRECT). The server config (sentry.server.config.ts) also samples 10 percent of transactions, and ignores Prisma errors that are not real bugs (P2002 unique constraint, P2025 not found, P2028/P2034 transaction conflict), auth typos, and rate-limit 429 responses. This filtering means the founder only sees real bugs in Sentry, not user errors."
  ));

  out.push(bodyPara(
    "A /api/health endpoint provides liveness and readiness probes. It returns a JSON object with status (ok, degraded, or down), database.latencyMs (measured by a SELECT 1), redis.status (connected, disconnected, or disabled), uptime, version, environment, and sentry (DSN configured boolean). The endpoint returns 503 if the database is unreachable (down status), 200 with degraded status if Redis is down but the database is up, and 200 with ok status if everything is healthy. Docker's healthcheck hits this endpoint every 15 seconds, allowing the orchestrator to restart unhealthy containers automatically."
  ));

  out.push(bodyPara(
    "A /api/health/test-error endpoint is also available, gated by the TEST_ERROR_ENABLED environment variable. When enabled, it can throw generic errors, timeout errors, database errors, or send Sentry captureMessage calls \u2014 useful for testing error monitoring during development. This endpoint should always be disabled in production."
  ));

  return out;
}

function buildDevOpsSection() {
  const out = [];
  out.push(h1("6. DevOps, Deployment & Backup"));

  out.push(h2("6.1 DevOps Infrastructure"));

  out.push(bodyPara(
    "InventoryOS ships with a complete Docker setup. The Dockerfile uses a 3-stage build: deps (npm ci to install dependencies), builder (prisma generate + next build to produce the standalone bundle), and runner (copies standalone + static + public, runs as non-root nextjs:nodejs user UID 1001, uses dumb-init as PID 1 for proper signal handling). The docker-compose.yml defines four services on a shared inventoryos-net bridge network: db (Postgres 16-alpine with a named volume), pgbouncer (edoburu/pgbouncer:1.23.1 configured for transaction pooling with 200 max clients, 20 default pool size, 5 reserve), redis (redis:7-alpine with appendonly persistence), and app (the InventoryOS container with a 15-second healthcheck)."
  ));

  out.push(bodyPara(
    "Database and Redis ports are bound to 127.0.0.1 only, so they are not exposed to the public internet. The Caddy reverse proxy (Caddyfile) listens on port 81 and handles TLS termination and dynamic upstream routing. PgBouncer sits between the app and Postgres, pooling database connections in transaction mode \u2014 this means each query borrows a connection from the pool for the duration of a transaction and returns it immediately after, allowing the app to handle many concurrent requests without exhausting Postgres connections."
  ));

  out.push(h2("6.2 Backup & Recovery"));

  out.push(bodyPara(
    "Backup infrastructure is in scripts/backup/. The backup.sh script runs pg_dump with pre-flight checks, then runs verify-backup.js to validate the dump, then retains 7 daily backups and 12 monthly backups (365 days). The verify-backup.js script performs 8 structural checks on the dump file: pg_dump header present, pg_dump footer present, all 29 tables present, COPY statements exist for core tables (Business, User, Product, Sale, etc.), and file size > 50KB. A backup that fails any check is flagged immediately."
  ));

  out.push(bodyPara(
    "The restore.sh script defaults to a TEST database (inventoryos_restore_test) for safety. Restoring to production requires explicitly passing --target=inventoryos AND typing the phrase 'OVERWRITE PRODUCTION' at the prompt. This two-factor confirmation prevents accidental production data overwrites. A monthly DR (disaster recovery) drill script (restore-drill.sh) automates the entire drill: backup, verify, restore to a drill database, compare 21-table row counts between drill and production, spot-check a Business record, drop the drill database, and email an alert with the results. Running this drill monthly is the single best way to ensure backups are actually restorable when needed."
  ));

  out.push(h2("6.3 Migration Tooling"));

  out.push(bodyPara(
    "A SQLite-to-Postgres migration script (scripts/migrate-to-postgres.js) handles the cutover from development to production database. It supports --dry-run (show what would be migrated without writing) and --verify-only (compare row counts between source and target after migration). It handles the Transaction reserved word (which is reserved in Postgres but not in SQLite) by quoting it properly. After migration, it resets Postgres sequences (auto-increment counters) to match the max ID in each table, preventing duplicate-key errors on future inserts."
  ));

  out.push(bodyPara(
    "A persistent server script (scripts/start-persistent.sh) is included for development. It kills any existing Next.js instances, starts a fresh one, and runs a keep-alive watcher that hits /api/businesses/.../categories every 15 seconds to prevent the server from going idle. This is useful for long-running development sessions where the default Next.js dev server might be killed by the environment."
  ));

  return out;
}

function buildSecuritySection() {
  const out = [];
  out.push(h1("7. Security, Super Admin & Data Portability"));

  out.push(h2("7.1 Security"));

  out.push(bodyPara(
    "Security is implemented in depth across multiple layers. Passwords are hashed with bcryptjs at 12 salt rounds (the user password change endpoint uses 10 rounds, which is still well above industry minimum). Session tokens are 32-byte crypto.randomBytes hex strings, stored hashed in the database with a unique constraint, so even a database leak does not expose live tokens. The Transaction model serves as an audit trail for every stock movement (PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN, QUARANTINE, RELEASE) with the createdBy user ID, providing end-to-end accountability."
  ));

  out.push(bodyPara(
    "The FefoOverride model is a DGDA-compliance-specific audit trail: every time staff picks a non-FEFO batch (e.g., because the FEFO batch is damaged or quarantined), the system records the reason (minimum 10 characters), the userId, the expected batch (the one FEFO would have picked), and the selected batch (the one actually picked). This audit trail is required for Bangladesh pharmacy regulators and is exportable via the FEFO Override Report."
  ));

  out.push(bodyPara(
    "Other security measures: every login creates a Session record (login activity log); the Session Manager UI shows all active sessions for all users with masked tokens (first 8 characters only) and allows force-logout; self-service password change requires the current password and optionally invalidates all other sessions; the cron secret refuses placeholder values; the Docker container runs as non-root nextjs:nodejs user (UID 1001); database and Redis ports are bound to 127.0.0.1 only; OTPs expire in 5 minutes and are single-use, with lazy deletion in the maintenance cron."
  ));

  out.push(h2("7.2 Super Admin"));

  out.push(bodyPara(
    "The super-admin system is a separate admin surface at /admin for the platform founder. It uses separate SuperAdmin and SuperAdminSession tables with a 7-day token TTL and Bearer authentication, completely isolated from the business user auth path. The dashboard (src/app/admin/page.tsx, 1891 lines) provides: a login screen, a business list with related counts and current-month AI usage, summary cards (total businesses, active subscriptions, AI cost today, etc.), AI usage analytics (by feature, by business, 7-day trend, top spenders today, abuse flags, SQL router hit rate, cache hit rate), cron job controls (manual trigger, status view), and a business editing dialog (tier, status, AI flag, AI limits, subscription dates)."
  ));

  out.push(bodyPara(
    "The AI usage analytics endpoint (GET /api/super-admin/ai-usage) is particularly powerful. It returns: a summary (total calls, total tokens, total cost today + this month + all-time), per-feature breakdown (calls, tokens, cost, success rate per feature), per-business breakdown (top spenders today + this month), 7-day trend (daily cost chart data), abuse flags (businesses exceeding 80 percent of any rate limit), SQL router hit count (how many free shortcuts were used), and cache hit rate (percentage of AI calls served from cache). This data is the founder's primary tool for monitoring AI cost health."
  ));

  out.push(h2("7.3 Data Portability"));

  out.push(bodyPara(
    "InventoryOS provides multiple data portability features. The CSV template download (GET /api/businesses/[id]/products/template) returns a 21-column CSV template with 3 sample rows (Napa Extra, Amodis, Seclo) and field-guide comments explaining each column. The CSV bulk import (POST /api/businesses/[id]/products/import) accepts JSON {products:[]}, JSON {csv:'...'}, or raw CSV text, with flexible header matching (name, productName, and brand all map to the name field), category name resolution (matches by name or slug), and per-row results showing success or error messages. The CsvImport UI component provides a 4-phase experience: Upload (drag-drop or browse, with template download link), Preview (shows first 5 rows in a table), Importing (spinner with progress), and Complete (success/error summary)."
  ));

  out.push(bodyPara(
    "Full business data export is available at GET /api/businesses/[id]/export with format=json or csv, and a modules query parameter specifying which of 10 module types to include (products, categories, batches, sales, purchases, customers, suppliers, payments, returns, transactions). The export includes a _meta block with exportedAt timestamp, business info, and version. The DataExport UI component provides a module picker with 10 toggleable modules and a format selector. Additionally, individual reports (P&L, Tax, Inventory Valuation, Business Report, Expiry Report) support ?format=csv query parameter for spreadsheet export, and all major reports have a Printer button that calls window.print() for physical printing or PDF generation via the browser."
  ));

  return out;
}

module.exports = {
  buildAIInfraSection,
  buildBackgroundJobsSection,
  buildDevOpsSection,
  buildSecuritySection,
};
