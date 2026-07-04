# DEPLOYMENT_WORKFLOW.md — Two-Environment Strategy

> **The problem this solves:** We develop in the Z.ai sandbox (local Postgres + Node dev server) but deploy to a WHM production server (Docker + Caddy + Bun). Changes made in Z.ai must be pushable to GitHub **in production-ready format** so that `git pull` on WHM never breaks.
>
> **The principle: the repo is the source of truth for PRODUCTION. Z.ai uses gitignored overrides only.**

---

## 1. The Two Environments

| Aspect | Z.ai Sandbox (dev) | WHM Production |
|---|---|---|
| **Database** | Local PostgreSQL (`sudo pg_ctlcluster 16 main start`) | Docker container (`postgres:16-alpine` via `docker-compose.yml`) |
| **Connection pooler** | None (direct) | PgBouncer container |
| **App runtime** | Node.js via `npm run dev` (Turbopack) | Bun via `bun .next/standalone/server.js` |
| **Reverse proxy** | None (direct `:3000`) | Caddy (`:81` → `:3000`, see `Caddyfile`) |
| **Redis** | Optional (in-memory fallback) | Docker container |
| **Secrets** | `.env` (gitignored, local DB URL) | `.env` on server (gitignored, prod DB URL) |
| **Schema sync** | `npx prisma db push` (fast, dev) | `npx prisma migrate deploy` (controlled, prod) |
| **Purpose** | Iterate fast, see live demo, confirm works | Serve real users |

**Key insight:** These two environments share the **same code** but use **different infrastructure**. The code is environment-agnostic; the infrastructure config lives in gitignored files.

---

## 2. What's Safe to Push vs Never Push

### ✅ SAFE TO PUSH (environment-agnostic, works in both)
These files work identically in Z.ai dev and WHM prod:

| Path | Why it's safe |
|---|---|
| `src/**` (all app code) | TypeScript/React — runs anywhere Node/Bun runs |
| `prisma/schema.prisma` | Schema definition — environment-agnostic |
| `prisma/migrations/**` | Migration SQL — runs via `prisma migrate deploy` on WHM |
| `prisma/seed.ts` | Seed script — idempotent, safe to run anywhere |
| `public/**` | Static assets |
| `package.json` (dependencies) | Adding/removing deps is safe |
| `package-lock.json` / `bun.lock` | Lockfiles — keep in sync |
| `next.config.js`, `tsconfig.json`, `tailwind.config.ts` | Build config — same everywhere |
| `components.json` (shadcn config) | UI config |
| `src/middleware.ts` | Auth gate — same logic everywhere |
| `download/**` (spec docs) | Documentation |
| `PROJECT_CONTEXT.md`, `AGENTS.md`, this file | Documentation |
| `skills/**` | Skill library (not part of app runtime) |

### 🚫 NEVER PUSH (environment-specific, gitignored)
These files MUST stay local. The `.gitignore` already excludes them, but you must never `git add -f` them:

| Path | Why |
|---|---|
| `.env` | Contains local DB URL, secrets — different per environment |
| `.env.local`, `.env.production` | Same as above |
| `db/custom.db` (legacy SQLite) | Local-only artifact |
| `dev.log`, `server.log` | Runtime logs |
| `node_modules/` | Dependencies — installed per environment |
| `.next/` | Build output — generated per environment |
| `agent-ctx/`, `.z-ai-config` | Z.ai sandbox metadata |

### ⚠️ MODIFY WITH CARE (committed, but environment-sensitive)
These files are committed and shared, but they configure infrastructure. **Only modify them if the change benefits BOTH environments:**

| Path | When to modify |
|---|---|
| `package.json` scripts (`dev`, `build`, `start`) | Only if the change works on both Z.ai AND WHM. **Never** change `dev` to use a Z.ai-specific port or command. If you need a Z.ai-only script, ADD a new one (e.g., `dev:zai`) — don't modify existing. |
| `docker-compose.yml` | Only for production infra changes. Z.ai doesn't use Docker — leave this alone. |
| `Caddyfile` | Only for production proxy changes. Z.ai doesn't use Caddy — leave this alone. |
| `docker/pgbouncer/**` | Production-only. Don't touch for Z.ai. |
| `.env.example` | Safe to add new env var templates, but never put real values here. |

---

## 3. The Golden Rule

> **If a change only makes sense in Z.ai, it goes in a gitignored file. If a change makes sense in production, it goes in a committed file.**

Corollaries:
- Need a different DB URL? → `.env` (gitignored)
- Need a different port? → `.env` (`PORT=3001`) or run `npm run dev -- -p 3001` (don't modify `package.json`)
- Need to skip Docker? → Just don't run `docker compose up` (don't modify `docker-compose.yml`)
- Need to test a code change? → Edit `src/**` and push (works in both)
- Need a new Prisma model? → Edit `schema.prisma`, run `db push` locally, commit + push (WHM runs `migrate deploy`)

