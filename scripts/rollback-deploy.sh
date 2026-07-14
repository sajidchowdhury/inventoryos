#!/usr/bin/env bash
# =============================================================================
# InventoryOS — Rollback Script
# =============================================================================
#
# Restores the database from a backup file and reverts code to previous commit.
#
# USAGE:
#   bash scripts/rollback-deploy.sh [backup_file]
#
# If no backup_file is provided, uses the most recent one in backups/.
#
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}" >&2; }

echo ""
echo "============================================"
echo "  InventoryOS — Rollback"
echo "============================================"
echo ""

# Check we're in the right directory
if [[ ! -f "package.json" ]]; then
  err "Not in the inventoryos project directory."
  exit 1
fi

# Find backup file
BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE=$(ls -t backups/inventoryos_*.sql 2>/dev/null | head -1)
  if [[ -z "$BACKUP_FILE" ]]; then
    err "No backup file found in backups/ directory."
    err "Usage: bash scripts/rollback-deploy.sh path/to/backup.sql"
    exit 1
  fi
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  err "Backup file not found: $BACKUP_FILE"
  exit 1
fi

info "Backup file: $BACKUP_FILE"
info "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# Confirm with user
read -p "This will OVERWRITE the current database with the backup. Continue? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  warn "Rollback cancelled."
  exit 0
fi
echo ""

# Load DATABASE_URL from .env
if [[ ! -f ".env" ]]; then
  err ".env file not found."
  exit 1
fi
export $(grep -v '^#' .env | grep DATABASE_URL | head -1 | xargs)

# Parse DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/^[a-z]*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/^[a-z]*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

info "Restoring database: $DB_NAME @ $DB_HOST:$DB_PORT"

export PGPASSWORD="$DB_PASS"

# Restore
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE" 2>&1 | grep -v "^SET$" | grep -v "^NOTICE.*" ; then
  ok "Database restored from backup"
else
  err "Database restore failed!"
  unset PGPASSWORD
  exit 1
fi
unset PGPASSWORD
echo ""

# Revert code to previous commit
info "Reverting code to previous commit..."
git reset --hard HEAD~1
ok "Code reverted to previous commit"
echo ""

# Rebuild
info "Rebuilding app..."
if bun run build 2>/dev/null || npm run build 2>/dev/null; then
  ok "Build successful"
else
  warn "Build failed. You may need to fix manually."
fi
echo ""

# Restart pm2
info "Restarting pm2..."
PM2_NAME=$(pm2 list 2>/dev/null | grep -oE 'inventoryos|next|app' | head -1 || echo "")
if [[ -n "$PM2_NAME" ]]; then
  pm2 restart "$PM2_NAME" --update-env 2>/dev/null || pm2 reload "$PM2_NAME" 2>/dev/null
  ok "pm2 restarted"
else
  warn "Could not find pm2 process. Restart manually: pm2 restart all"
fi
echo ""

echo "============================================"
echo "  ✅ Rollback Complete!"
echo "============================================"
echo ""
echo "Your system is now back to the state before the deployment."
echo "Backup file used: $BACKUP_FILE"
echo ""
