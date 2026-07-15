# Contributing Guide

## Development Setup

See [README.md](./README.md) for local development setup instructions.

## Schema Changes

### Current workflow (Phase 1A — before migrations are set up)

```bash
# Edit prisma/schema.prisma, then:
bunx prisma db push          # apply schema changes to local database
bunx prisma generate         # regenerate Prisma Client
```

This is the **development only** workflow. Never use `db push` in production.

### Future workflow (Phase 1B+ — after migrations are set up)

```bash
# Edit prisma/schema.prisma, then:
bunx prisma migrate dev --name <descriptive_name>   # create + apply migration
bunx prisma generate                                  # regenerate Prisma Client
```

This creates a versioned migration file in `prisma/migrations/` that will be applied to production via `bunx prisma migrate deploy`.

### Rules

1. **Never commit `.env`** — it contains secrets. Only `.env.example` is committed.
2. **Never use `prisma db push` in production** — always use `prisma migrate deploy`.
3. **Never edit a merged migration** — create a new migration to reverse or fix a change.
4. **Always test migrations on a fresh database** — `docker compose down -v && docker compose up -d && bunx prisma migrate deploy`.
5. **Prefer additive changes** — new columns nullable, new tables optional. Avoid destructive changes (dropping columns, renaming) unless absolutely necessary.

## Commit Conventions

Use conventional commit format:

- `feat(phase-Xa): description` — new feature
- `fix: description` — bug fix
- `docs: description` — documentation only
- `chore: description` — tooling, deps, config
- `refactor: description` — code restructuring, no behavior change

## Pull Requests

- One phase per PR (e.g., all Phase 1A changes in one PR).
- Small, reviewable PRs preferred over large ones.
- Every PR must pass the build: `bun run build` should succeed without errors.
- Every PR that modifies API endpoints should include a smoke test of the affected endpoints.

## Branch Naming

```
feature/<problem-area>-<phase>-<short-description>
# Examples:
# feature/db-unification-1a-docker-compose
# feature/cctv-catalog-3a-schema
# feature/desktop-shell-4a-sidebar
```
