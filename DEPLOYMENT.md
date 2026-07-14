# Deployment Guide — WHM Server Update (Phase 10)

This guide walks you through safely deploying the production-hardened InventoryOS with all database migrations (Phases 1-10).

---

## What's Being Updated

### Database Hardening (Phases 1-10)

| Phase | What It Does | Migration File |
|-------|-------------|----------------|
| Phase 2 | CHECK constraints (non-negative stock, prices, amounts) | `20260715000000_phase2_data_integrity_constraints` |
| Phase 3 | Float → Decimal(12,2) money type migration | `20260715010000_phase3_float_to_decimal` |
| Phase 5 | Unique constraints (serials, invoices, estimates) | `20260715020000_phase5_unique_constraints` |
| Phase 6 | Stock movement audit table | `20260715030000_phase6_stock_movements` |
| Phase 7 | Double-entry ledger table | `20260715040000_phase7_ledger_entries` |
| Phase 8 | Composite indexes for performance | `20260715050000_phase8_performance_indexing` |
| Phase 9 | Row-Level Security (tenant isolation) | `20260715060000_phase9_security_rls` |

### Code Changes
- All financial APIs wrapped in `$transaction()` (atomic operations)
- Atomic stock updates (prevents race conditions + negative stock)
- Decimal money type (no more floating-point rounding errors)
- Double-entry ledger entries (balanced accounting)
- Stock movement audit trail (complete traceability)
- Server-side pagination on all list endpoints
- Row-Level Security helper (`withTenant`)
- User-friendly error messages for constraint violations

---

## Deployment Steps (5 minutes total)

### Step 1: SSH into your WHM server
```bash
ssh root@your-server-ip
cd /path/to/inventoryos
```

### Step 2: Run pre-deploy verification
```bash
bash scripts/pre-deploy-verify.sh
```
This checks: migrations exist, schema is valid, critical files present, .env configured.

### Step 3: Run the deployment script
```bash
bash scripts/deploy-update.sh
```

**The script does everything automatically:**
1. ✅ Backs up your database (pg_dump)
2. ✅ Pulls latest code from GitHub
3. ✅ Installs dependencies
4. ✅ Runs `prisma migrate deploy` (applies ALL 7 migrations in order)
5. ✅ Builds the Next.js app
6. ✅ Restarts pm2
7. ✅ Runs smoke test

### Step 4: Test in your browser
- CCTV dashboard loads
- Buy Products → scan serials → save purchase
- Sell Products → complete sale → invoice prints
- Reports → Daily Summary → search by date
- Settings → Users → create user

---

## What the Migrations Do (Safe, Non-Destructive)

### Migration 1: CHECK Constraints
Adds 30+ database-level CHECK constraints:
- `stock >= 0` (prevents negative stock)
- `costPrice >= 0`, `sellPrice >= 0` (prevents negative prices)
- `discount <= subtotal` (prevents invalid discounts)
- `amount > 0` (payments must be positive)
- `quantity > 0` (quantities must be positive)

**Safe:** Only adds constraints. Existing data that violates them would need to be fixed first.

### Migration 2: Float → Decimal
Changes all money columns from FLOAT to DECIMAL(12,2):
- `ALTER COLUMN "costPrice" TYPE DECIMAL(12,2)`
- Applies to 26 columns across 15 tables

**Safe:** PostgreSQL can cast FLOAT→NUMERIC without data loss.

### Migration 3: Unique Constraints
Adds unique indexes:
- `[businessId, serialNumber]` on serial items
- `[businessId, invoiceNo]` on sales (partial — WHERE NOT NULL)
- `[businessId, estimateNo]` on estimates (partial)

**Safe:** If duplicates exist, migration will fail with a clear error. Run the dedup query first.

### Migration 4: Stock Movements Table
Creates new `cctv_stock_movements` table for audit trail.

**Safe:** New table, no existing data affected.

### Migration 5: Ledger Entries Table
Creates new `cctv_ledger_entries` table for double-entry accounting.

**Safe:** New table, no existing data affected.

### Migration 6: Composite Indexes
Adds 5 composite indexes for faster queries:
- `[businessId, status]` on serial items
- `[businessId, saleDate]` on sales
- `[businessId, purchaseDate]` on purchases
- `[businessId, paymentDate]` + `[businessId, type]` on payments
- `[businessId, status]` on repairs

**Safe:** Adding indexes doesn't modify data.

### Migration 7: Row-Level Security
Enables RLS on all 21 CCTV tables:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY tenant_isolation ...`
- Creates `app_business_id()` helper function

**Safe:** RLS policies include `OR app_business_id() IS NULL` fallback, so existing queries continue to work even without setting the session variable.

---

## If Something Breaks (Rollback)

```bash
bash scripts/rollback-deploy.sh
```

This restores the database from backup + reverts code + rebuilds.

---

## Manual Backup (Anytime)

```bash
bash scripts/backup-db.sh
```

---

## Pre-Deploy Checklist

Before deploying, verify:

- [ ] `bash scripts/pre-deploy-verify.sh` passes with 0 errors
- [ ] `.env` file has correct `DATABASE_URL`
- [ ] pm2 is running (`pm2 list`)
- [ ] You have SSH access
- [ ] You have a recent database backup

## Post-Deploy Checklist

After deploying, verify:

- [ ] Website loads in browser
- [ ] Can log in
- [ ] Buy Products → scan serials → save → check stock increased
- [ ] Sell Products → complete sale → check stock decreased
- [ ] Reports → Daily Summary → pick date → search → data appears
- [ ] Reports → Weekly Health → generate → health score shows
- [ ] Settings → Password → change password
- [ ] Settings → Users → see user list
- [ ] No errors in pm2 logs: `pm2 logs --lines 30`

## Migration Status Check

To see which migrations have been applied:
```bash
bunx prisma migrate status
```

This shows:
- ✅ Applied migrations
- ⏳ Pending migrations (not yet applied)
- ❌ Failed migrations (if any)
