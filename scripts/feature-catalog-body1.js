// Feature Catalog Body Part 1: How to Use + Part 1 Divider + Tech Foundation + Auth + DB & Cache
const H = require("./ai-report-helpers");
const {
  P, c, h1, h2, h3, bodyPara, bodyParaRich, tr, calloutPara,
  bulletItem, tableCaption, makeTable, spacer,
  Paragraph, TextRun, AlignmentType, PageBreak,
} = H;

function buildHowToUse() {
  const out = [];
  out.push(h1("How to Use This Document"));

  out.push(bodyPara(
    "This document is a complete inventory of every feature currently shipping in InventoryOS. It is organized into two parts. Part 1 (Technical Features) catalogs the infrastructure, architecture, security, and DevOps foundation \u2014 the capabilities the system HAS. Part 2 (Business Features) catalogs what the pharmacy owner GETS \u2014 the capabilities they can use in the app on a daily basis. Use Part 1 when talking to technical stakeholders, investors, or prospective clients evaluating the platform's reliability. Use Part 2 when pitching to pharmacy owners, building marketing materials, or planning product roadmap."
  ));

  out.push(bodyPara(
    "Each feature entry includes the feature name, a one-to-two sentence description of what it does, and the primary file path(s) where it is implemented so you can verify any claim by reading the code. The document is intentionally exhaustive rather than curated \u2014 every feature that exists in the codebase is listed here, including features that are technically working but not yet wired to the UI (those are flagged explicitly in Section 18). This is your reference for what you are actually shipping to your clients."
  ));

  out.push(h2("Quick-Glance Asset Summary"));

  out.push(tableCaption("Table 0.1 \u2014 Total Assets in InventoryOS"));
  out.push(makeTable(
    ["Asset", "Count", "Location"],
    [
      ["API route files", "84", "src/app/api/**"],
      ["Pharmacy UI components", "61", "src/modules/pharmacy/components/"],
      ["Prisma models", "30", "prisma/schema.prisma"],
      ["Lib infrastructure files", "15", "src/lib/"],
      ["Scripts (test, backup, migration, generation)", "~52", "scripts/"],
      ["shadcn/ui primitives", "60+", "src/components/ui/"],
      ["Subscription tiers", "3 (free / pro / pro_ai)", "src/lib/feature-gate.ts"],
      ["RBAC roles", "6 (owner / admin / manager / pharmacist / cashier / stock_clerk)", "src/lib/rbac.ts"],
      ["RBAC permissions", "41 across 13 namespaces", "src/lib/rbac.ts"],
      ["SQL Router patterns (free AI shortcuts)", "20", "src/lib/sql-router.ts"],
      ["Cron jobs (background)", "3", "src/lib/cron-jobs.ts"],
      ["Business modules registered", "7 (pharmacy active, 6 coming soon)", "src/lib/modules.ts"],
    ],
    [40, 30, 30]
  ));

  out.push(bodyPara(
    "These numbers are the headline metrics you can quote in any conversation about the platform's scope. Eighty-four API routes means eighty-four distinct backend capabilities the system can perform. Sixty-one UI components means sixty-one distinct screens, dialogs, or widgets the user can interact with. Thirty Prisma models means the database tracks thirty distinct business entity types. These are not vanity metrics \u2014 each one represents a real, working feature that has been built, tested, and is shipping today."
  ));

  return out;
}

function buildPart1Divider() {
  const out = [];
  // Page break to start Part 1 on a fresh page
  out.push(new Paragraph({
    children: [new PageBreak()],
  }));

  // Large centered title
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 3600, after: 480, line: 720, lineRule: "atLeast" },
    children: [new TextRun({
      text: "PART 1",
      size: 36, bold: true, color: c(P.accent),
      font: { ascii: "Calibri" }, characterSpacing: 80,
    })],
  }));

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600, line: 720, lineRule: "atLeast" },
    children: [new TextRun({
      text: "Technical Features",
      size: 56, bold: true, color: c(P.primary),
      font: { ascii: "Calibri" },
    })],
  }));

  // Accent divider
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    border: { bottom: { style: H.BorderStyle.SINGLE, size: 12, color: c(P.accent), space: 8 } },
    indent: { left: 3000, right: 3000 },
    children: [],
  }));

  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, lineRule: "atLeast" },
    indent: { left: 1800, right: 1800 },
    children: [new TextRun({
      text: "This section catalogs every capability the system HAS \u2014 the infrastructure, architecture, security, and DevOps foundation that makes the business features possible. These are the strengths you can highlight to technical stakeholders, investors, and prospective clients evaluating the platform's reliability and scalability.",
      size: 22, italics: true, color: c(P.body),
      font: { ascii: "Calibri" },
    })],
  }));

  return out;
}

