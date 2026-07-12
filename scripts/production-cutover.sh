#!/usr/bin/env bash
# =============================================================================
# InventoryOS — Phase 1C Production Cutover Script
# =============================================================================
#
# Purpose: Apply the migration baseline to a fresh PostgreSQL database.
#
# This script is IDEMPOTENT and SAFE to re-run. It:
#   1. Tests the database connection
#   2. Drops and recreates the inventoryos database (destructive — no data preserved)
#   3. Applies all pending Prisma migrations (currently just 0_init)
#   4. Runs the seed script (creates business types + default super-admin)
#   5. Verifies the cutover with smoke tests
#
# Usage:
#   cd /path/to/inventoryos
#   DATABASE_URL="postgresql://user:pass@host:5432/postgres" \
#     bash scripts/production-cutover.sh
#
# Or set DATABASE_URL in .env and run:
#   bash scripts/production-cutover.sh
#
# IMPORTANT:
#   - This script DESTROYS the target database. Only run against production
#     if you have no data to preserve (or have a verified backup).
#   - The DATABASE_URL must point to a PostgreSQL admin database (usually
#     "postgres") so the script can DROP and CREATE the inventoryos database.
#   - Set INVENTORYOS_DB_NAME to override the default database name.
#
# =============================================================================

set -euo pipefail

# ─── Color helpers ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}" >&2; }

# ─── Configuration ───
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f .env ]]; then
    info "Loading DATABASE_URL from .env"
    export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
  else
    err "DATABASE_URL not set. Either export it or create a .env file."
    exit 1
  fi
fi

# Default DB name (override with INVENTORYOS_DB_NAME env var)
TARGET_DB="${INVENTORYOS_DB_NAME:-inventoryos}"

# Parse the DATABASE_URL to extract components
# Expected format: postgresql://USER:PASS@HOST:PORT/DBNAME?schema=public
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

# The admin DB (usually "postgres") used for DROP/CREATE operations
ADMIN_DB="${INVENTORYOS_ADMIN_DB:-postgres}"

if [[ -z "$DB_USER" || -z "$DB_HOST" || -z "$DB_PORT" ]]; then
  err "Could not parse DATABASE_URL: $DATABASE_URL"
  err "Expected format: postgresql://USER:PASS@HOST:PORT/DBNAME?schema=public"
  exit 1
fi

info "Target database: $DB_USER@${DB_HOST}:${DB_PORT}/${TARGET_DB}"
info "Admin database for DROP/CREATE: $ADMIN_DB"

# ─── Preflight checks ───
echo ""
info "Phase 0 — Preflight checks"

# Check required tools
for tool in psql bun; do
  if ! command -v "$tool" &>/dev/null; then
    err "$tool is required but not installed."
    exit 1
  fi
done
ok "Required tools available: psql, bun"

# Check migration folder exists
if [[ ! -d prisma/migrations/0_init ]]; then
  err "prisma/migrations/0_init/ not found. Run this script from the repository root."
  exit 1
fi
ok "Migration baseline exists"

# Check seed script exists
if [[ ! -f prisma/seed.ts ]]; then
  err "prisma/seed.ts not found."
  exit 1
fi
ok "Seed script exists"

# Test admin connection
info "Testing admin connection to ${DB_HOST}:${DB_PORT}/${ADMIN_DB}..."
if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB" -c 'SELECT 1' >/dev/null 2>&1; then
  ok "Admin connection successful"
else
  err "Cannot connect to admin database. Check DATABASE_URL credentials."
  err "Tried: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $ADMIN_DB"
  exit 1
fi

# ─── Phase 1: Drop and recreate target database ───
echo ""
info "Phase 1 — Drop and recreate database '${TARGET_DB}'"

