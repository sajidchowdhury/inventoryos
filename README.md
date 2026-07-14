# InventoryOS

Smart business management platform for every trade — pharmacy, CCTV shop, and beyond. Multi-tenant, mobile-first, AI-powered inventory, sales, and operations management.

> **Status:** Phase 1 (Database Unification) **complete.** The codebase is now PostgreSQL-only. All SQLite-specific code has been removed. See the [Architecture Roadmap](#) for the full phased plan (Problems 2, 3, 4 remain).

> **Phase 1 complete (1A + 1B + 1C + 1D).** Local dev environment, migration baseline, production cutover runbook, and final cleanup are all done. Next up: Phase 2A (restore `mode: "insensitive"` for case-insensitive search).

---

## Prerequisites

- **Node.js** v20 or newer (tested on v24)
- **Bun** v1.3 or newer (package manager + script runner) — install from <https://bun.sh>
- **Docker** + Docker Compose (for the local PostgreSQL + Redis stack) — install from <https://docs.docker.com/get-docker/>

If you cannot install Docker, you can run PostgreSQL and Redis natively — just make sure the connection strings in `.env` point at your local instances.

---

## Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone https://github.com/sajidchowdhury/inventoryos.git
cd inventoryos

# 2. Install dependencies
bun install

# 3. Start PostgreSQL + Redis in Docker
docker compose up -d

# 4. Copy the env template and edit if needed
cp .env.example .env
# (defaults work out-of-the-box with docker-compose)

# 5. Apply the database schema
bunx prisma migrate deploy
# (or for the very first migration baseline, see "Database Setup" below)

# 6. Generate the Prisma Client
bunx prisma generate

# 7. Seed the database (creates business types + default super-admin)
bunx prisma db seed

# 8. Start the dev server
bun run dev
```

Open <http://localhost:3000> in your browser.

---

## Interim Setup

The Quick Start above works as-is once you have PostgreSQL running locally (via `docker compose up -d` or a self-installed PostgreSQL). The schema provider is `postgresql` and the migration baseline exists at `prisma/migrations/0_init/`.

```bash
# After docker compose up -d, apply the baseline migration:
bunx prisma migrate deploy
# This applies prisma/migrations/0_init/migration.sql to your local PostgreSQL.
# On a fresh database this creates all 104 tables, 328 indexes, and 160 foreign keys.

# Then seed and start:
bunx prisma db seed
bun run dev
```

**Note:** The codebase is now PostgreSQL-only. SQLite is no longer supported. If you need to test without Docker, install PostgreSQL locally — it's a one-command install on most platforms.

---

## Default Login (Super Admin)

After seeding, log in at <http://localhost:3000/admin>:

- **Username:** `superadmin`
- **Password:** `admin123`

Change these in production by setting `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_DEFAULT_PASSWORD` in `.env` **before** running `bunx prisma db seed` for the first time. The seed script is idempotent — it never overwrites an existing super-admin's password.

---

## Database Setup

The application uses **PostgreSQL** (via Prisma ORM). The schema is defined in `prisma/schema.prisma`.

### First-time setup (with docker-compose)

```bash
docker compose up -d
bunx prisma migrate deploy   # apply all migrations
bunx prisma db seed           # seed reference data + super-admin
```

### Making schema changes

```bash
# Create a new migration after editing prisma/schema.prisma:
bunx prisma migrate dev --name <descriptive_name>

# This will:
#   1. Generate a new migration SQL file in prisma/migrations/
#   2. Apply it to your local database
#   3. Regenerate the Prisma Client
```

**Never use `prisma db push` in production.** Always use `prisma migrate deploy` so migrations are versioned and auditable.

### Resetting the local database

```bash
docker compose down -v        # destroy the postgres volume
docker compose up -d          # start fresh
bunx prisma migrate deploy    # reapply all migrations
bunx prisma db seed           # reseed
```

---

## Production Cutover (Phase 1C)

When you're ready to apply the schema to your production PostgreSQL server, use the cutover script. This script **destroys and recreates** the target database, so only run it when you have no data to preserve (or have a verified `pg_dump` backup).

### Prerequisites

- PostgreSQL 14+ running on your production server
- `psql` client installed on the machine where you run the script
- The PostgreSQL user must have permission to DROP and CREATE databases

### Steps

```bash
# 1. On your production server (or a machine that can reach it),
#    clone the repo and install deps:
git clone https://github.com/sajidchowdhury/inventoryos.git
cd inventoryos
bun install

# 2. Set DATABASE_URL to point at the PostgreSQL admin database
#    (usually "postgres" — the script will create the inventoryos database)
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
# Override the target database name if needed:
# export INVENTORYOS_DB_NAME=inventoryos

# 3. Run the cutover script
bash scripts/production-cutover.sh

# 4. When prompted, type DESTROY to confirm database recreation

# 5. The script will:
#    - Drop and recreate the inventoryos database
#    - Apply prisma/migrations/0_init/migration.sql (creates all 104 tables)
#    - Run the seed (creates 7 business types + default super-admin)
#    - Run smoke tests (verify table count, business types, super-admin exists)
```

### What the script does

| Phase | Action | Verification |
|---|---|---|
| 0 | Preflight: checks psql, bun, migration files, admin connection | All tools available |
| 1 | DROP + CREATE the target database | Database exists and is empty |
| 2 | `prisma migrate deploy` | All tables created (100+) |
| 3 | `prisma generate` | Prisma Client regenerated |
| 4 | `prisma db seed` | 7 business types + 1 super-admin |
| 5 | Smoke tests | Table count, business types, super-admin, migration recorded |

### After the cutover

```bash
# Update your production .env to point at the new database:
# DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/inventoryos?schema=public"

# Restart your production server
# Visit https://your-domain.com/admin
# Log in as superadmin / admin123
# CHANGE THE PASSWORD IMMEDIATELY via Admin → User Management
```

### Verifying the cutover

Run the smoke test script to verify all API endpoints work:

```bash
API_BASE_URL=https://your-domain.com bunx tsx scripts/post-cutover-smoke-test.ts
```

This checks: home page, admin page, `/api/health`, `/api/setup-status`, super-admin login, and the businesses API auth gate.

### Troubleshooting

**"Cannot connect to admin database"** — Check that your DATABASE_URL points at the `postgres` admin database (not the target database). The script needs admin access to DROP and CREATE.

**"Permission denied to drop database"** — Your PostgreSQL user needs the CREATEDB role. Connect as a superuser and run: `ALTER USER your_user CREATEDB;`

**"Migration failed: relation already exists"** — The target database wasn't fully dropped. The script should handle this, but if it happens, manually run `DROP DATABASE inventoryos;` and re-run the script.

---

## Available Scripts

### Application

| Script | Description |
|---|---|
| `bun run dev` | Start Next.js dev server on port 3000 (Turbopack) |
| `bun run build` | Production build (outputs to `.next/standalone/`) |
| `bun run start` | Start the production server (use `node .next/standalone/server.js` for standalone output) |
| `bun run lint` | Run ESLint |

### Database (npm scripts)

| Script | Description |
|---|---|
| `bun run db:deploy` | Apply pending migrations (production-safe) |
| `bun run db:migrate` | Create + apply a new migration (development) |
| `bun run db:generate` | Regenerate Prisma Client after schema changes |
| `bun run db:seed` | Seed reference data + default super-admin |
| `bun run db:reset` | Reset database (drops all data, reapplies migrations, reseeds) |
| `bun run db:studio` | Open Prisma Studio (GUI for browsing database) |
| `bun run db:push` | Sync schema directly (development only — never use in production) |

### Database (prisma CLI)

| Command | Description |
|---|---|
| `bunx prisma migrate dev --name <name>` | Create + apply a new migration |
| `bunx prisma migrate deploy` | Apply pending migrations (production-safe) |
| `bunx prisma migrate status` | Show migration history and pending migrations |
| `bunx prisma migrate resolve --applied 0_init` | Mark a migration as applied without running it |
| `bunx prisma generate` | Regenerate Prisma Client |
| `bunx prisma db seed` | Seed reference data + default super-admin |
| `bunx prisma studio` | Open Prisma Studio (GUI for browsing database) |

### Operations (Phase 1C)

| Script | Description |
|---|---|
| `bash scripts/production-cutover.sh` | Drop + recreate + migrate + seed the production database (Phase 1C runbook) |
| `bunx tsx scripts/post-cutover-smoke-test.ts` | Smoke test API endpoints after cutover |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` — public URL (used in email links)
- `CRON_SECRET` — secret for protecting `/api/cron/*` endpoints

Optional but recommended:

- `REDIS_URL` — Redis for caching (falls back to in-memory if not set)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` — for sending email (or configure via admin UI)
- `ZAI_API_KEY` — for AI features (shelf scanner, demand forecasting, AI chat)
- `SENTRY_DSN` — for error tracking

See `.env.example` for the complete list with descriptions.

---

## Project Structure

```
inventoryos/
├── docker-compose.yml          # PostgreSQL + Redis for local dev
├── .env.example                # Environment variable template
├── prisma/
│   ├── schema.prisma           # Database schema (PostgreSQL)
│   ├── seed.ts                 # Reference data + super-admin seed
│   └── migrations/             # Versioned migration history (Phase 1B)
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── admin/              # Super-admin dashboard
│   │   └── api/                # REST API endpoints
│   ├── modules/
│   │   ├── pharmacy/           # Pharmacy business module
│   │   └── cctv-shop/          # CCTV shop business module
│   ├── components/ui/          # shadcn/ui component library
│   ├── lib/                    # Shared utilities (db, auth, ai, cache)
│   ├── stores/                 # Zustand state stores
│   └── hooks/                  # React hooks
├── public/                     # Static assets
└── next.config.ts              # Next.js configuration (standalone output)
```

---

## Architecture Notes

### Multi-tenant by design

Each business (pharmacy, CCTV shop, etc.) is a tenant. All data is scoped by `businessId`. The `BusinessType` model determines which module (pharmacy, cctv-shop, etc.) the business uses.

### Master Catalog pattern (pharmacy)

Pharmacy products follow a two-tier pattern:
- **MasterProduct** — the global catalog of medicines, curated by super-admin
- **Product** — a shop's private product list, optionally linked to a master product

This reduces data entry (shop owner searches the master catalog instead of typing from scratch) and enables cross-shop analytics. The CCTV module will adopt the same pattern in Phase 3.

### Mobile-first UI

The UI is built mobile-first (portrait phone viewport). Desktop responsive layouts are being added in Phase 4 of the roadmap.

---

## Troubleshooting

### "Can't connect to PostgreSQL"

1. Verify Docker is running: `docker compose ps`
2. Verify the postgres container is healthy: `docker compose logs postgres`
3. Verify `DATABASE_URL` in `.env` matches the docker-compose credentials
4. Reset the database: `docker compose down -v && docker compose up -d`

### "Prisma Client not generated"

Run `bunx prisma generate` after cloning or after any schema change.

### "Migration failed"

1. Check `DATABASE_URL` is correct
2. Check the postgres container is running: `docker compose ps postgres`
3. View the migration SQL in `prisma/migrations/` to see what failed
4. Reset and retry: `docker compose down -v && docker compose up -d && bunx prisma migrate deploy`

### Port 3000 already in use

Edit `package.json` and change the `dev` script port: `"dev": "next dev -p 3001"`.

---

## License

Proprietary. All rights reserved.