function buildTechFoundation() {
  const out = [];
  out.push(h1("1. Technical Foundation"));

  out.push(h2("1.1 Tech Stack"));

  out.push(bodyPara(
    "InventoryOS is built on a modern, production-grade JavaScript stack optimized for the Bangladesh market. The frontend uses Next.js 16 with the App Router, React 19, and TypeScript 5, providing server components, streaming, and type safety. Styling is handled by Tailwind CSS 4 combined with shadcn/ui (sixty-plus Radix-based primitives), giving a consistent, accessible component library. State management is split between Zustand 5 (for auth and navigation stores with persist middleware) and React Hook Form paired with Zod 4 for form validation. Animations use Framer Motion, and charts use Recharts 2."
  ));

  out.push(bodyPara(
    "The backend uses Prisma 6 as the ORM, with SQLite for local development and PostgreSQL 16 for production. Redis 7 is used as an optional cache and queue backend, auto-detected via the REDIS_URL environment variable with an in-memory fallback for development. PgBouncer 1.23 sits in front of Postgres in transaction-pooling mode to handle connection scaling. Sentry Next.js handles error tracking and performance tracing on both client and server. The AI layer uses the z-ai-web-dev-sdk package for LLM calls. Passwords are hashed with bcryptjs at 12 salt rounds. The whole stack runs on Bun in production, behind a Caddy reverse proxy."
  ));

  out.push(tableCaption("Table 1.1 \u2014 Tech Stack by Layer"));
  out.push(makeTable(
    ["Layer", "Technology", "Purpose"],
    [
      ["Frontend framework", "Next.js 16 + React 19", "App Router, server components, streaming"],
      ["Language", "TypeScript 5", "Type safety across frontend + backend"],
      ["Styling", "Tailwind CSS 4 + shadcn/ui", "Utility-first CSS + 60+ accessible primitives"],
      ["State management", "Zustand 5 + React Hook Form + Zod 4", "Global state + form validation"],
      ["Animations", "Framer Motion", "Page transitions, micro-interactions"],
      ["Charts", "Recharts 2", "Dashboard charts, sales trends, expiry timelines"],
      ["ORM", "Prisma 6", "Type-safe database access, migrations, schema"],
      ["Database", "PostgreSQL 16 (prod) + SQLite (dev)", "Relational data store"],
      ["Connection pooler", "PgBouncer 1.23", "Transaction pooling, 200 max clients"],
      ["Cache", "Redis 7 (optional)", "Dual-backend with in-memory fallback"],
      ["AI / LLM SDK", "z-ai-web-dev-sdk", "GLM-4 chat completions"],
      ["Auth", "bcryptjs (12 rounds) + crypto.randomBytes", "Password hashing + session tokens"],
      ["Error tracking", "Sentry Next.js", "Client + server error capture, performance tracing"],
      ["Reverse proxy", "Caddy", "TLS termination, dynamic upstream routing"],
      ["Production runtime", "Bun", "Fast Node-compatible JS runtime"],
      ["Containerization", "Docker (3-stage Dockerfile) + docker-compose", "4-service stack: db, pgbouncer, redis, app"],
    ],
    [24, 30, 46]
  ));

  out.push(h2("1.2 Architecture"));

  out.push(bodyPara(
    "InventoryOS is a multi-tenant SaaS where every business is isolated by businessId. Every database entity from Product down to AIUsageLog carries a businessId foreign key with onDelete: Cascade, so deleting a business cleanly removes all its data. A Module Registry pattern in src/lib/modules.ts defines seven business types (pharmacy, grocery, restaurant, cctv, mobile, electric, bakery), with only pharmacy currently active. The other six are registered with isActive: false, ready to be activated as the platform expands to other verticals."
  ));

  out.push(bodyPara(
    "Authentication is enforced at the Edge runtime via middleware (src/middleware.ts). The middleware intercepts every request to /api/businesses/* and /api/super-admin/*, extracts the Bearer token or session_token cookie, and forwards it via the x-inventory-token header. Requests without a token receive a 401 before any backend code runs. This keeps the auth check fast (Edge runtime, no DB round-trip) and consistent across all routes."
  ));

  out.push(bodyPara(
    "The pharmacy UI uses a 5-tab mobile-first navigation (Home, Stock, Sell, AI, More) implemented in BottomNav.tsx. A hub-and-spoke view system in src/lib/nav-store.ts routes between 47 distinct PharmacyView values without using URL-based routing, which keeps the mobile UX snappy. The Next.js build produces a standalone server bundle (.next/standalone/server.js) optimized for Docker deployment. A /api/health endpoint exposes liveness and readiness probes returning database latency, Redis status, uptime, version, and environment \u2014 used by Docker's healthcheck (every 15 seconds) and by orchestrators like Kubernetes or Caddy."
  ));

  return out;
}