# Check if database exists
DB_EXISTS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB" -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DB}'" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" == "1" ]]; then
  warn "Database '${TARGET_DB}' exists. About to DROP it (all data will be lost)."
  
  # Confirm destruction unless --yes flag is set
  if [[ "${INVENTORYOS_YES:-}" != "1" ]]; then
    read -p "Type 'DESTROY' to confirm: " confirm
    if [[ "$confirm" != "DESTROY" ]]; then
      err "Aborted. Set INVENTORYOS_YES=1 to skip confirmation."
      exit 1
    fi
  fi
  
  info "Dropping database '${TARGET_DB}'..."
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB" -c \
    "DROP DATABASE IF EXISTS \"${TARGET_DB}\";" >/dev/null
  ok "Database dropped"
else
  info "Database '${TARGET_DB}' does not exist — skipping drop"
fi

info "Creating fresh database '${TARGET_DB}'..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$ADMIN_DB" -c \
  "CREATE DATABASE \"${TARGET_DB}\";" >/dev/null
ok "Database created"

# ─── Phase 2: Apply migrations ───
echo ""
info "Phase 2 — Apply Prisma migrations"

# Update DATABASE_URL to point at the target database for Prisma
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${TARGET_DB}?schema=public"

info "Running: prisma migrate deploy"
bunx prisma migrate deploy
ok "Migrations applied"

# ─── Phase 3: Generate Prisma Client ───
echo ""
info "Phase 3 — Generate Prisma Client"
bunx prisma generate >/dev/null 2>&1
ok "Prisma Client generated"

# ─── Phase 4: Seed the database ───
echo ""
info "Phase 4 — Seed reference data + super-admin"
bunx prisma db seed
ok "Seed complete"

# ─── Phase 5: Smoke tests ───
echo ""
info "Phase 5 — Smoke tests"

# Count tables
TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
info "Table count: ${TABLE_COUNT}"
if [[ "$TABLE_COUNT" -lt 100 ]]; then
  err "Expected 100+ tables, got ${TABLE_COUNT}. Migration may have failed."
  exit 1
fi
ok "Table count looks correct (${TABLE_COUNT} tables)"

# Check BusinessType records
BIZ_TYPE_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -tAc \
  'SELECT COUNT(*) FROM "BusinessType"')
info "BusinessType records: ${BIZ_TYPE_COUNT}"
if [[ "$BIZ_TYPE_COUNT" -lt 7 ]]; then
  err "Expected 7 business types, got ${BIZ_TYPE_COUNT}. Seed may have failed."
  exit 1
fi
ok "Business types seeded (${BIZ_TYPE_COUNT} records)"

# Check SuperAdmin record
SUPERADMIN_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -tAc \
  'SELECT COUNT(*) FROM "SuperAdmin"')
info "SuperAdmin records: ${SUPERADMIN_COUNT}"
if [[ "$SUPERADMIN_COUNT" -lt 1 ]]; then
  err "Expected at least 1 super-admin, got ${SUPERADMIN_COUNT}. Seed may have failed."
  exit 1
fi
ok "Super-admin account exists (${SUPERADMIN_COUNT} record(s))"

# Check _prisma_migrations table (Prisma's migration tracking)
MIGRATION_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" -tAc \
  "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name = '0_init' AND finished_at IS NOT NULL")
info "Applied migrations: ${MIGRATION_COUNT}"
if [[ "$MIGRATION_COUNT" -ne 1 ]]; then
  err "Expected 1 applied migration, got ${MIGRATION_COUNT}."
  exit 1
fi
ok "Baseline migration recorded as applied"

# ─── Done ───
echo ""
echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}✅ Phase 1C cutover complete!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""
info "Database: ${DB_USER}@${DB_HOST}:${DB_PORT}/${TARGET_DB}"
info "Tables:   ${TABLE_COUNT}"
info "Business types: ${BIZ_TYPE_COUNT}"
info "Super-admin:    ${SUPERADMIN_COUNT} (login: superadmin / admin123)"
echo ""
info "Next steps:"
info "  1. Update your production .env: DATABASE_URL=postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${TARGET_DB}?schema=public"
info "  2. Restart your production server"
info "  3. Visit /admin and log in as superadmin / admin123"
info "  4. Change the super-admin password immediately via Admin → User Management"
echo ""
