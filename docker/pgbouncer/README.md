# PgBouncer for InventoryOS

PgBouncer sits between the Next.js app and PostgreSQL, keeping a small pool of
warm server connections so the app never pays the TCP+TLS+auth cost on every
request and never runs Postgres out of `max_connections` under load.

```
        ┌──────────┐   :6432   ┌──────────┐   :5432   ┌──────────┐
        │   app    │ ─────────▶│ pgbouncer│──────────▶│   db     │
        │ (Prisma) │  pooled   │  (pool)  │  pooled   │ postgres │
        └──────────┘           └──────────┘           └──────────┘
              │                                                ▲
              │            :5432 (DIRECT_DATABASE_URL)         │
              └────────────────────────────────────────────────┘
                      used by prisma migrate deploy
```

---

## Why we run PgBouncer

1. **Connection churn.** Each Next.js serverless-ish worker / API route can
   open a new Postgres connection. Postgres forks a process per connection —
   that's ~5-10MB and a slow startup. PgBouncer multiplexes many short-lived
   client connections over a small set of long-lived server connections.
2. **Connection ceiling.** Postgres default `max_connections=100`. Without a
   pooler, 10 app instances × 10 conns each = 100 → headroom gone. PgBouncer
   lets you accept thousands of client conns while only using ~20 server ones.
3. **Predictable latency.** A pooled `SELECT 1` is sub-millisecond; a fresh
   connection is 50-150ms. On a busy API that difference compounds.

---

## Pool mode: `transaction`

We use `pool_mode = transaction`. PgBouncer releases the underlying server
connection back to the pool at every `COMMIT` / `ROLLBACK`, so a single
server connection can serve hundreds of transactions from many clients.

**What breaks under transaction pooling:**

| Feature | Why it breaks | Workaround |
|---|---|---|
| `SET search_path = …` | Lost on next txn | Use `?schema=public` in URL or qualify table names |
| `LISTEN` / `NOTIFY` | Listener detached from session | Use a direct connection |
| Advisory locks (`pg_advisory_lock`) | Lock tied to session, not txn | Use direct connection |
| Temp tables (`CREATE TEMP TABLE`) | Dropped at txn end | Use direct connection |
| Multi-statement prepared statements | State not preserved | Prisma handles this |

For Prisma specifically, set `?pgbouncer=true&connection_limit=1` on the URL
so the client never tries to use prepared-statement caching that breaks under
transaction pooling.

---

## Prisma configuration

Prisma needs **two URLs**:

### 1. `DATABASE_URL` — runtime queries (pooled)

```env
DATABASE_URL="postgresql://inventoryos:<pw>@pgbouncer:6432/inventoryos?schema=public&pgbouncer=true&connection_limit=1"
```

- `pgbouncer=true` — tells Prisma's engine to use the pgbouncer-safe URL
  format (no `?connector=...` params that pgbouncer rejects) and to disable
  prepared-statement caching.
- `connection_limit=1` — Prisma's own pool should be 1 when sitting behind a
  transaction pooler. PgBouncer does the real multiplexing; multiple Prisma
  connections per process would just add overhead.

### 2. `DIRECT_DATABASE_URL` — migrations (direct)

```env
DIRECT_DATABASE_URL="postgresql://inventoryos:<pw>@db:5432/inventoryos?schema=public"
```

`prisma migrate deploy` and `prisma db push` use this URL. Migrations need a
real session (DDL takes locks, runs across multiple statements) so they **must
not** go through PgBouncer.

In `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

---

## Verification commands

After `docker compose up -d`:

### Check PgBouncer is healthy

```bash
docker compose ps pgbouncer
# expect:   healthy

# Inspect the live pool:
docker compose exec pgbouncer \
  psql -h 127.0.0.1 -p 6432 -U inventoryos pgbouncer -c 'SHOW POOLS;'
docker compose exec pgbouncer \
  psql -h 127.0.0.1 -p 6432 -U inventoryos pgbouncer -c 'SHOW CLIENTS;'
docker compose exec pgbouncer \
  psql -h 127.0.0.1 -p 6432 -U inventoryos pgbouncer -c 'SHOW STATS;'
```

### Check the app can reach PgBouncer

```bash
docker compose exec app \
  psql 'postgresql://inventoryos:<pw>@pgbouncer:6432/inventoryos' -c 'SELECT version();'
# (psql is not installed in the slim app image — use a one-off psql container instead:)
docker run --rm --network inventoryos-net postgres:16-alpine \
  psql 'postgresql://inventoryos:<pw>@pgbouncer:6432/inventoryos' -c 'SELECT 1;'
```

### Confirm migrations use the direct URL

```bash
docker compose exec app npx prisma migrate status
# Should connect on DIRECT_DATABASE_URL and report no pending migrations.
```

---

## Tuning guide

All knobs live in `pgbouncer.ini`. After editing, reload with zero downtime:

```bash
docker compose kill -s HUP pgbouncer
```

### Sizing the pool

The golden rule: **`default_pool_size × number_of_db_users ≤ 0.8 × Postgres max_connections`**.

For a single InventoryOS deployment (`max_connections=100`, one db user):

| Setting | Default | When to increase | When to decrease |
|---|---|---|---|
| `default_pool_size` | 20 | Long-running queries blocking the pool; P95 latency rising | Postgres CPU > 80% (fewer parallel queries) |
| `max_client_conn` | 200 | "no more connections" errors in app logs | File-descriptor pressure on the pgbouncer container |
| `reserve_pool_size` | 5 | Bursty traffic stalls during peak | Memory-constrained host |
| `server_idle_timeout` | 3600s | Want to keep warm conns longer (lower reconnect cost) | Too many idle Postgres processes |
| `client_idle_timeout` | 600s | Long-poll clients being dropped | FD pressure from idle clients |

### Symptoms → fix

| Symptom | Likely cause | Fix |
|---|---|---|
| `ERROR: no more connections allowed` | `max_client_conn` hit | Raise `max_client_conn` or add app instances |
| `ERROR: server conn crashed` | Postgres restarted | PgBouncer auto-recovers; check db logs |
| Migrations hang | `prisma migrate` pointed at pgbouncer | Use `DIRECT_DATABASE_URL` |
| `prepared statement "…" already exists` | Missing `?pgbouncer=true` | Add the param to `DATABASE_URL` |
| Random `SET search_path` errors | Session-state leaking | Confirm `server_reset_query = DISCARD ALL` and `pool_mode = transaction` |

### Switching to `md5` auth (multi-host deploys)

1. Generate hashes: `echo -n "passwordpassword" | md5sum` (note: `password + username`).
2. Replace the entries in `userlist.txt` with `"md5<hash>"` format.
3. Set `auth_type = md5` in `pgbouncer.ini`.
4. `docker compose kill -s HUP pgbouncer`.

---

## Files

| Path | Purpose |
|---|---|
| `pgbouncer.ini` | Main config (databases, pool, timeouts, admin users) |
| `userlist.txt`  | Usernames allowed to connect (passwords ignored under `auth_type=trust`) |
| `README.md`     | This document |
