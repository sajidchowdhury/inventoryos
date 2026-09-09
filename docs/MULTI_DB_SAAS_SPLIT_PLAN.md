# InventoryOS → Multi-Database SaaS Split — Execution Plan

> **Goal**: Transform InventoryOS from a single-database monolith into a platform where each business module (CCTV, Pharmacy, Mobile Shop) runs as its own independent SaaS with a separate database, while sharing a common control plane for authentication, subscriptions, and super-admin management.

---

## Architecture Overview

```
                    inventoryos.com (Landing Page)
                          |
           ┌──────────────┼──────────────┐
           │              │              │
    inventoryos.com   inventoryos.com   inventoryos.com
         /cctv          /pharmacy        /mobileshop
           │              │              │
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │ CCTV DB │    │ Pharmacy│    │ Mobile  │
     │ (clean) │    │   DB    │    │ Shop DB │
     │Product  │    │Product  │    │Product  │
     │Sale     │    │Sale     │    │Sale     │
     │Purchase │    │Purchase │    │Purchase │
     │Repair   │    │Batch    │    │Mushak   │
     └────┬────┘    └────┬────┘    └────┬────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
                ┌────────────────┐
                │  Control Plane  │
                │   Database      │
                │                 │
                │ Business        │
                │ User           │
                │ BusinessUser   │
                │ Subscription   │
                │ PaymentTxn     │
                │ SuperAdmin     │
                │ MasterCatalog  │
                └────────────────┘
```

---

## Phase 1 — Schema Split (Preparation)

**Objective**: Split the single 129-model `prisma/schema.prisma` into 4 separate schema files. All 4 still point at the same database — this is zero-risk preparation work.

### Session 1.1 — Audit + Categorize All 129 Models

**Tasks**:
- List every model from `prisma/schema.prisma`
- Classify each into one of 4 buckets:
  - **Core (control plane)**: Business, User, BusinessUser, BusinessType, SuperAdmin, SuperAdminSession, SubscriptionInvoice, PaymentTransaction, PaymentConfig, ReceivedPayment, SubscriptionAdjustment, CronJobLog, AiConfig, AiProvider, KillSwitch, KillSwitchThreshold, NotificationRecipient, ReportSchedule, ReportOccasion, ReportSeason, HolidayCalendar, EpidemicAlert, ReportDelivery, SmtpConfig, TrustedDevice, PhoneAuthToken, OtpVerification, Session, MasterManufacturer, MasterProduct, ShelfScanItem, SystemBackup, TenantBackup, BackupAuditLog, GeneratedReport, AIUsageLog, AIResponseCache, BusinessDailyStats, AlertPreference, NotificationLog, PurchaseOrderSerialNumber
  - **CCTV module (21)**: CCTVCategory, CCTVProduct, CCTVSerialItem, CCTVCustomer, CCTVSupplier, CCTVPurchase, CCTVPurchaseItem, CCTVSale, CCTVSaleItem, CCTVPayment, CCTVExpense, CCTVReturn, CCTVReturnItem, CCTVWarrantyClaim, CCTVSerialHistory, CCTVRepair, CCTVSupplierReplacement, CCTVEstimate, CCTVEstimateItem, CCTVStockMovement, CCTVLedgerEntry
  - **Pharmacy module (24)**: Category, Product, Batch, Inventory, Transaction, Customer, Sale, SaleItem, Payment, Return, ReturnItem, DiscountRule, Supplier, Purchase, PurchaseItem, FefoOverride, ShelfScan, StorageZone, ProductZoneAssignment, StockCountDay, StockCountZoneSession, StockCountProductSummary, StockCountLine, ZoneAssignmentSnapshot
  - **Mobile Shop module (43)**: MSCategory, MSProduct, MSSerialItem, MSSerialItemHistory, MSKitDefinition, MSKitComponent, MSBranch, MSTransfer, MSTransferItem, MSJobCard, MSJobCardPart, MSTechnician, MSCommissionRule, MSCommissionRecord, MSOutsourcedVendor, MSSale, MSSaleItem, MSPayment, MSEmiPlan, MSEmiInstallment, MSLoyaltyConfig, MSLoyaltyTransaction, MSLoyaltyOffer, MSWarrantyClaim, MSProject, MSSiteSurvey, MSCameraPosition, MSCableRoute, MSAmcContract, MSAmcVisit, MSInstallationTask, MSTaskChecklist, MSNbrConfig, MSHsCodeMapping, MSMushakInvoice, MSMushakLineItem, MSVatReturn, MSPurchase, MSPurchaseItem, MSReturn, MSReturnItem, MSExpense, MSMasterProduct, MSProduct (if separate from MSProduct)
