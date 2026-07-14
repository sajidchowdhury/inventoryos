#!/usr/bin/env bash
# =============================================================================
# InventoryOS — Database Backup Script
# =============================================================================
#
# Creates a timestamped backup of the production database.
# Keeps only the last 5 backups (older ones are auto-deleted).
#
# USAGE:
#   bash scripts/backup-db.sh
#
# The backup file is saved to: backups/inventoryos_YYYYMMDD_HHMMSS.sql
#
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }

# Check we're in the right directory
if [[ ! -f ".env" ]]; then
  echo "❌ .env file not found. Run from project root."
  exit 1
fi

# Load DATABASE_URL
export $(grep -v '^#' .env | grep DATABASE_URL | head -1 | xargs)

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not found in .env"
  exit 1
fi

# Parse DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/^[a-z]*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/^[a-z]*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Create backup
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/inventoryos_$(date +%Y%m%d_%H%M%S).sql"

info "Backing up database: $DB_NAME @ $DB_HOST:$DB_PORT"
info "Output: $BACKUP_FILE"

export PGPASSWORD="$DB_PASS"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl > "$BACKUP_FILE"
unset PGPASSWORD

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
ok "Backup complete ($BACKUP_SIZE)"

# Keep only last 5 backups
ls -t "$BACKUP_DIR"/inventoryos_*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

echo ""
ok "Backup saved: $BACKUP_FILE"
echo "To restore: bash scripts/rollback-deploy.sh $BACKUP_FILE"