---

## 4. Step-by-Step Workflow

### 4.1 Making a change in Z.ai → pushing to GitHub

```bash
# 1. Ensure Z.ai env is running
sudo pg_ctlcluster 16 main start
# (.env should already exist — if not, recreate from .env.example with local DB URL)
npx prisma db push        # sync any schema changes to local DB
npm run dev               # start dev server on :3000

# 2. Make your code changes in src/** (or schema.prisma, etc.)
# 3. Test in the browser at http://localhost:3000
# 4. Run tests / lint as needed

# 5. BEFORE COMMITTING — run the guardrail check
bash scripts/pre-push-check.sh

# 6. If the check passes, commit
git add src/ prisma/  # add only what you changed
git commit -m "feat(<scope>): <description>"

# 7. Push
git push origin main
```

### 4.2 Pulling on WHM production

On the WHM server:
```bash
cd /path/to/inventoryos
git pull origin main

# If schema changed:
docker compose exec app npx prisma migrate deploy

# If dependencies changed:
docker compose exec app npm install   # or bun install

# Restart the app container to pick up new code
docker compose restart app
```

**No `.env` changes needed on WHM** — its `.env` is separate and gitignored on the server too.

### 4.3 If you added a new env var

1. Add it to `.env.example` (committed — template only, no real values)
2. Add it to your local Z.ai `.env` (gitignored — real local value)
3. Add it to the WHM server's `.env` manually over SSH (real prod value)
4. Document it in `PROJECT_CONTEXT.md` §9 (Local Dev Setup)

---

## 5. Pre-Push Guardrail

A script at `scripts/pre-push-check.sh` verifies that no environment-specific files are staged for commit. Run it before every push:

```bash
bash scripts/pre-push-check.sh
```

It checks:
- No `.env*` files staged (except `.env.example`)
- No `*.log` files staged
- No `db/*.db` files staged
- No `agent-ctx/` or `.z-ai-config` staged
- No `docker-compose.yml` or `Caddyfile` modifications unless explicitly flagged

If any are found, the script exits non-zero and lists the offenders. Fix by `git restore --staged <file>`.

**Optional: install as a git pre-push hook** so it runs automatically:
```bash
# From repo root:
cat > .git/hooks/pre-push << 'HOOK'
#!/bin/bash
bash scripts/pre-push-check.sh
HOOK
chmod +x .git/hooks/pre-push
```
(Note: `.git/hooks/` is not committed, so each developer must install it once. The script itself IS committed so it travels with the repo.)

---

## 6. Conflict Resolution Scenarios

### Scenario A: "I accidentally modified `package.json` for Z.ai"
**Don't commit it.** Restore from main:
```bash
git restore package.json
```
If you need a Z.ai-only script, add it as a NEW key (e.g., `"dev:zai": "..."`) — additive changes don't break WHM.

### Scenario B: "I modified `docker-compose.yml` to disable a service for Z.ai"
**Don't commit it.** Restore:
```bash
git restore docker-compose.yml
```
Z.ai doesn't need Docker at all — just don't run `docker compose up`. The file is for WHM.

### Scenario C: "WHM pull broke after I pushed"
Check what changed:
```bash
git diff HEAD~1 --name-only
```
If any environment-specific file slipped in, revert it on a new commit:
```bash
git revert <commit-sha>
git push origin main
```
Then on WHM: `git pull origin main` again.

### Scenario D: "I need to test a production-only config change (e.g., Caddy rule)"
Make the change in Z.ai → commit → push → test on WHM staging first (if available) → deploy to prod. The Caddyfile change is legitimate to commit because it's a production config that Z.ai simply ignores.

---

## 7. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  Z.ai SANDBOX (dev)          │  GITHUB REPO (source of truth)│
│                              │                               │
│  .env  ← gitignored          │  src/**                       │
│  local Postgres              │  prisma/schema.prisma         │
│  npm run dev                 │  prisma/migrations/**         │
│  no Docker, no Caddy         │  package.json                 │
│                              │  docker-compose.yml  (prod)   │
│         ↓ push code only ↓   │  Caddyfile           (prod)   │
│                              │  .env.example       (template)│
│                              │                               │
│                              │  ↑ pull on every deploy ↑     │
│                              │                               │
│                              │  WHM PRODUCTION               │
│                              │  .env  ← server-local, gitignored │
│                              │  Docker Postgres + PgBouncer  │
│                              │  Caddy reverse proxy          │
│                              │  Bun runtime                  │
└─────────────────────────────────────────────────────────────┘
```

**Remember:** `.env` is the ONLY file that differs between environments, and it's already gitignored. Everything else is shared code. Follow the guardrail and you'll never have a conflict.
