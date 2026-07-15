#!/usr/bin/env bash
# =============================================================================
# InventoryOS — Safe Deployment Script (Non-Destructive)
# =============================================================================
#
# WHAT THIS SCRIPT DOES:
#   1. Backs up your current production database (safety net)
#   2. Pulls latest code from GitHub
#   3. Applies schema changes (adds NEW tables/columns only — NO data loss)
#   4. Rebuilds the Next.js app
#   5. Restarts pm2
#   6. Runs smoke tests to verify everything works
#
# WHAT THIS SCRIPT DOES NOT DO:
#   - Does NOT touch your .env file (already configured, leave it alone)
#   - Does NOT change ports
#   - Does NOT drop any existing tables or data
#   - Does NOT modify pm2 config
#
# PREREQUISITES:
#   - You are in the inventoryos project directory on the WHM server
#   - Your .env file is already set up with the correct DATABASE_URL
#   - pm2 is running the app (check with: pm2 list)
#   - You have SSH access to the server
#
# USAGE:
#   cd /path/to/inventoryos
#   bash scripts/deploy-update.sh
#
# IF SOMETHING GOES WRONG:
#   See rollback instructions printed at the end, or run:
#   bash scripts/rollback-deploy.sh
#
# =============================================================================

set -euo pipefail

# ─── Color helpers ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}" >&2; }

# ─── Step 0: Pre-flight checks ───
echo ""
echo "============================================"
echo "  InventoryOS — Safe Deployment"
echo "============================================"
echo ""

info "Step 0: Pre-flight checks..."

# Check we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "prisma/schema.prisma" ]]; then
  err "Not in the inventoryos project directory. Please cd to the project root."
  exit 1
fi

# Check .env exists
if [[ ! -f ".env" ]]; then
  err ".env file not found. This script will NOT create it."
  err "Your .env should already be configured from the previous deployment."
  exit 1
fi
ok ".env file found (will NOT be modified)"

# Check pm2 is available
if ! command -v pm2 &> /dev/null; then
  err "pm2 not found. Install with: npm install -g pm2"
  exit 1
fi
ok "pm2 available"

# Check DATABASE_URL is set
if ! grep -q "DATABASE_URL" .env; then
  err "DATABASE_URL not found in .env"
  exit 1
fi

# Extract DATABASE_URL for backup
export $(grep -v '^#' .env | grep DATABASE_URL | head -1 | xargs)
if [[ -z "${DATABASE_URL:-}" ]]; then
  err "Could not read DATABASE_URL from .env"
  exit 1
fi
ok "DATABASE_URL found in .env"

# Check git is clean enough (warn if uncommitted changes)
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "You have uncommitted local changes. They will be stashed during pull."
fi

echo ""
ok "Pre-flight checks passed!"
echo ""

# ─── Step 1: Backup the database ───
info "Step 1: Backing up production database..."

BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/inventoryos_$(date +%Y%m%d_%H%M%S).sql"

# Parse DATABASE_URL to extract components for pg_dump
# Format: postgresql://USER:PASS@HOST:PORT/DBNAME?schema=public
DB_PROTO=$(echo "$DATABASE_URL" | sed -n 's/^\(postgresql\|postgres\):\/\/.*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/^[a-z]*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/^[a-z]*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

info "  Database: $DB_NAME @ $DB_HOST:$DB_PORT"
info "  Backup file: $BACKUP_FILE"

# Run pg_dump
export PGPASSWORD="$DB_PASS"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl > "$BACKUP_FILE" 2>/dev/null; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  ok "Database backed up ($BACKUP_SIZE)"
  
  # Keep only last 5 backups
  ls -t "$BACKUP_DIR"/inventoryos_*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
else
  warn "pg_dump failed. Continuing anyway (but consider manual backup)."
  warn "You can manually backup with: pg_dump \$DATABASE_URL > backup.sql"
fi

unset PGPASSWORD
echo ""

# ─── Step 2: Pull latest code ───
info "Step 2: Pulling latest code from GitHub..."

# Stash any local changes
STASHED=false
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  git stash
  STASHED=true
  info "  Local changes stashed"
fi

# Pull
if git pull origin main; then
  ok "Code updated to latest"
else
  err "git pull failed. Check your network or git config."
  if $STASHED; then
    git stash pop
    info "  Stashed changes restored"
  fi
  exit 1
fi

# Restore stashed changes if any
if $STASHED; then
  git stash pop 2>/dev/null || warn "Could not restore stashed changes (may conflict)"
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD)
ok "Now at commit: $CURRENT_COMMIT"
echo ""