function buildAuthSection() {
  const out = [];
  out.push(h1("2. Authentication & Authorization"));

  out.push(h2("2.1 Authentication"));

  out.push(bodyPara(
    "InventoryOS uses a phone-first authentication flow designed for the Bangladesh market. Users enter a Bangladeshi phone number (validated against the +8801XXXXXXXXX pattern), receive a 4-digit OTP via SMS (in development, the demo OTP is 9999 for the seed phone 01787492561), and verify it within a 5-minute window. OTPs are single-use (tracked by an isUsed flag in the OtpVerification table) and lazily deleted by the daily maintenance cron job. Once verified, the user creates a per-business login (username + password scoped to a compound unique constraint on businessId + username)."
  ));

  out.push(bodyPara(
    "Session tokens are 32-byte crypto-random hex strings, stored hashed in the Session table with an expiresAt timestamp and deviceInfo (user agent, IP). Sessions are validated on every API request by looking up the token in the database. The Super Admin system uses a separate auth path: a SuperAdmin/SuperAdminSession table pair with a 7-day token TTL and Bearer authentication, completely isolated from the business user auth path. This means a compromise of business user tokens cannot affect the super-admin surface."
  ));

  out.push(h2("2.2 RBAC (Role-Based Access Control)"));

  out.push(bodyPara(
    "InventoryOS ships with a complete RBAC system in src/lib/rbac.ts. Six roles are defined (owner, admin, manager, pharmacist, cashier, stock_clerk) covering every staffing pattern a pharmacy might have. Each role has a default set of permissions across 13 namespaces (dashboard, products, batches, sales, customers, suppliers, purchases, expiry, reports, alerts, users, transactions, ai). Forty-one distinct permission strings are defined \u2014 for example, products:create, batches:quarantine, sales:refund, reports:tax:view. The owner role has all 41 permissions; the stock_clerk role has approximately 12 (mostly read + inventory adjustments)."
  ));

  out.push(bodyPara(
    "Per-user permission overrides are supported via a JSON column on BusinessUser.permissions. When this column is null, the user inherits their role's default permissions. When it is set, the JSON object is merged with the role defaults, allowing granular additions or removals. The client-side usePermissions(businessId) hook fetches the user's effective permission set and exposes hasPermission(perm) and hasAnyPermission(perms) helpers. A <PermissionGate> component declaratively hides UI elements based on permission, so unauthorized users never even see buttons they cannot click."
  ));

  out.push(tableCaption("Table 2.1 \u2014 RBAC Roles and Default Permission Scope"));
  out.push(makeTable(
    ["Role", "Permission Count (approx)", "Typical Staff Member"],
    [
      ["owner", "41 (all)", "Pharmacy owner / proprietor"],
      ["admin", "38 (no super-admin actions)", "Senior manager / co-owner"],
      ["manager", "32 (no user management)", "Shift manager"],
      ["pharmacist", "26 (no financial reports)", "Licensed pharmacist"],
      ["cashier", "14 (sales + payments only)", "Front-counter cashier"],
      ["stock_clerk", "12 (inventory + batches only)", "Stock room staff"],
    ],
    [22, 38, 40]
  ));

  return out;
}