- Document any edge cases (models that span multiple modules)
- Produce a classification spreadsheet/table for review

**Deliverable**: `docs/model-classification.md` — a table listing all 129 models with their assigned bucket

### Session 1.2 — Create 4 Separate Schema Files

**Tasks**:
- Create `prisma/schemas/core.prisma` — all control-plane models + datasource + generator
- Create `prisma/schemas/cctv.prisma` — all 21 CCTV models (keep `cCTV` prefix for now)
- Create `prisma/schemas/pharmacy.prisma` — all 24 pharmacy models
- Create `prisma/schemas/mobileshop.prisma` — all 43 MS models
- Each file has its own `datasource` block (all pointing at the same `DATABASE_URL` for now)
- Each file has its own `generator` block (producing separate Prisma clients)
- Keep the original `prisma/schema.prisma` as a backup (rename to `schema.monolith.prisma.bak`)
- Verify that `prisma generate` works for all 4 schemas independently

**Key decisions**:
- The `Business` model stays in `core.prisma` — it's the tenant root
- All cross-module FK references to `Business` become **soft references** (`businessId String` + index, no Prisma `@relation`)
- Master catalogs (`MasterProduct`, `MSMasterProduct`, `MasterManufacturer`) stay in `core.prisma` — they're shared

**Deliverable**: 4 working `.prisma` files + 4 separate Prisma clients generated

### Session 1.3 — Fix Naming Debt in Business Model

**Tasks**:
- The `Business` model has relation fields named `cctvCategories`, `cctvProducts`, etc. but they point at `MS*` models (renamed from CCTV to Mobile Shop in a prior refactor)
- Rename all `cctv*` relation fields on `Business` to `ms*` (e.g., `cctvCategories` → `msCategories`)
- This must be done in `core.prisma` since `Business` lives there
- Create a migration that renames the relation fields (no data change, just schema metadata)

**Deliverable**: Clean `Business` model with correctly-named relation fields

---

## Phase 2 — Database Router Infrastructure

**Objective**: Build the plumbing that routes database queries to the correct PrismaClient based on the business type. All 4 clients still point at the same physical database.

### Session 2.1 — Create Prisma Multi-Client Setup

**Tasks**:
- Create `src/lib/prisma-clients.ts`:
  - Import 4 separate generated Prisma clients (one per schema)
  - Initialize 4 singleton instances (one per database)
  - Each reads its own environment variable: `CORE_DB_URL`, `CCTV_DB_URL`, `PHARMACY_DB_URL`, `MOBILESHOP_DB_URL`
  - For now, all 4 env vars point at the same `DATABASE_URL` — but the plumbing is ready
- Create `src/lib/db-router.ts`:
  - `dbCore` — always returns the control-plane client (for auth, subscriptions, admin)
  - `dbForBusiness(businessId)` — looks up the business type from core DB, returns the matching module client
  - `dbForModule(moduleSlug)` — returns the client for a module slug ('cctv', 'pharmacy', 'mobileshop')
  - Cache the business-type lookup in a Map (avoid a core-DB query on every request)
- Replace `src/lib/db.ts` exports with re-exports from the router (backward compat during migration)

**Deliverable**: `src/lib/prisma-clients.ts` + `src/lib/db-router.ts` — working multi-client setup

### Session 2.2 — Create Module Context Middleware

**Tasks**:
- Create a Next.js middleware or helper that:
  - Reads the business ID from the request (URL param, session, or header)
  - Looks up the business type from the core database
  - Attaches the correct PrismaClient to the request context
  - Throws 400 if a CCTV business tries to access pharmacy routes (and vice versa)
- Update `src/lib/tenant-db.ts` (`withTenant()`) to use the router:
  - Before: `withTenant(businessId, cb)` → single DB with RLS
  - After: `withTenant(businessId, cb)` → router picks the right module DB, still applies RLS within it
- The existing RLS policies (Phase 9 migration) stay in each module database — they filter by `businessId` within the module's tables

**Deliverable**: Working `withTenant()` that routes to the correct module database

