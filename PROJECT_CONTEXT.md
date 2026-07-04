# PROJECT_CONTEXT.md — InventoryOS

> **This file is the single source of truth for project context.**
> Read this FIRST at the start of every new session before doing anything else.
> Update it AFTER every meaningful implementation (see the **Update Protocol** at the bottom).
> The detailed per-task history lives in `worklog.md` — this file is the structured overview.

---

## 0. Quick Orientation (read this first)

| Field | Value |
|---|---|
| **Project name** | InventoryOS |
| **Owner** | Sajid Chowdhury (`github.com/sajidchowdhury`) |
| **Repo** | https://github.com/sajidchowdhury/inventoryos.git |
| **Default branch** | `main` |
| **What it is** | Multi-tenant, mobile-first **pharmacy inventory OS** (one Next.js app, no separate backend) |
| **Primary country** | Bangladesh (BD phone numbers, BDT currency, BD pharmacy catalog) |
| **Stack** | Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind 4 · shadcn/ui · Prisma 6 · PostgreSQL · Redis (optional) · z-ai-web-dev-sdk |
| **Runtime** | `npm run dev` (Node + Turbopack) for dev · `bun` only for prod standalone server |
| **Port** | 3000 |
| **Current state** | Pharmacy module fully built (P1–P5 + AI cost-control + report scheduling Phase A) · 6 other modules stubbed in registry |

**Demo credentials (dev only):**
- Phone: `01787492561` · OTP: `9999` (send-otp always accepts `9999` in dev)
- Per-business username/password is set at registration time.
- Super-admin login: see `scripts/create-super-admin.ts` (default password from `SUPER_ADMIN_DEFAULT_PASSWORD` env).

---

## 1. What InventoryOS Is

InventoryOS is a SaaS-style, multi-tenant inventory management platform targeted at Bangladeshi retail pharmacies. A single Next.js 16 application serves **all tenants** — every business's data is isolated by `businessId` at the API and Prisma query level. The product is mobile-first (the primary end-user is a pharmacist behind a counter) with a desktop super-admin console at `/admin`.

The long-term vision is to support **multiple business verticals** (pharmacy, grocery, restaurant, CCTV shop, mobile shop, electric shop, bakery) via a module registry (`src/lib/modules.ts`). Today only `pharmacy` is `isActive: true`; the other six are placeholders shown on the landing page as "coming soon". Adding a new vertical = adding an entry to `moduleRegistry` plus a `src/modules/<slug>/` folder mirroring the pharmacy layout.

The product's differentiators vs. generic inventory tools are:
1. **Batch + expiry tracking with FEFO** (First-Expiry-First-Out) dispensing engine — critical for pharmacies.
2. **AI features** (shelf-scanner vision, expiry optimizer, smart forecast, smart reorder, AI chat, AI insights, product assistant) gated behind a paid `pro_ai` tier.
3. **A 9-tier AI cost-control defense stack** so a single runaway pharmacy can't bankrupt the platform on LLM tokens.
4. **Automated scheduled reports** that account for BD context: Eid (lunar, must confirm yearly), seasons (winter/summer/monsoon), and epidemic alerts (Dengue, COVID).
5. **Super-admin ops console** at `/admin` for the founder to monitor AI spend, kill switches, cron health, and SMTP config.

---

## 2. Tech Stack & Conventions

### 2.1 Core dependencies
- **Next.js 16.1** (App Router, Turbopack). Server = Node for API routes, Edge for `src/middleware.ts` only.
- **React 19**, **TypeScript 5**.
- **Prisma 6** (`@prisma/client`) on PostgreSQL. SQLite is referenced in `package.json` (legacy) — **ignore it**; only `DATABASE_URL` (Postgres) is used.
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives, `class-variance-authority`, `tailwind-merge`).
- **Zustand** for client state (`src/lib/auth-store.ts`, `src/lib/nav-store.ts`).
- **TanStack Query + Table** for server state and data tables.
- **react-hook-form + zod 4** for forms & validation.
- **Recharts** for charts, **framer-motion** for animation.
- **bcryptjs** for password hashing, **nodemailer** for SMTP.
- **z-ai-web-dev-sdk** (`^0.0.18`) as the LLM/vision provider abstraction.
- **Sentry** (`@sentry/nextjs`) — optional, inert without `SENTRY_DSN`.
- **ioredis** — optional, cache falls back to in-memory `Map` when `REDIS_URL` is unset.

### 2.2 Commands (from `package.json` — do not re-derive)
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000, logs tee'd to `dev.log` |
| `npm run build` | Production build, copies static + public into `.next/standalone` |
| `npm run start` | Prod server via `bun .next/standalone/server.js` |
| `npm run lint` | ESLint (note: pre-existing lint errors exist — see Gotchas) |
| `npm run db:push` | `prisma db push` — sync schema to DB |
| `npm run db:generate` | `prisma generate` — regenerate client |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:reset` | `prisma migrate reset` (DESTRUCTIVE) |

Ad-hoc: `npx tsx prisma/seed.ts` (seed), `npx tsx scripts/create-super-admin.ts` (super-admin), `node scripts/seed-*.js` (kill-switch defaults, report-scheduling calendar).

### 2.3 Folder structure
```
src/
├── app/
│   ├── api/                      # All API routes (App Router conventions)
│   │   ├── auth/                 # send-otp, verify-otp, register, login, owner-login, trusted-device
│   │   ├── businesses/[id]/      # ALL tenant-scoped endpoints (one folder per resource)
│   │   ├── super-admin/          # Founder console endpoints (RBAC: super-admin Bearer token)
│   │   ├── cron/                 # Cron-triggered jobs (auth via x-cron-secret OR super-admin)
│   │   ├── health/               # + /api/health/test-error for Sentry verification
│   │   └── setup-status/         # Public diagnostic — what's configured
│   ├── admin/                    # Super-admin UI at /admin
│   ├── page.tsx                  # Landing → onboarding flow → pharmacy dashboard (single SPA-like page)
│   ├── layout.tsx
│   └── globals.css
├── modules/
│   └── pharmacy/                 # Pharmacy vertical — components/, schema/, services/, routes/, types/
├── components/
│   ├── ui/                       # shadcn/ui primitives (button, card, dialog, ...)
│   ├── ApiAuthProvider.tsx       # Client-side auth context
│   └── ...
├── lib/                          # Server-side utilities — see §4
├── types/                        # Shared TS types (BusinessSlug, BusinessModuleConfig, ...)
├── hooks/
└── middleware.ts                 # Edge auth gate (token presence check only)