function buildDBCacheSection() {
  const out = [];
  out.push(h1("3. Database & Caching"));

  out.push(h2("3.1 Database Layer"));

  out.push(bodyPara(
    "InventoryOS uses Prisma 6 as its ORM, with thirty models defined in prisma/schema.prisma. The models span every business domain: core (BusinessType, User, Business, BusinessUser, Category, Product, Batch, Inventory), sales (Sale, SaleItem, Payment, Return, ReturnItem, Customer, DiscountRule), purchases (Supplier, Purchase, PurchaseItem), expiry (Batch with status field, FefoOverride), AI (AIUsageLog, AIResponseCache), admin (SuperAdmin, SuperAdminSession), and ops (Session, OtpVerification, AlertPreference, NotificationLog, Transaction, BusinessDailyStats, CronJobLog)."
  ));

  out.push(bodyPara(
    "The development environment uses SQLite for fast iteration; production uses PostgreSQL 16. A migration script (scripts/migrate-to-postgres.js) handles the SQLite-to-Postgres cutover with --dry-run and --verify-only modes, handles the Transaction reserved word (which is reserved in Postgres but not SQLite), validates JSON columns, and resets Postgres sequences after migration. In production, two DATABASE_URLs are configured: a pooled runtime URL (with ?pgbouncer=true&connection_limit=1) used by the app, and a DIRECT_DATABASE_URL used only by Prisma migrations (which cannot run through PgBouncer)."
  ));

  out.push(bodyPara(
    "Indexes are placed on every query column \u2014 for example, the Batch table has a compound index on (expiryDate, status, supplierId) because the expiry dashboard filters by all three. Compound unique constraints enforce data integrity: (businessId, invoiceNo) on Sale, (businessId, username) on BusinessUser, (businessId, date) on BusinessDailyStats, and (businessId, feature, normalizedQuery, dataHash) on AIResponseCache. Foreign keys to Customer and Supplier use onDelete: SetNull rather than Cascade, so deleting a customer preserves their historical sales records (the customerId becomes null but the sale remains). A Prisma global singleton in src/lib/db.ts prevents hot-reload connection storms during development."
  ));

  out.push(h2("3.2 Caching Layer"));

  out.push(bodyPara(
    "InventoryOS implements a dual-backend cache in src/lib/cache.ts. When REDIS_URL is set (production), the cache uses ioredis with SCAN-based prefix invalidation. When REDIS_URL is not set (development), the cache falls back to an in-memory Map with TTL timers. The backend is auto-detected via a Proxy-based singleton that lazy-loads on first access, so the rest of the code never needs to know which backend is active. A getOrCompute<T> helper provides read-through caching: if the key exists, return it; otherwise, compute the value, store it with a TTL, and return it."
  ));

  out.push(bodyPara(
    "Eleven named TTLs are defined for different cache categories, ranging from 120 seconds (PRODUCT_LIST, SALES_LIST, BATCH_LIST) to 3600 seconds (VALUATION, EXPIRY_STATS). Invalidation helpers (invalidateOnSale, invalidateOnPurchase, invalidateOnProductChange, invalidateOnBatchChange, invalidateOnPayment) automatically clear the relevant cache prefixes when underlying data changes, so the user never sees stale data. Redis health is exposed via the /api/health endpoint (isRedisEnabled and isRedisConnected booleans), which allows monitoring to detect cache backend failures before they affect users."
  ));

  out.push(tableCaption("Table 3.1 \u2014 Cache TTL Presets"));
  out.push(makeTable(
    ["Cache Key Prefix", "TTL (seconds)", "Used For"],
    [
      ["dashboard", "300 (5 min)", "Pharmacy dashboard stats"],
      ["business-dash", "600 (10 min)", "Unified business dashboard KPIs"],
      ["valuation", "3600 (1 hour)", "Inventory valuation report data"],
      ["expiry-stats", "3600 (1 hour)", "Expiry dashboard aggregations"],
      ["analytics", "900 (15 min)", "Sales analytics dashboard"],
      ["product-list", "120 (2 min)", "Product list page results"],
      ["categories", "600 (10 min)", "Category list (rarely changes)"],
      ["sales-list", "120 (2 min)", "Recent sales list"],
      ["batch-list", "120 (2 min)", "Batch list per product"],
      ["stats", "300 (5 min)", "Generic stats endpoints"],
      ["ai-cache", "86400 (24 hours)", "AI response cache (separate table)"],
    ],
    [30, 22, 48]
  ));

  return out;
}

module.exports = {
  buildHowToUse,
  buildPart1Divider,
  buildTechFoundation,
  buildAuthSection,
  buildDBCacheSection,
};