### Session 2.3 — Create Module Guard Utility

**Tasks**:
- Create `src/lib/module-guard.ts`:
  - `assertModule(businessId, expectedModule)` — throws 400 if the business's type doesn't match
  - Prevents a pharmacy business from accidentally hitting CCTV API routes
  - Can be used as a one-liner at the top of any API route: `assertModule(businessId, 'cctv')`
- Add it to the existing `requireActiveSubscription` guard chain:
  - Subscription guard → module guard → business logic

**Deliverable**: `src/lib/module-guard.ts` + integrated into the guard chain

---

## Phase 3 — Refactor API Routes

**Objective**: Replace `import { db }` with the router in every CCTV, pharmacy, and mobile-shop API route. This is the most tedious phase but each file is an independent change.

### Session 3.1 — Refactor CCTV API Routes (41 route files)

**Tasks**:
- Go through every file in `src/app/api/businesses/[id]/cctv/`:
  - Replace `import { db } from '@/lib/db'` with `import { dbForBusiness } from '@/lib/db-router'`
  - At the start of each handler, add `const db = await dbForBusiness(businessId)`
  - Remove the `cCTV` prefix from model accessors (e.g., `db.cCTVProduct` → `db.product`)
  - This is possible because the CCTV schema no longer needs prefixes when it's in its own database
- Test each route individually after refactoring
- Files to refactor (41 total):
  - `cctv/products/route.ts` + `cctv/products/[productId]/route.ts` + `cctv/products/import/route.ts`
  - `cctv/categories/route.ts` + `cctv/categories/[categoryId]/route.ts`
  - `cctv/customers/route.ts` + `cctv/customers/[customerId]/route.ts`
  - `cctv/suppliers/route.ts` + `cctv/suppliers/[supplierId]/route.ts`
  - `cctv/sales/route.ts` + `cctv/sales/[saleId]/route.ts` + `cctv/sales/[saleId]/items/route.ts`
  - `cctv/purchases/route.ts`
  - `cctv/expenses/route.ts` + `cctv/expenses/[expenseId]/route.ts`
  - `cctv/repairs/route.ts` + `cctv/repairs/[repairId]/route.ts`
  - `cctv/estimates/route.ts` + `cctv/estimates/[estimateId]/route.ts` + `cctv/estimates/[estimateId]/convert/route.ts`
  - `cctv/payments/route.ts`
  - `cctv/serial-items/route.ts` + `cctv/serial-history/route.ts`
  - `cctv/supplier-replacements/route.ts` + `cctv/supplier-replacements/[replacementId]/route.ts`
  - `cctv/warranties/route.ts`
  - `cctv/dashboard/route.ts`
  - `cctv/monthly-upload/route.ts`
  - `cctv/reports/` (all 13 report routes)
  - `cctv/profile/route.ts`

**Deliverable**: All 41 CCTV API routes use the database router

### Session 3.2 — Refactor Pharmacy API Routes (~40 route files)

**Tasks**:
- Same process as Session 3.1 but for pharmacy routes
- Replace `db.product` (which currently accesses the pharmacy Product model) with `dbForBusiness(businessId).product`
- Files: all routes under `src/app/api/businesses/[id]/` that are NOT `cctv/` or `mobile-shop/`:
  - `products/`, `categories/`, `sales/`, `purchases/`, `customers/`, `suppliers/`, `expenses/`, `payments/`, `returns/`, `batches/`, `stock/`, `shelf-scans/`, `storage-zones/`, `stock-count-day/`, `discount-rules/`, `dashboard/`, `reports/`, `permissions/`, `roles/`, `users/`, `subscription/`, `profile/`, `export/`, `restore-data/`, `notifications/`, `alerts/`, `login-activity/`, `ai/`, `transactions/`, `dispense/`, `expiry-*`
- Some of these are shared infrastructure (users, permissions, subscription, profile) — those should use `dbCore`, not `dbForBusiness`

**Deliverable**: All pharmacy API routes use the router

### Session 3.3 — Refactor Mobile Shop API Routes (~96 route files)

**Tasks**:
- Same process for `src/app/api/businesses/[id]/mobile-shop/` routes
- Replace `db.mSProduct` with `dbForBusiness(businessId).product` (no MS prefix needed in its own DB)
- Files: all 96 route files under `mobile-shop/`

