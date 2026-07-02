# AGENTS.md

## Cursor Cloud specific instructions

InventoryOS is a single Next.js 16 (App Router, Turbopack) application — a multi-tenant
pharmacy inventory system. Prisma ORM on **PostgreSQL**. Redis and Sentry are optional
(the cache falls back to an in-memory Map when `REDIS_URL` is unset; Sentry is inert
without a DSN). There is no separate backend service — API routes live under
`src/app/api/**`.

Standard commands are already defined in `package.json` (`dev`, `build`, `lint`,
`db:push`, `db:generate`, `db:migrate`). Use those; don't re-derive them.

### Startup (not handled by the update script)
The update script only refreshes JS deps + the Prisma client. Postgres and the dev
server must be started manually each session:

1. **Start PostgreSQL** (it does not auto-start in this VM):
   `sudo pg_ctlcluster 16 main start`
2. **Ensure `.env` exists** (git-ignored, persisted via the VM snapshot). If missing,
   recreate it with the local dev DB URL:
   ```
   DATABASE_URL="postgresql://inventoryos:inventoryos_dev@127.0.0.1:5432/inventoryos?schema=public"
   DIRECT_DATABASE_URL="postgresql://inventoryos:inventoryos_dev@127.0.0.1:5432/inventoryos?schema=public"
   CRON_SECRET="dev-cron-secret"
   NODE_ENV="development"
   ```
   The DB role/database were created once as: role `inventoryos` / password
   `inventoryos_dev` / database `inventoryos` (owner `inventoryos`). If the database is
   ever missing, recreate it via `sudo -u postgres psql` and then run `npx prisma db push`.
3. **Sync schema** (idempotent; run after schema changes or a fresh DB): `npx prisma db push`
4. **Seed base data** (business types + pharmacy categories): `npx tsx prisma/seed.ts`
5. **Run the dev server**: `npm run dev` (Next.js on port 3000; logs also tee to `dev.log`).

### Gotchas
- The schema targets Postgres, but a legacy `db/custom.db` (SQLite) file is still in the
  repo from an earlier phase — it is unused; ignore it. Prisma reads `DATABASE_URL` only.
- `next dev` uses Turbopack. `npm start` runs the production standalone build with **bun**,
  but bun is not required for development (dev uses Node/`next dev`).
- **API auth**: `src/middleware.ts` gates every non-public `/api/businesses/**` and
  `/api/super-admin/**` request, requiring a token (Authorization `Bearer <token>` header
  or `session_token` cookie). The pharmacy UI client (`src/modules/pharmacy/**`) issues
  its data fetches with **no** token, so in-app product/batch/etc. writes return
  `401 Authentication required`. This is a pre-existing app-level issue, not an environment
  problem. To exercise inventory write endpoints, log in via `POST /api/auth/login` and
  send `Authorization: Bearer <session.token>` (this is how the `scripts/test-*-apis.js`
  suites work). The onboarding flow (OTP → register → login) works fully in the UI because
  those routes are public.
- Demo auth shortcut: `POST /api/auth/send-otp` always accepts OTP `9999`.
- `npm run lint` currently reports pre-existing lint errors in app code (e.g.
  `AiConfigCard.tsx`, `count-up.tsx`); these are not caused by environment setup.
