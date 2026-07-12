# InventoryOS

Smart business management platform for every trade — pharmacy, CCTV shop, and beyond. Multi-tenant, mobile-first, AI-powered inventory, sales, and operations management.

> **Status:** Phase 1 (Database Unification) in progress. The codebase is migrating from dual SQLite/PostgreSQL support to PostgreSQL-only. See `InventoryOS_Architecture_Roadmap.docx` for the full phased plan.

> **Phase 1A + 1B complete.** `docker-compose.yml`, `.env.example`, this README, the migration baseline (`prisma/migrations/0_init/`), and the provider switch to `postgresql` are all done. To run locally, follow Quick Start below — Phase 1C (production cutover) and Phase 1D (final cleanup) remain.

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

## Interim Setup (Phase 1A + 1B done, 1C + 1D remaining)

The Quick Start above works as-is once you have PostgreSQL running locally (via `docker compose up -d` or a self-installed PostgreSQL). The schema provider is already `postgresql` and the migration baseline exists at `prisma/migrations/0_init/`.

The only manual step still required locally:

```bash
# After docker compose up -d, apply the baseline migration:
bunx prisma migrate deploy
# This applies prisma/migrations/0_init/migration.sql to your local PostgreSQL.
# On a fresh database this creates all 104 tables, 328 indexes, and 160 foreign keys.

# Then seed and start:
bunx prisma db seed
bun run dev
```

Phase 1C will apply the same migration to the production server. Phase 1D will remove the leftover SQLite database files and finalize documentation.

If you cannot run PostgreSQL locally (no Docker), you can temporarily fall back to SQLite by changing `prisma/schema.prisma` line 11 back to `provider = "sqlite"` and setting `DATABASE_URL="file:./dev.db"` in `.env`. This is **not recommended** — the production server runs PostgreSQL, so testing on SQLite masks bugs.

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

## Available Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start Next.js dev server on port 3000 (Turbopack) |
| `bun run build` | Production build (outputs to `.next/standalone/`) |
| `bun run start` | Start the production server (use `node .next/standalone/server.js` for standalone output) |
| `bun run lint` | Run ESLint |
| `bunx prisma migrate dev` | Create + apply a new migration |
| `bunx prisma migrate deploy` | Apply pending migrations (production-safe) |
| `bunx prisma generate` | Regenerate Prisma Client after schema changes |
| `bunx prisma db seed` | Seed reference data + default super-admin |
| `bunx prisma studio` | Open Prisma Studio (GUI for browsing database) |

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