**Deliverable**: All mobile-shop API routes use the router

### Session 3.4 — Refactor Shared/Core API Routes

**Tasks**:
- Routes that are purely control-plane (auth, super-admin, backup, AI config) should use `dbCore` directly
- Routes under `src/app/api/super-admin/` — keep using `dbCore`
- Routes under `src/app/api/businesses/[id]/users/`, `permissions/`, `roles/`, `subscription/`, `profile/` — use `dbCore` (these are cross-module)
- Verify that no route accidentally queries a module database for control-plane data

**Deliverable**: All shared routes correctly use `dbCore`

### Session 3.5 — Refactor Frontend Components

**Tasks**:
- Frontend components don't directly access the database — they call API routes
- But some components import types from `@prisma/client` — update these imports to use the per-module generated client types
- Update `src/modules/cctv-shop/` to import CCTV types from the CCTV Prisma client
- Update `src/modules/mobile-shop/` to import MS types from the mobile-shop Prisma client
- Update `src/modules/pharmacy/` to import pharmacy types from the pharmacy Prisma client
- The `src/lib/feature-gate.ts` and `src/lib/modules.ts` stay in core (they reference `BusinessType` which is in the control plane)

**Deliverable**: All frontend imports updated to use per-module types

---

## Phase 4 — Landing Page + Module Routing

**Objective**: Create the public landing page and per-module subdomains/paths.

### Session 4.1 — Landing Page

**Tasks**:
- Create `src/app/(landing)/page.tsx` — the public landing page at `inventoryos.com`
  - Hero section: "Choose your business type"
  - 3 cards: CCTV Shop, Pharmacy, Mobile Shop
  - Each card links to the module's registration page
  - Feature highlights per module
  - Pricing section (if applicable)
- Create `src/app/(landing)/layout.tsx` — separate layout (no sidebar, no auth required)
- Move the existing dashboard to `src/app/(app)/dashboard/page.tsx` (authenticated area)

**Deliverable**: Working landing page at `/`

### Session 4.2 — Per-Module Registration Flow

**Tasks**:
- Create `src/app/(landing)/cctv/page.tsx` — CCTV module landing page with "Get Started" CTA
- Create `src/app/(landing)/pharmacy/page.tsx` — Pharmacy module landing page
- Create `src/app/(landing)/mobileshop/page.tsx` — Mobile Shop landing page
- Each module page shows:
  - Feature list specific to that module
  - "Create Account" button → links to registration with the business type pre-selected
  - "Login" button → links to login with the business type pre-selected
- Update the registration flow to accept a `?module=cctv` query param
  - Pre-fills the business type
  - Shows only the features relevant to that module
- Update the login flow similarly

**Deliverable**: 3 module landing pages + registration/login flows that respect the module

### Session 4.3 — Per-Module Dashboard Routing

**Tasks**:
- Update the module loader (`src/lib/module-loader.tsx`) to render the correct module shell based on `businessTypeId`
- Ensure that a CCTV business logging in sees only CCTV features (no pharmacy/mobile-shop menu items)
- Ensure that a pharmacy business logging in sees only pharmacy features
- Add a redirect: if a user tries to access `inventoryos.com/cctv/dashboard` but their business is a pharmacy, redirect to their correct module dashboard
- The existing `feature-gate.ts` already handles feature visibility — verify it works with the new routing

**Deliverable**: Correct module routing — each business type sees only its own module

---

## Phase 5 — Physical Database Split

**Objective**: Actually create 4 separate PostgreSQL databases and point each PrismaClient at its own database. This is the point of no return.

### Session 5.1 — Create 4 Databases + Run Migrations

**Tasks**:
- Create 4 PostgreSQL databases on the server:
  - `inventoryos_core` — control plane
  - `inventoryos_cctv` — CCTV module
  - `inventoryos_pharmacy` — pharmacy module
  - `inventoryos_mobileshop` — mobile shop module
- Run `prisma migrate deploy` for each schema against its database:
  - `CORE_DB_URL=postgresql://.../inventoryos_core prisma migrate deploy --schema prisma/schemas/core.prisma`
  - `CCTV_DB_URL=postgresql://.../inventoryos_cctv prisma migrate deploy --schema prisma/schemas/cctv.prisma`
  - Same for pharmacy and mobile-shop
