#!/usr/bin/env bash
# =============================================================================
# InventoryOS — Ensure Backup Directories Exist
# =============================================================================
#
# Creates the backup directories on the production server with secure
# permissions (0700 — only the InventoryOS user can read/write).
#
# Run this ONCE after deploying Phase 1:
#   bash scripts/ensure-backup-dirs.sh
#
# Created directories:
#   /var/www/inventoryos/backups/
#   /var/www/inventoryos/backups/tenants/
#   /var/www/inventoryos/backups/tenants/{businessId}/  (created on-demand)
#   /var/www/inventoryos/backups/db/
#
# After creating, this script also verifies that pg_dump is installed
# (required for system-wide backups in Phase 3).
#
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}"; }

# Determine project root (where package.json lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BACKUP_ROOT="$PROJECT_ROOT/backups"
TENANTS_DIR="$BACKUP_ROOT/tenants"
DB_DIR="$BACKUP_ROOT/db"

info "Project root: $PROJECT_ROOT"
info "Backup root:  $BACKUP_ROOT"

# Create directories with secure permissions
mkdir -p "$TENANTS_DIR"
mkdir -p "$DB_DIR"
chmod 700 "$BACKUP_ROOT"
chmod 700 "$TENANTS_DIR"
chmod 700 "$DB_DIR"

ok "Created $TENANTS_DIR (mode 0700)"
ok "Created $DB_DIR (mode 0700)"

# Detect the user InventoryOS runs as (PM2 typically runs as the deploy user)
CURRENT_USER="$(whoami)"
info "Running as user: $CURRENT_USER"
info "Make sure the InventoryOS process runs as the SAME user (PM2 manages this)."

# Verify pg_dump is installed (required for system-wide backups)
info "Checking for pg_dump..."
if command -v pg_dump >/dev/null 2>&1; then
  PGDUMP_VERSION="$(pg_dump --version)"
  ok "pg_dump found: $PGDUMP_VERSION"
else
  err "pg_dump is NOT installed!"
  err "Install it with:  sudo apt install postgresql-client"
  err "System-wide backup (Phase 3) will not work without it."
  err "Tenant-wise backup (Phase 2) will still work — it uses Prisma, not pg_dump."
fi

# Verify pg_restore is installed (required for system-wide restore)
info "Checking for pg_restore..."
if command -v pg_restore >/dev/null 2>&1; then
  PGRESTORE_VERSION="$(pg_restore --version)"
  ok "pg_restore found: $PGRESTORE_VERSION"
else
  err "pg_restore is NOT installed!"
  err "Install it with:  sudo apt install postgresql-client"
fi

# Disk space check
info "Checking available disk space..."
AVAILABLE_MB="$(df -m "$BACKUP_ROOT" | awk 'NR==2 {print $4}')"
info "Available space in $BACKUP_ROOT: ${AVAILABLE_MB} MB"
if [ "$AVAILABLE_MB" -lt 2048 ]; then
  err "Less than 2 GB free disk space! Backups may fail."
  err "Consider cleaning up old logs or expanding the disk."
else
  ok "Disk space is adequate (>= 2 GB free)"
fi

echo ""
ok "Backup directories are ready."
echo ""
info "Next steps:"
info "  1. Phase 2 (tenant-wise backup) is ready to use — no further setup needed."
info "  2. Phase 3 (system-wide backup) requires pg_dump — install if missing."
info "  3. The /backups/ directory is in .gitignore — files will NOT be committed."
info "  4. For offsite sync (recommended): set up rclone + Backblaze B2 (~\$0.25/mo)."