prisma/
├── schema.prisma                 # 55 models — see §3
└── seed.ts                       # BusinessType + pharmacy categories

scripts/                          # One-off seed/ops scripts (run with node or tsx)
download/                         # Generated docx/pdf/csv deliverables (committed)
skills/                           # Cloned skill library — NOT part of the app
tool-results/                     # Old screenshot/log artifacts — safe to ignore
worklog.md                        # APPEND-ONLY per-task work log — see §10
AGENTS.md                         # Cursor-cloud-specific ops notes
.env.example                      # Copy to .env and fill in
docker-compose.yml, Caddyfile     # Production infra
```

### 2.4 Conventions
- **API route pattern**: every business-scoped route is under `/api/businesses/[id]/...`. The `[id]` is the `businessId`. The handler calls `requireBusinessUser(req, id)` (from `src/lib/auth.ts`) to verify the session belongs to a user of that business.
- **All mutations write a `Transaction` row** for audit (type ∈ `PURCHASE | SALE | ADJUSTMENT | STOCK_IN | STOCK_OUT | WASTE | RETURN | QUARANTINE | RELEASE | DISPENSE | DISPOSE`).
- **All AI calls** must go through `checkAILimit()` before the LLM and `logAIUsage()` after — see §6.
- **No raw SQL** in routes. Use Prisma. The one exception is `src/lib/sql-router.ts` (super-admin only).
- **Zustand stores** (`auth-store`, `nav-store`) hold client-only state. Server state is TanStack Query.
- **Forms**: `react-hook-form` + `zodResolver` + zod schemas in `src/modules/<slug>/schema/`.

---

## 3. Database Schema (55 Prisma models)

The schema is in `prisma/schema.prisma`. Models group by domain:

### 3.1 Identity & tenancy (8)
- `BusinessType` — seeded slugs: pharmacy, grocery, restaurant, cctv, mobile, electric, bakery (only pharmacy active).
- `User` — phone-first (BD), `name` optional. Has many `Business` via `BusinessUser`.
- `TrustedDevice` — long-lived token that lets a returning owner skip OTP.
- `PhoneAuthToken` — short-lived OTP send/verify trail.
- `Business` — the tenant. Fields include `subscriptionTier`, `subscriptionStatus`, `subscriptionEnd`, `aiEnabled`, `aiDailyLimit`, `aiMonthlyLimit`, `aiTokenBudget`, `ownerEmail`, `ownerWhatsapp`.
- `BusinessUser` — join with role (`owner | admin | manager | pharmacist | cashier | stock_clerk`).
- `Session` — per-business-login session token (Bearer).
- `OtpVerification` — legacy OTP table (still used by some flows; `PhoneAuthToken` is newer).

### 3.2 Catalog & inventory (5)
- `Category` — per-business, hierarchical (`parentId`), color + icon.
- `Product` — per-business pharmacy product (name, generic, strength, dosageForm, scheduleType, manufacturer, rack, mrp, purchasePrice, sku, stripSize, boxSize, reorderLevel, maxStock, etc.).
- `Batch` — per-product batch (batchNo, mfgDate, expiryDate, quantity, status, supplierId). Status auto-calculated: `active | near_expiry | expired | quarantined | destroyed | returned`.
- `Inventory` — per-product aggregate (`quantity`). Synced from `Batch` rows on every mutation.
- `Transaction` — append-only audit log (type, quantity, note, productId, batchId, userId, timestamp).

### 3.3 Sales & customers (6)
- `Customer` — name, phone, balance (credit), notes.
- `Sale` — multi-item sale (subtotal, discount, tax, total, paidAmount, paymentStatus, paymentMethod).
- `SaleItem` — per-line item with FEFO batch breakdown.
- `Payment` — tracks payments against sales (cash/card/credit/mobile).
- `Return` + `ReturnItem` — customer returns.
- `DiscountRule` — percent/flat rules (e.g. 10% bulk, ৳50 senior).

### 3.4 Purchases & suppliers (3)
- `Supplier` — name, code (auto), contactPerson, phone, email, address, balance, totalPurchased, totalPaid.
- `Purchase` — PO (`purchaseNo` = `PO-YYYY-NNNN`), invoice fields, paymentStatus.
- `PurchaseItem` — line items; auto-creates a `Batch` on receive with batchNo/expiry/mrp.

### 3.5 Stock Count Day (SCD) (4)
- `StockCountDay` — a counted-on date with status (draft/in_progress/completed).
- `StockCountZoneSession` — per-zone counting session (multi-zone support).
- `StockCountProductSummary` — per-product expected-vs-counted.
- `StockCountLine` — individual count line with variance + reason.
- Plus `StorageZone` + `ProductZoneAssignment` (4 models total for zone management).

### 3.6 AI infrastructure (8)
- `AIUsageLog` — every AI call (success or fail) with feature, tokens, costEstimate (BDT), fallbackReason.
- `AIResponseCache` — 24h TTL cache (key = businessId + feature + payload hash).
- `AiConfig` — per-business AI config (model selection, prompts).
- `AiProvider` — platform-level provider registry (model names, API keys, pricing).
- `KillSwitch` — audit row when a kill-switch trigger fires (per-business or platform-wide).
- `KillSwitchThreshold` — editable threshold per trigger (4 triggers — see §6).
- `NotificationRecipient` — up to 3 founder emails for kill-switch alerts.
- `ShelfScan` + `ShelfScanItem` — vision-based shelf audit results.

### 3.7 Report scheduling (7) — Phase A
- `ReportSchedule` — founder's schedule (cron-like, target businesses, frequency).
- `ReportOccasion` — point events (Eid, Friday, Puja) — 14 seeded.
- `ReportSeason` — recurring seasonal periods (Winter 1.5× respiratory, Summer 1.3× ORS, Monsoon 2× antimalarial, Autumn 1× baseline).
- `HolidayCalendar` — specific occasion dates per year (24 seeded for 2026–2027; lunar dates marked `isConfirmed=false`).
- `EpidemicAlert` — disease outbreaks (Dengue/COVID templates, inactive by default).
- `GeneratedReport` — the actual report row (status: pending → generated → delivered).
- `ReportDelivery` — per-channel delivery tracking (email + WhatsApp).

### 3.8 Super-admin & platform ops (5)
- `SuperAdmin` + `SuperAdminSession` — founder auth.
- `BusinessDailyStats` — nightly snapshot per business (sales, purchases, inventory, AI usage).
- `CronJobLog` — every cron run.
- `SmtpConfig` — editable SMTP settings (in addition to env vars).
- `MasterManufacturer` + `MasterProduct` — shared catalog (Medex import lives in `download/medex_product_catalog.csv`).

### 3.9 Misc
- `AlertPreference`, `NotificationLog`, `FefoOverride` — per-business alert config + manual FEFO overrides.

**Total: 55 models.** Schema is in active evolution — run `npx prisma db push` after pulling if `schema.prisma` changed.

---

## 4. Server-side libraries (`src/lib/`)

| File | Purpose |
|---|---|
| `db.ts` | Prisma client singleton |
| `auth.ts` | `requireBusinessUser`, `requireSuperAdmin`, session verification |
| `phone-auth.ts` | BD phone normalization, OTP gen/verify |
| `auth-store.ts` | Zustand store for client onboarding flow |
| `nav-store.ts` | Zustand store for pharmacy view routing |
| `rbac.ts` | Role definitions + permission helpers (`ALL_PERMISSIONS`, `ROLE_DEFINITIONS`, `hasPermission`) |
| `use-permissions.ts` | Client hook for permission checks |
| `modules.ts` | Module registry — adding a vertical = adding an entry |
| `feature-gate.ts` | Tier config: `free / pro / pro_ai` → limits + features |
| `cache.ts` | Cache abstraction (Redis or in-memory Map) |
| `email.ts` | Lazy SMTP singleton + `getActiveRecipientEmails()` |
| `cron-jobs.ts` | All cron job runners + `CRON_JOB_NAMES`/`CRON_JOB_SCHEDULES` |
| `schedule-compute.ts` | Computes `nextRunAt` for report schedules |
| `report-generator.ts` | Generates scheduled reports (AI prediction algorithm) |
| `report-predictor.ts` | Applies occasions + seasons + epidemics multipliers |
| `business-contacts.ts` | Resolves owner email/WhatsApp per business |
| `sql-router.ts` | Super-admin-only raw SQL passthrough (read-only) |
| `ai-config.ts` | Per-business AI config resolver |
| `ai-rate-limit.ts` | `checkAILimit()` + `logAIUsage()` — the 9-tier gate |
| `ai-circuit-breaker.ts` | Per-provider circuit breaker |
| `ai-kill-switch.ts` | 4 kill-switch triggers with dynamic thresholds + email alerts |
| `ai-fallback.ts` | Bilingual (EN+BN) fallback responses when AI fails |
| `ai-cache.ts` | 24h response cache (key = businessId + feature + hash) |
| `zai.ts` | z-ai-web-dev-sdk wrapper |
| `zai-vision-models.ts` | Vision model registry |
| `vision-provider.ts` | Vision call abstraction (Gemini-compatible) |
| `shelf-scan-ai.ts` | Shelf scanner AI orchestration |
| `shelf-scan-prompts.ts` | Editable prompts (admin-tunable) |
| `shelf-scan-schema.ts` | Zod schema for shelf-scan LLM output |
| `shelf-scan-parse.ts` | Parses + salvages broken LLM JSON responses |
| `shelf-scan-match.ts` | Matches detected items to master catalog |
| `scd.ts` | Stock Count Day business logic |

---

## 5. Authentication & Multi-tenancy

### 5.1 Onboarding flow (8 steps)
`Landing → Phone → OTP → Discovery → Add Business → Create Login → Login → Dashboard`

- Phone-first: `POST /api/auth/send-otp` (always returns success; OTP `9999` accepted in dev).
- `POST /api/auth/verify-otp` → returns `phoneToken` + discovers existing businesses for that phone.
- New user → `Add Business` step → `POST /api/businesses` (public) → `Create Login` → `POST /api/auth/register` (creates `BusinessUser` with role `owner`, sets username/password).
- Returning user → picks a business → `POST /api/auth/login` → returns `session.token`.
- `trusted-device` flow: owner can mark a device trusted → skips OTP on return.

### 5.2 Middleware (`src/middleware.ts`)
- **Edge runtime** — only checks token presence, never touches Prisma.
- Token sources (priority): `Authorization: Bearer <token>` header → `session_token` cookie.
- `PUBLIC_ROUTES` whitelist: `send-otp`, `verify-otp`, `register`, `login`, `super-admin/login`, `health`, `setup-status`, **and** `/api/businesses:GET` (only GET — mutations need auth).
- For protected routes, the middleware forwards the token as `x-inventory-token` header so route handlers can read it consistently.
- Route handlers then call `requireBusinessUser(req, businessId)` (Node runtime, Prisma available) for full verification + role resolution.

### 5.3 RBAC (see `src/lib/rbac.ts`)
6 roles with curated permission sets:
- `owner` — full access including user management.
- `admin` — same as owner except deleting other owners.
- `manager` — inventory, sales, purchases, reports; no user management.
- `pharmacist` — dispense + batches; no financial reports.
- `cashier` — sales + payments only.
- `stock_clerk` — stock + purchases; no sales.

Permissions follow `<domain>.<action>` pattern (e.g. `batches.quarantine`, `reports.tax`). The client uses `usePermissions()` hook + `<PermissionGate>` component to hide UI.

### 5.4 Multi-tenancy isolation
Every business-scoped Prisma query filters by `businessId`. There is **no global admin override** that reads across tenants except via `/api/super-admin/**` routes (which require a separate super-admin Bearer token). The founder's `/admin` console reads across tenants using super-admin auth.

---

## 6. AI Stack — The 9-Tier Defense

Every AI route handler runs through this ordered gate before any LLM call:

| # | Tier | Implementation | What it blocks |
|---|---|---|---|
| 1 | **Kill switch** | `ai-kill-switch.ts` | Per-pharmacy or platform-wide emergency off (4 dynamic triggers) |
| 2 | **Subscription status** | `ai-rate-limit.ts` | `suspended` or `cancelled` business |
| 3 | **Tier gate** | `feature-gate.ts` | Only `pro_ai` tier has `aiEnabled: true` |
| 4 | **`aiEnabled` flag** | `Business.aiEnabled` | Manual founder override (separate from tier) |
| 5 | **Circuit breaker** | `ai-circuit-breaker.ts` | Per-provider circuit (auto-recovers) |
| 6 | **Burst** | `ai-rate-limit.ts` | 5 calls / 60s rolling window |
| 7 | **Daily** | `ai-rate-limit.ts` | 50 calls / calendar day (overridable per-business) |
| 8 | **Monthly** | `ai-rate-limit.ts` | 1000 calls / calendar month (overridable) |
| 9 | **Token budget** | `ai-rate-limit.ts` | 500K tokens / month (overridable) |

After the LLM call (success OR failure), the handler MUST call `logAIUsage(businessId, feature, tokensUsed, success, opts)` so the super-admin dashboard shows accurate spend.

### 6.1 Kill-switch triggers (Phase 4)
| Trigger | Default threshold | Auto-recover? |
|---|---|---|
| `per_pharmacy_monthly` | 200 BDT/month per pharmacy | No — manual reset |
| `per_pharmacy_24h` | 50K tokens in 24h | No |
| `platform_monthly` | 100K BDT/month platform-wide | No |
| `zai_error_rate` | 10% errors in 1h | Yes — recovers when rate <1% for 30 min |

When a trigger fires: a `KillSwitch` row is created (idempotent — won't duplicate), an email is sent to all `NotificationRecipient`s (up to 3), and the business's AI calls return a bilingual `kill_switch_open` fallback until reset.

### 6.2 AI features (7 endpoints under `/api/businesses/[id]/ai/`)
| Feature | Endpoint | Cached? | LLM? |
|---|---|---|---|
| Shelf scanner | `ai/shelf-scan` | No (image) | Yes (vision) |
| Expiry optimizer | `ai/expiry-optimizer` | 24h | Yes |
| Smart reorder | `ai/reorder` | No | **No** (deterministic; still logs usage) |
| Smart forecast | `ai/forecast` | No | **No** (deterministic; still logs usage) |
| AI insights | `ai/insights` | 24h | Yes |
| Product assistant | `ai/product-assistant` | 7d for `generate_description` + `suggest_category` only | Yes |
| AI chat | `ai/chat` | No | Yes |

**Phase 3 cleanup**: "Demand Forecast" was renamed "Smart Forecast" and "AI Demand Forecasting" → "Smart Forecast" in UI labels (API paths unchanged). ReorderSuggestions shows "Smart Reorder" without AI prefix. This is intentional — deterministic features must not be branded "AI".

---

## 7. Cron Jobs

Defined in `src/lib/cron-jobs.ts`. External scheduler hits `POST /api/cron/<jobName>` with `x-cron-secret` header (= `CRON_SECRET` env). Some jobs also accept a super-admin Bearer token for manual triggering via `/admin`.

| Job | Schedule (UTC) | Purpose |
|---|---|---|
| `nightly-stats` | `0 1 * * *` | Snapshot yesterday's KPIs per business into `BusinessDailyStats` |
| `hourly-subscriptions` | `0 * * * *` | Auto-suspend businesses whose `subscriptionEnd` passed (skips free tier); disables AI for suspended `pro_ai` |
| `daily-maintenance` | `30 1 * * *` | Prune `CronJobLog` (>90d), `NotificationLog` (>30d), expired OTPs/Sessions, expired `AIResponseCache` |
| `weekly-ai-health` | `0 6 * * 1` | Phase 5: weekly AI health summary email to all recipients |
| `report-schedule-checker` | `0 * * * *` | Check active report schedules; create pending `GeneratedReport` rows |
| `report-worker` | `*/2 * * * *` | Phase 4 merged worker — processes pending reports (calls AI) + queued deliveries (email) |
| `report-generator-worker` | `*/5 * * * *` | **@deprecated** — use `report-worker` |
| `report-delivery-worker` | `* * * * *` | **@deprecated** — use `report-worker` |

---

## 8. Subscription Tiers

From `src/lib/feature-gate.ts`:

| Tier | Price (BDT/mo) | Max products | AI? | Multi-user? |
|---|---|---|---|---|
| `free` | 0 | 100 | No | No |
| `pro` | 500 | Unlimited | No | Yes |
| `pro_ai` | 1000 | Unlimited | Yes | Yes |

Unknown/null/undefined tier → resolves to `free` (most restrictive — never accidentally grants elevated access).

`subscriptionStatus` lifecycle: `trial → active → suspended → cancelled`. The hourly cron suspends businesses past `subscriptionEnd`. The super-admin can manually suspend/unsuspend from `/admin`.

---

## 9. Local Dev Setup (from `AGENTS.md`)

The VM doesn't auto-start Postgres. Each session:

1. **Start PostgreSQL**: `sudo pg_ctlcluster 16 main start`
2. **Ensure `.env` exists** (git-ignored, persisted via VM snapshot). If missing, recreate with:
   ```
   DATABASE_URL="postgresql://inventoryos:inventoryos_dev@127.0.0.1:5432/inventoryos?schema=public"
   DIRECT_DATABASE_URL="postgresql://inventoryos:inventoryos_dev@127.0.0.1:5432/inventoryos?schema=public"
   CRON_SECRET="dev-cron-secret"
   NODE_ENV="development"
   ```
   DB role/database were created once: role `inventoryos` / password `inventoryos_dev` / database `inventoryos` (owner `inventoryos`). If missing, recreate via `sudo -u postgres psql` then `npx prisma db push`.
3. **Sync schema**: `npx prisma db push`
4. **Seed**: `npx tsx prisma/seed.ts` (business types + pharmacy categories)
5. **Dev server**: `npm run dev` (port 3000, logs tee to `dev.log`)

### 9.1 Gotchas (READ THESE)
- **The pharmacy UI client (`src/modules/pharmacy/**`) sends fetches with NO auth token** — so in-app product/batch/etc. writes return `401 Authentication required`. This is a **pre-existing app-level issue**, not an env problem. To exercise write endpoints, log in via `POST /api/auth/login` and send `Authorization: Bearer <session.token>` (this is how `scripts/test-*-apis.js` suites work). The onboarding flow (OTP → register → login) works fully in the UI because those routes are public.
- `next dev` uses Turbopack. `npm start` runs the prod standalone build with **bun**, but bun is not required for development.
- A legacy `db/custom.db` (SQLite) file may exist in the repo from an earlier phase — it is **unused**; ignore it.
- `npm run lint` reports pre-existing errors in `AiConfigCard.tsx`, `count-up.tsx`, etc. — these are NOT caused by your changes; don't fix them unless explicitly asked.
- Demo OTP shortcut: `POST /api/auth/send-otp` always accepts OTP `9999` (any phone).
- The `/api/businesses:GET` route is public — anyone can list businesses for a phone. Mutations are gated.

### 9.2 Optional integrations
- **Redis**: set `REDIS_URL`. Without it, cache uses an in-memory `Map` (single-instance only).
- **Sentry**: set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`. Test via `POST /api/health/test-error`.
- **SMTP**: set `SMTP_*` env vars OR configure from `/admin` (stored in `SmtpConfig` table).
- **Z.ai**: set `ZAI_API_KEY` + `ZAI_API_BASE`. Without it, AI calls fail-open to bilingual fallbacks.
- **Cron**: an external scheduler (e.g. cron-job.org, GitHub Actions) must hit `/api/cron/*` with `x-cron-secret` header. There is no internal scheduler.

---

## 10. `worklog.md` — Append-Only Work Log

Every meaningful task gets a section appended to `worklog.md` using this template:

```markdown
---
Task ID: <e.g. phase-4-implementation, 3a-completion, fix-shelf-scan-accuracy>
Agent: <Super Z / Main Agent / agent name>
Task: <one-line description>

Work Log:
- <concrete step 1>
- <concrete step 2>
- ...

Stage Summary:
- <key results / decisions / artifacts produced>
- <files added/modified counts>
- <test results>
```

**Task IDs in use so far** (history):
`phase-0`, `phase-1`, `1a-completion`, `1b-completion`, `2a-completion`, `2b-completion`, `2c-completion`, `3a-completion`, `3b-completion`, `4a-completion`, `4b-completion`, `4c-completion`, `5a-completion`, `6a-completion`, `rebuild-after-disk-reset-gap10-redis`, `ai-analysis-1`, `ai-report-final`, `feature-inventory-1`, `feature-catalog-final`, `ai-report-phased-plan`, `phase1-implementation` (AI P0), `phase2-implementation` (AI P1), `phase3-implementation` (AI P2), `phase4-implementation` (kill-switch), `phase5-implementation` (ops health), `report-sched-phase-a`.

When picking a new Task ID, follow the naming pattern of the closest prior phase (e.g. `report-sched-phase-b` for the next report-scheduling phase).

**Tag history**: `v1.1.0-ai-p0`, `v1.2.0-ai-p1`, `v1.3.0-ai-p2`, `v1.4.0-ai-killswitch`, `v1.5.0-ai-ops`. Use `vX.Y.0-<feature>` semver tags on commits that complete a phase.

---

## 11. Generated Deliverables (`download/`)

These docx/png/csv files are committed to the repo as human-readable specs and reference data:
- `InventoryOS_Technical_Blueprint.docx` — overall architecture
- `InventoryOS_Feature_Catalog.docx` — full feature list
- `InventoryOS_Pharmacy_Roadmap.docx` — phased plan
- `InventoryOS_AI_Features_Report.docx` — AI cost-control analysis (5-phase plan)
- `InventoryOS_Report_Scheduling_Spec.docx` — scheduled reports design
- `InventoryOS_Admin_Panel_Redesign_Spec.docx` — /admin redesign
- `InventoryOS_Master_Catalog_Spec.docx` — shared catalog
- `InventoryOS_Production_Readiness_Plan.docx`, `InventoryOS_SQA_Test_Report.docx`, `InventoryOS_Integration_Test_Report.docx`, `InventoryOS_UI_Redesign_Plan.docx`
- `medex_product_catalog.{csv,json}` — BD pharmacy master catalog (importable)
- `master_catalog_import.csv` — import template
- `ai-cost-scaling.png`, `ai-risk-matrix.png`, `dashboard-test.png`, `phase1-fixed.png` — charts/screenshots

When generating new spec documents, save them to `download/` so they ship with the repo.

---

## 12. Update Protocol (MANDATORY after every implementation)

After every meaningful change, the agent who made the change MUST:

1. **Append to `worklog.md`** using the template in §10 (new `---` section, never overwrite).
2. **Update this `PROJECT_CONTEXT.md`** if the change affects any of:
   - **§3 Database Schema** — added/removed/renamed a Prisma model
   - **§4 Server-side libraries** — added/removed a `src/lib/*.ts` file
   - **§5 Auth & Multi-tenancy** — changed auth flow, RBAC roles, or middleware
   - **§6 AI Stack** — added/removed an AI endpoint, changed the tier gate, added a kill-switch trigger
   - **§7 Cron Jobs** — added/removed/changed a cron schedule
   - **§8 Subscription Tiers** — changed tier prices/limits
   - **§9 Local Dev Setup** — new env var, new gotcha, new command
   - **§11 Deliverables** — new spec doc
   - **The Quick Orientation table in §0** — if the project state materially changed
3. **Bump the version tag** if the change completes a phase (`git tag vX.Y.0-<feature>`).
4. **Run `npx prisma db push` + `npx prisma generate`** if schema changed.
5. **Commit** with a conventional commit message: `feat(<scope>): <desc>`, `fix(<scope>): <desc>`, `docs(<scope>): <desc>`. Scopes seen: `scd`, `ai`, `admin`, `shelf-scanner`. Push to `main` (or open a PR for review).

**Trivial changes** (typo fix, comment, refactor with no behavior change) do NOT require updating this file — just commit with a clear message.

### 12.1 What counts as a "meaningful change"
- New Prisma model or field
- New API route
- New UI view or major component
- New cron job or AI feature
- Change to auth, RBAC, or tier gate
- Change to a gotcha or dev setup step
- New spec doc in `download/`

### 12.2 What does NOT require an update
- Bug fixes that don't change architecture
- Refactors that preserve behavior
- Test additions
- Lint cleanup
- Dependency bumps (unless breaking)

---

## 13. Where to Look First (cheat sheet)

| If you want to... | Look at |
|---|---|
| Add a new AI feature | `src/app/api/businesses/[id]/ai/<feature>/route.ts` + wire into `AIHub.tsx`; copy the rate-limit + cache + fallback pattern from `expiry-optimizer` |
| Add a new business vertical | `src/lib/modules.ts` (registry) + `src/modules/<slug>/` mirroring `src/modules/pharmacy/` |
| Add a new cron job | `src/lib/cron-jobs.ts` (add to `CRON_JOB_NAMES` + `CRON_JOB_SCHEDULES` + `runAllCronJobs`) + `src/app/api/cron/<name>/route.ts` |
| Add a new report | `src/app/api/super-admin/report-scheduling/*` + `src/lib/report-generator.ts` + `src/lib/report-predictor.ts` |
| Add a new permission | `src/lib/rbac.ts` (`ALL_PERMISSIONS` + relevant `ROLE_DEFINITIONS` entries) |
| Add a new DB model | `prisma/schema.prisma` → `npx prisma db push` → `npx prisma generate` → update §3 of this file |
| Add a new super-admin card | `src/app/admin/<Name>Card.tsx` + add to `src/app/admin/page.tsx` |
| Debug a 401 in the UI | The pharmacy UI client sends no token (see §9.1) — test via `scripts/test-*-apis.js` with a real Bearer token |
| Understand task history | `worklog.md` (oldest at top, newest at bottom) |

---

## 14. Open Risks & Known Gaps

- **Pharmacy UI client has no auth token** (§9.1). All in-app writes 401. This needs a client-side session injection (likely via `ApiAuthProvider` reading from `auth-store`).
- **`report-generator-worker` + `report-delivery-worker` are deprecated** but still in `CRON_JOB_NAMES` for backward compat with external schedulers. Migrate any external schedulers to `report-worker` then remove.
- **Lunar Eid dates are `isConfirmed=false`** in `HolidayCalendar` — founder must confirm each year before Eid.
- **Shelf scanner tuned for Bangladesh topical shelves** (`cursor/fix-shelf-scan-accuracy-1746` branch) — re-tune if used in other markets.
- **`db/custom.db` SQLite legacy file** may still be in the repo — safe to delete on a cleanup pass.
- **Pre-existing lint errors** in `AiConfigCard.tsx`, `count-up.tsx` — not blocking but should be cleaned up.

---

## 15. Deployment Workflow — Z.ai Sandbox ↔ GitHub ↔ WHM Production

> **Full strategy documented in `DEPLOYMENT_WORKFLOW.md` — read it before your first push.**

### The two environments
| | Z.ai Sandbox (dev) | WHM Production |
|---|---|---|
| DB | Local PostgreSQL (system service) | Docker container + PgBouncer |
| Runtime | Node.js (`npm run dev`, Turbopack) | Bun (`bun .next/standalone/server.js`) |
| Proxy | None (`:3000` direct) | Caddy (`:81` → `:3000`) |
| Secrets | `.env` (gitignored, local DB URL) | `.env` on server (gitignored, prod DB URL) |

### The Golden Rule
> **The repo is the source of truth for PRODUCTION. Z.ai uses gitignored overrides only.**
>
> If a change only makes sense in Z.ai → it goes in a gitignored file (`.env`, local scripts).
> If a change makes sense in production → it goes in a committed file (`src/**`, `schema.prisma`, etc.).

### Safe to push (environment-agnostic)
`src/**`, `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, `public/**`, `package.json` (deps + lockfiles), `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `components.json`, `src/middleware.ts`, `download/**`, all `.md` docs.

### Never push (gitignored, environment-specific)
`.env`, `.env.local`, `.env.production`, `*.log`, `*.db`, `node_modules/`, `.next/`, `agent-ctx/`, `.z-ai-config`, `tool-results/`.

### Modify with care (committed but environment-sensitive)
`package.json` scripts (`dev`/`build`/`start`), `docker-compose.yml`, `Caddyfile`, `docker/pgbouncer/**`. Only modify these if the change benefits BOTH environments. For Z.ai-only scripts, ADD a new key (e.g., `dev:zai`) — don't modify existing.

### Pre-push guardrail (MANDATORY before every push)
```bash
bash scripts/pre-push-check.sh
```
Verifies no `.env*` files, no `*.log`, no `*.db`, no `agent-ctx/` is staged. Exits non-zero if forbidden files found. Optional: install as a git pre-push hook (see `DEPLOYMENT_WORKFLOW.md` §5).

### Standard workflow
1. Make changes in Z.ai → test at `localhost:3000`
2. `bash scripts/pre-push-check.sh` — must pass
3. `git add` only the files you changed (be selective, avoid `git add .`)
4. `git commit -m "feat(<scope>): <desc>"` → `git push origin main`
5. On WHM: `git pull origin main` → `docker compose exec app npx prisma migrate deploy` (if schema changed) → `docker compose restart app`

### Adding a new env var
1. Add to `.env.example` (committed template, no real values)
2. Add to local Z.ai `.env` (gitignored, real local value)
3. Add to WHM server `.env` via SSH (real prod value)
4. Document in §9 of this file

---

## 16. SCD Enhancement Plan — Phase Tracker

> **Full spec:** `download/InventoryOS_SCD_Enhancement_Plan.docx`
> **Status legend:** Pending → In Progress → Done (commit SHA)

| Phase | Theme | Features | Effort | Status | Commit |
|---|---|---|---|---|---|
| **P1** | Onboarding & Resume | First-time empty state, resume-count UX | 1 session | Done | `v1.6.0-scd-p1` |
| **P2** | Variance UX | Search/filter, reason-for-variance capture | 1 session | Done | `v1.6.1-scd-p2` |
| **P3** | Smart Zones | Zone inheritance from prev SCD + scan-to-assign + manual add from directory | 2 sessions | Done | `v1.6.2-scd-p3` |
| **P4** | Export & History | PDF/Excel export, history detail view | 1 session | Done | `v1.6.3-scd-p4` |
| **P5** | Reminders | Monthly SCD reminder cron job | 1 session | Done | `v1.6.4-scd-p5` |

### P1 — Onboarding & Resume (closes gaps #1, #2)
- **New file:** `src/modules/pharmacy/components/scd/ScdOnboardingCard.tsx`
- **Modify:** `StockCountDayHub.tsx` (render onboarding card when 0 zones + 0 history; add resume-count banner when zoneSession.status === "counting")
- **Schema:** none. **API:** GET /stock-count-day adds zoneSession.lineCount + lastCountedAt
- **Task ID:** `scd-enhance-p1` · **Tag:** `v1.6.0-scd-p1`

### P2 — Variance Search & Reason Capture (closes gaps #3, #4)
- **New schema:** `StockCountProductSummary.varianceReason` (String?), `varianceNote` (String?)
- **New file:** `src/modules/pharmacy/components/scd/VarianceReasonDialog.tsx`
- **Modify:** variance review screen (search input + filter chips + tappable stat cards + reason badges)
- **API:** PATCH /stock-count-day/[scdId] accepts action "setReason"
- **Task ID:** `scd-enhance-p2` · **Tag:** `v1.6.1-scd-p2`

### P3 — Smart Zone Inheritance & Counting-Time Assignment (closes gap #8)
- **New schema:** `ZoneAssignmentSnapshot` model (snapshots ProductZoneAssignment at SCD creation); `StockCountLine.autoAssigned` Boolean
- **New file:** `src/modules/pharmacy/components/scd/ZoneAddProductDialog.tsx`
- **Modify:** start-scd screen (inheritance banner), zone-count screen (add "Add product manually" button), ZoneBulkAssign.tsx (mark optional)
- **API:** POST /stock-count-day snapshots assignments; PATCH zones action=count upserts ProductZoneAssignment; new POST /zones/[id]/add-line
- **Task ID:** `scd-enhance-p3` · **Tag:** `v1.6.2-scd-p3`

### P4 — Export & History Detail (closes gaps #5, #7)
- **New endpoints:** GET /stock-count-day/[scdId]/export?format=pdf|excel
- **New file:** `src/modules/pharmacy/components/scd/ScdExportButtons.tsx`
- **New screen state:** "history-detail" (read-only variance review with export buttons)
- **Schema:** none. Reads existing models.
- **Task ID:** `scd-enhance-p4` · **Tag:** `v1.6.3-scd-p4`

### P5 — Monthly Reminders (closes gap #6)
- **New cron:** `scd-monthly-reminder` (schedule `0 4 25 * *` = 09:00 Asia/Dhaka on 25th)
- **New endpoint:** POST /api/cron/scd-monthly-reminder
- **Modify:** NotificationCenter.tsx (render scd_reminder with "Run count" CTA), SuperAdminHelp.tsx (add help entry)
- **Schema:** none. Uses NotificationLog + Business.ownerEmail.
- **Task ID:** `scd-enhance-p5` · **Tag:** `v1.6.4-scd-p5`

### Recommended sequencing
**P1 → P2 → P3 → P4 → P5** (maximises user-impact-per-session; P4 benefits from P2's reason codes in exports; P5's reminders link to P4's history detail)

### Update protocol for this section
After completing a phase:
1. Append worklog entry with the phase's Task ID
2. Update the Status column above to "Done" + fill the Commit SHA
3. Bump the semver tag (`git tag vX.6.N-scd-pN`)
4. Update `download/InventoryOS_SCD_Enhancement_Plan.docx` Table 10 to match (regenerate via `node /home/z/my-project/scripts/scd-spec-generate.js`)

---

## 17. Purchase Scanner Plan — Phase Tracker

> **Full spec:** `download/InventoryOS_Purchase_Scanner_Plan.docx`
> **Status legend:** Pending → In Progress → Done (tag)
> **Design decision:** One image at a time, accumulate into cart (matches shelf scanner pattern)

| Phase | Theme | Features | Effort | Status | Tag |
|---|---|---|---|---|---|
| **P1** | Vision Scan API | Scan endpoint + invoice prompt + catalog matching | 1–2 sessions | Done | `v1.7.0-purchase-scan-p1` |
| **P2** | Scanner UI | Scan button + image upload + accumulate into cart | 1 session | Done | `v1.7.1-purchase-scan-p2` |
| **P3** | Review & Edit | Edit detected items + link unmatched + confidence | 1 session | Done | `v1.7.2-purchase-scan-p3` |
| **P4** | Polish & Edge Cases | Help text + manual fallback + SuperAdmin docs | 1 session | Done | `v1.7.3-purchase-scan-p4` |

### P1 — Vision Scan API + Catalog Matching
- **New endpoint:** `POST /api/businesses/[id]/ai/purchase-scan` (accepts 1 base64 image, returns detected + matched line items)
- **New file:** `src/lib/purchase-scan-prompts.ts` (invoice-optimized, editable from /admin)
- **Reuse:** `vision-provider.ts`, `shelf-scan-parse.ts` (salvage parser), `shelf-scan-match.ts` patterns
- **AI defense:** checkAILimit + logAIUsage + buildFallback (feature name: "purchase-scan")
- **Optional schema:** `PurchaseScan` model for audit trail (not required for MVP)
- **Task ID:** `purchase-scan-p1` · **Tag:** `v1.7.0-purchase-scan-p1`

### P2 — Scanner UI
- **Modify:** `PurchaseForm.tsx` — add "Scan purchase sheet" button beside search input
- **New file:** `src/modules/pharmacy/components/purchase/PurchaseScannerDialog.tsx` (~250 lines)
- **New file:** `src/modules/pharmacy/components/purchase/ScannedItemList.tsx` (~100 lines)
- **Behavior:** one image at a time → items accumulate → "Add N items to purchase" → cart pre-filled
- **Image compression:** reuse shelf scanner's canvas resize (max 2560px, JPEG 0.85)
- **Task ID:** `purchase-scan-p2` · **Tag:** `v1.7.1-purchase-scan-p2`

### P3 — Review & Edit Scanned Items
- **Modify:** PurchaseForm cart items — confidence dot + "Link to product" button + amber border on low-confidence fields
- **New file:** `src/modules/pharmacy/components/purchase/LinkProductDialog.tsx` (~120 lines)
- **Behavior:** confidence indicators (green/amber/red), link unmatched to catalog, inline edit all fields, remove misdetected items
- **Task ID:** `purchase-scan-p3` · **Tag:** `v1.7.2-purchase-scan-p3`

### P4 — Polish & Edge Cases
- **Modify:** PurchaseScannerDialog — 3 tips in upload state + error fallback ("Retry" + "Add manually")
- **Modify:** `SuperAdminHelp.tsx` — add "Purchase Scanner" help entry
- **Modify:** admin config card — purchase-scan prompt editing
- **New file:** `src/modules/pharmacy/components/purchase/PurchaseScanTips.tsx` (~60 lines)
- **Task ID:** `purchase-scan-p4` · **Tag:** `v1.7.3-purchase-scan-p4`

### Recommended sequencing
**P1 → P2 → P3 → P4** (strictly sequential — each phase's output is the next phase's input. No parallelism.)

### Update protocol for this section
After completing a phase:
1. Append worklog entry with the phase's Task ID (`purchase-scan-pN`)
2. Update the Status column above to "Done" + fill the Tag
3. Bump the semver tag (`git tag v1.7.N-purchase-scan-pN`)
4. Regenerate the docx Table 5 via `node /home/z/my-project/scripts/purchase-scan-spec-generate.js`

---

## 18. Subscription Management System — Phase Tracker

> **Full spec:** `download/InventoryOS_Subscription_System_Plan.docx`
> **Status legend:** Pending → In Progress → Done (tag)
> **Design decisions:** Per-shop billing · 4-stage grace period (active→expiring_soon→read_only→data_wiped) · bKash/Nagad manual + SSL Commerz (P5) · 3-tier pricing (Free/Pro 800/Pro AI 1500)

| Phase | Theme | Features | Effort | Status | Tag |
|---|---|---|---|---|---|
| **P1** | Schema + Per-Shop Model | New billing models + admin phone uniqueness + 3-tier pricing | 1–2 sessions | Done | `v1.8.0-subscription-p1` |
| **P2** | Grace Period Lifecycle | 4-stage enforcement: active→read-only→data-wiped + server guard | 2 sessions | Done | `v1.8.1-subscription-p2` |
| **P3** | Manual Payments (bKash/Nagad) | User submission + super-admin matching + auto-extend | 2 sessions | Done | `v1.8.2-subscription-p3` |
| **P4** | Super-Admin Monitoring | Client-wise status dashboard + revenue tracking + package management | 1–2 sessions | Done | `v1.8.3-subscription-p4` |
| **P5** | SSL Commerz + Toggle | Gateway integration + payment-method toggle + annual billing | 1–2 sessions | Done | `v1.8.4-subscription-p5` |
| **P6** | Notifications + Polish | In-app/email alerts + onboarding + refunds + plan changes | 1 session | Pending | — |

### P1 — Schema + Per-Shop Model + Admin Phone Uniqueness
- **New models:** `SubscriptionInvoice`, `PaymentTransaction`, `ReceivedPayment`
- **Update Business:** +subscriptionStage, +gracePeriodEnd, +dataWipeDate, +dataSoftDeletedAt, +dataPurgeDate
- **Update BusinessUser:** +isAdmin (Boolean)
- **Update feature-gate.ts:** Free=0, Pro=800, Pro AI=1500, +annualPrice field
- **Registration:** phone uniqueness check for admin accounts
- **Task ID:** `subscription-p1` · **Tag:** `v1.8.0-subscription-p1`

### P2 — Grace Period Lifecycle + Read-Only Enforcement
- **New cron:** `subscription-lifecycle` (daily at 02:00 UTC) — transitions 4 stages
- **New lib:** `src/lib/subscription-guard.ts` — `requireActiveSubscription()` server guard on all write endpoints
- **4 stages:** active → expiring_soon (7d before end) → read_only (0-14d after end) → data_wiped (14d+ after end, soft-delete)
- **Soft-delete:** data recoverable for 30 days, true purge after 45 days total
- **Client UI:** disabled write buttons + persistent banner in read-only; payment-only screen in data_wiped
- **Task ID:** `subscription-p2` · **Tag:** `v1.8.1-subscription-p2`

### P3 — Manual Payments (bKash/Nagad)
- **User:** Pay Subscription page (select bKash/Nagad + enter TRX ID + amount)
- **Super-admin:** Received Payments panel (upload received TRX IDs + amounts)
- **Auto-matching:** TRX ID + amount (±5 BDT) match → auto-extend subscription
- **Manual review:** unmatched submissions go to pending queue for super-admin review
- **Task ID:** `subscription-p3` · **Tag:** `v1.8.2-subscription-p3`

### P4 — Super-Admin Monitoring Dashboard
- **New page:** `/admin/clients` — all businesses with stage badges + revenue
- **Revenue cards:** Monthly Expected, Monthly Received, Outstanding, Churn Risk
- **Client detail:** subscription timeline + payment history + manual extend/override
- **Package management:** edit tier prices + toggle payment methods + set account numbers
- **Task ID:** `subscription-p4` · **Tag:** `v1.8.3-subscription-p4`

### P5 — SSL Commerz + Payment Method Toggle + Annual Billing
- **SSL Commerz:** EasyCheckout integration + success/fail/cancel callbacks
- **Toggle:** super-admin chooses active methods (bKash/Nagad/SSL)
- **Annual billing:** pay 10 months, get 12 (8,000/15,000 BDT)
- **New model:** `PaymentConfig` (sslStoreId, sslStorePasswd, sslMode, activeMethods, account numbers)
- **Task ID:** `subscription-p5` · **Tag:** `v1.8.4-subscription-p5`

### P6 — Notifications + Polish + Edge Cases
- **Notifications:** in-app + email for all 7 subscription events (invoice, payment, expiring, expired, wipe warning, wiped, restored)
- **First-time onboarding:** tooltip + trial-ending banner with Subscribe CTA
- **Refunds:** super-admin can refund (reverses extension + logs reason)
- **Plan changes:** upgrade (prorated, immediate) / downgrade (next cycle)
- **New model:** `SubscriptionAdjustment` (audit trail for refunds + manual adjustments)
- **SuperAdminHelp:** 6 new entries
- **Task ID:** `subscription-p6` · **Tag:** `v1.8.5-subscription-p6`

### Recommended sequencing
**P1 → P2 → P3 → P4 → P5 → P6** (strictly sequential — each phase's output is the next phase's input)

### Update protocol for this section
After completing a phase:
1. Append worklog entry with the phase's Task ID (`subscription-pN`)
2. Update the Status column above to "Done" + fill the Tag
3. Bump the semver tag (`git tag v1.8.N-subscription-pN`)
4. Regenerate the docx Table 13 via `node /home/z/my-project/scripts/subscription-spec-generate.js`

---

**This file is the contract between sessions. Keep it accurate. When in doubt, update it.**