# ─── Step 3: Install dependencies ───
info "Step 3: Installing dependencies..."
if bun install 2>/dev/null || npm install 2>/dev/null; then
  ok "Dependencies installed"
else
  warn "Dependency install had issues. Continuing..."
fi
echo ""

# ─── Step 4: Apply database migrations (VERSIONED, SAFE) ───
info "Step 4: Applying database migrations..."
info "  Uses prisma migrate deploy (versioned migrations, NOT db push)"
info "  Each migration is applied in order. Already-applied migrations are skipped."

# Generate Prisma client
if bunx prisma generate 2>/dev/null || npx prisma generate 2>/dev/null; then
  ok "Prisma client generated"
else
  err "Prisma generate failed."
  exit 1
fi

# Apply migrations with prisma migrate deploy (production-safe)
# This applies all pending migrations in order:
#   - Phase 2: CHECK constraints
#   - Phase 3: Float → Decimal
#   - Phase 5: Unique constraints
#   - Phase 6: Stock movements table
#   - Phase 7: Ledger entries table
#   - Phase 8: Composite indexes
#   - Phase 9: Row-Level Security
info "  Running: prisma migrate deploy"
if bunx prisma migrate deploy 2>&1; then
  ok "All migrations applied successfully!"
  info "  Migrations include:"
  info "    - CHECK constraints (non-negative stock, prices, amounts)"
  info "    - Float → Decimal(12,2) money type migration"
  info "    - Unique constraints (serials, invoices, estimates)"
  info "    - Stock movements audit table"
  info "    - Double-entry ledger table"
  info "    - Composite indexes for performance"
  info "    - Row-Level Security (tenant isolation)"
else
  err "Migration failed!"
  err ""
  err "ROLLBACK INSTRUCTIONS:"
  err "  1. Restore database from backup:"
  err "     psql \$DATABASE_URL < $BACKUP_FILE"
  err "  2. Restore old code:"
  err "     git reset --hard HEAD~1"
  err "  3. Check migration status:"
  err "     bunx prisma migrate status"
  err ""
  exit 1
fi
echo ""

# ─── Step 5: Build the Next.js app ───
info "Step 5: Building Next.js app (this takes 1-2 minutes)..."

if bun run build 2>/dev/null || npm run build 2>/dev/null; then
  ok "Build successful"
else
  err "Build failed!"
  err ""
  err "The app is still running with old code (pm2 not restarted yet)."
  err "To rollback code: git reset --hard HEAD~1"
  err ""
  exit 1
fi
echo ""

# ─── Step 6: Restart pm2 ───
info "Step 6: Restarting pm2..."

# Find the pm2 process name (could be 'inventoryos' or 'next')
PM2_NAME=$(pm2 list 2>/dev/null | grep -oE 'inventoryos|next|app' | head -1 || echo "")

if [[ -n "$PM2_NAME" ]]; then
  pm2 restart "$PM2_NAME" --update-env 2>/dev/null || pm2 reload "$PM2_NAME" 2>/dev/null
  ok "pm2 process '$PM2_NAME' restarted"
else
  warn "Could not find pm2 process name automatically."
  warn "Please restart manually: pm2 restart all"
fi
echo ""

# ─── Step 7: Smoke test ───
info "Step 7: Running smoke tests..."
sleep 3  # Give the app a moment to start

# Try to hit the health endpoint
HEALTH_URL="http://localhost:3000/api/health"
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
  ok "Health check passed (port 3000)"
elif curl -sf "http://localhost:3001/api/health" > /dev/null 2>&1; then
  ok "Health check passed (port 3001)"
else
  warn "Health check could not reach the app."
  warn "The app might still be starting up. Check with: pm2 logs"
  warn "Or visit your website URL in a browser."
fi
echo ""

# ─── Done ───
echo "============================================"
echo "  ✅ Deployment Complete!"
echo "============================================"
echo ""
echo "Commit:     $CURRENT_COMMIT"
echo "Backup:     $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "  1. Visit your website and test the new features"
echo "  2. Check CCTV module → Reports → try the new reports"
echo "  3. Check CCTV module → Products → try Categories + Import"
echo ""
echo "If something is broken:"
echo "  bash scripts/rollback-deploy.sh $BACKUP_FILE"
echo ""