- Set the 4 environment variables in production:
  - `CORE_DB_URL`, `CCTV_DB_URL`, `PHARMACY_DB_URL`, `MOBILESHOP_DB_URL`
- Update `.env.example` with all 4 variables

**Deliverable**: 4 empty databases with correct schemas

### Session 5.2 — Write Data Migration Script

**Tasks**:
- Create `scripts/migrate-to-multi-db.ts`:
  - Connect to the old single database (read-only)
  - For each business in the old DB:
    - Read its `businessTypeId`
    - Copy all CCTV rows (where `businessId = X`) to the CCTV database
    - Copy all pharmacy rows to the pharmacy database
    - Copy all MS rows to the mobile-shop database
    - The control-plane rows (Business, BusinessUser, SubscriptionInvoice, etc.) stay in the core database
  - Handle ID preservation (keep the same `id` values — they're cuids, no collision risk across DBs)
  - Handle referential integrity: a CCTV sale references a CCTV product — both go to the CCTV DB, so the FK is preserved within the DB
  - Handle the soft reference to `Business`: the `businessId` field is just a string — it still points at the Business row in the core DB, but there's no DB-level FK enforcement
- Run the script in a staging environment first
- Verify row counts match between old and new databases

**Deliverable**: Working data migration script + verified data in 4 databases

### Session 5.3 — Cutover + Verification

**Tasks**:
- Schedule a maintenance window
- Run the data migration script against production
- Switch the 4 environment variables to point at the new databases
- Restart the application
- Smoke test:
  - Login as a CCTV business → verify sales, products, repairs work
  - Login as a pharmacy business → verify products, batches, shelf scans work
  - Login as a mobile-shop business → verify sales, mushak, EMI work
  - Login as super-admin → verify the tenants view, subscription management, reports work
- Keep the old single database as a backup for 7 days (do not delete)

**Deliverable**: Production running on 4 separate databases

---

## Phase 6 — Post-Split Hardening

**Objective**: Fix the things that break when databases are separate.

### Session 6.1 — Backup System Redesign

**Tasks**:
- The current backup system (`TenantBackup`, `SystemBackup`, `BackupAuditLog`) assumes one database
- Redesign:
  - A "backup job" now backs up 4 databases (core + the 3 module DBs that have data)
  - Each backup produces 4 dump files, one per database
  - The `SystemBackup` table in the core DB records all 4 dump file paths
  - Restore restores all 4 databases in the correct order (core first, then modules)
- Update the backup UI in `/admin` to show per-database backup status
- Create 4 separate pg-cron jobs (one per database) or a single job that fans out

**Deliverable**: Working multi-database backup + restore

### Session 6.2 — Super-Admin Reports Fan-Out

**Tasks**:
- The super-admin dashboard currently queries one database for revenue summaries, AI usage, etc.
- After the split, revenue data lives in 3 separate module databases
- Update the super-admin APIs:
  - `GET /api/super-admin/businesses` — now needs to query all 3 module DBs for `_count` of products/sales/customers
  - `GET /api/super-admin/revenue-summary` — now needs to aggregate sales revenue from 3 module DBs
  - `GET /api/super-admin/cctv-tenants` — still queries the CCTV DB (already isolated, no change needed)
  - `GET /api/super-admin/ai-usage` — stays in core (AIUsageLog is in the control plane)
- Use `Promise.all` to fan out queries and aggregate the results

**Deliverable**: Super-admin reports work across all module databases

### Session 6.3 — Subscription Lifecycle Cron Job

**Tasks**:
- The subscription lifecycle cron job (`runSubscriptionLifecycleJob`) currently:
  - Reads all businesses from the single DB
  - For `data_wiped` stage, hard-deletes all module-specific rows (CCTV/MS/pharmacy)
- After the split, the cron job must:
  - Read businesses from the core DB
  - For each business entering `data_wiped` stage, connect to the correct module DB and delete that business's rows
  - Keep the `Business` row in the core DB (for "no duplicate account")
  - Log the wipe in the core DB's `CronJobLog`
- Update the cron job to use the database router

**Deliverable**: Subscription lifecycle cron job works with multi-DB

### Session 6.4 — RLS Policies Per Database

**Tasks**:
- The current RLS policies (Phase 9 migration) filter by `app.business_id` session variable
- Each module database needs its own set of RLS policies (since the tables are different)
- Create RLS migration files for each module:
  - `cctv/migrations/rls.sql` — policies on all CCTV tables
  - `pharmacy/migrations/rls.sql` — policies on all pharmacy tables
  - `mobileshop/migrations/rls.sql` — policies on all MS tables
- The core DB keeps its RLS policies on the shared tables (BusinessUser, SubscriptionInvoice, etc.)
- Update `withTenant()` to set the session variable on the correct module client

**Deliverable**: RLS policies in all 4 databases

### Session 6.5 — Cleanup + Documentation

**Tasks**:
- Remove the old `prisma/schema.monolith.prisma.bak` file
- Update `DEPLOYMENT.md` with the 4-database setup instructions
- Update `.env.example` with all 4 `*_DB_URL` variables
- Update the Docker Compose / Caddyfile to include all 4 database services
- Update `CONTRIBUTING.md` with the new development setup (4 Prisma clients)
- Create `docs/multi-db-architecture.md` — a developer guide for the multi-DB setup
- Remove any dead code (old `db.ts` re-exports, unused RLS policies, etc.)
- Run `tsc --noEmit` to verify no type errors
- Run the full test suite (if one exists) or smoke-test all critical paths

**Deliverable**: Clean codebase + updated documentation

---

## Summary — Phase/Session Timeline

| Phase | Sessions | Est. Duration | Risk Level | Reversible? |
|-------|----------|---------------|------------|-------------|
| **1. Schema Split** | 3 | 1-2 days | Low | Yes (still 1 DB) |
| **2. Database Router** | 3 | 2-3 days | Low | Yes (still 1 DB) |
| **3. Refactor API Routes** | 5 | 5-8 days | Medium (tedious) | Yes (still 1 DB) |
| **4. Landing Page + Routing** | 3 | 2-3 days | Low | Yes (still 1 DB) |
| **5. Physical DB Split** | 3 | 2-3 days | **High** | **No** (point of no return) |
| **6. Post-Split Hardening** | 5 | 3-5 days | Medium | No |
| **Total** | **22 sessions** | **15-24 days** | | |

---

## Key Decisions to Make Before Starting

1. **Database topology**: DB-per-module (4 databases) vs DB-per-tenant-per-module (hundreds of databases). Recommendation: **DB-per-module** — simpler, sufficient for current scale, can add DB-per-tenant later.

2. **Prefix removal**: When CCTV moves to its own DB, should `cCTVProduct` become just `Product`? Recommendation: **Yes** — no prefix needed when tables are isolated. This is a big readability win.

3. **Shared models**: Some models like `AlertPreference`, `NotificationLog` are used by all modules. Do they stay in core (queried via core DB) or get duplicated into each module DB? Recommendation: **Keep in core** — these are cross-cutting concerns that belong in the control plane.

4. **Master catalogs**: `MasterProduct` (pharmacy) and `MSMasterProduct` (mobile shop) are global. Do they stay in core? Recommendation: **Yes** — they're shared across all tenants of a module, queried read-only from the module DBs via an API call to core.

5. **Deployment**: 4 databases on the same PostgreSQL server (different database names) vs 4 separate PostgreSQL instances? Recommendation: **Same server, different databases** — cheaper, simpler, sufficient. Can split to separate servers later if needed.

6. **Prisma preview features**: Prisma's multi-schema feature is in preview. Should we use it instead of 4 separate clients? Recommendation: **No** — multi-schema still uses one database connection. 4 separate PrismaClients is cleaner and necessary for the physical split.

---

## What You Get After Completion

```
✅ inventoryos.com → Landing page with 3 business modules
✅ inventoryos.com/cctv → CCTV SaaS (own database, own schema, own features)
✅ inventoryos.com/pharmacy → Pharmacy SaaS (own database, own schema, own features)
✅ inventoryos.com/mobileshop → Mobile Shop SaaS (own database, own schema, own features)
✅ Each module's clients see only their module's features
✅ Each module has its own clean schema (no prefixes: Product, Sale, Purchase — not cCTVProduct)
✅ Control plane (auth, subscriptions, payments) is shared and stable
✅ Super-admin can manage all modules from one admin panel
✅ Each module can scale independently (add more DB resources to CCTV without affecting pharmacy)
✅ Each module can deploy independently (change CCTV schema without migrating pharmacy)
✅ Adding a new business module (e.g., Grocery) is as simple as adding a new database + schema
```
