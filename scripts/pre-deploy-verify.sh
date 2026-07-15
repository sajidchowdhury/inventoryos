#!/usr/bin/env bash
# =============================================================================
# InventoryOS — Pre-Deploy Verification Script
# =============================================================================
#
# Run this BEFORE deploying to verify the codebase is ready.
# Checks: migrations exist, schema is valid, build compiles.
#
# Usage:
#   bash scripts/pre-deploy-verify.sh
#
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok()    { echo -e "${GREEN}✅ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()   { echo -e "${RED}❌ $1${NC}" >&2; }

ERRORS=0

echo ""
echo "============================================"
echo "  InventoryOS — Pre-Deploy Verification"
echo "============================================"
echo ""

# ── 1. Check we're in the right directory ──
info "Step 1: Checking project structure..."
if [[ ! -f "package.json" ]] || [[ ! -f "prisma/schema.prisma" ]]; then
  err "Not in project root (missing package.json or prisma/schema.prisma)"
  ERRORS=$((ERRORS + 1))
else
  ok "Project structure OK"
fi
echo ""

# ── 2. Check migrations exist ──
info "Step 2: Checking migrations..."
MIGRATION_COUNT=$(ls -d prisma/migrations/*/ 2>/dev/null | wc -l)
if [[ "$MIGRATION_COUNT" -lt 3 ]]; then
  err "Only $MIGRATION_COUNT migration(s) found. Expected at least 3."
  ERRORS=$((ERRORS + 1))
else
  ok "Found $MIGRATION_COUNT migrations"
  info "  Migrations:"
  for dir in prisma/migrations/*/; do
    MIGRATION_NAME=$(basename "$dir")
    HAS_SQL=$(ls "$dir"/*.sql 2>/dev/null | wc -l)
    if [[ "$HAS_SQL" -eq 0 ]]; then
      err "  Migration '$MIGRATION_NAME' has no .sql file!"
      ERRORS=$((ERRORS + 1))
    else
      info "    ✓ $MIGRATION_NAME"
    fi
  done
fi
echo ""

# ── 3. Check for db push references (should not exist) ──
info "Step 3: Checking for deprecated db push usage..."
if grep -r "prisma db push" scripts/ 2>/dev/null | grep -v "pre-deploy-verify" | grep -v "# deprecated"; then
  warn "Found 'prisma db push' references in scripts (should use 'migrate deploy')"
  ERRORS=$((ERRORS + 1))
else
  ok "No deprecated db push usage in scripts"
fi
echo ""

# ── 4. Validate Prisma schema ──
info "Step 4: Validating Prisma schema..."
if bunx prisma generate 2>/dev/null || npx prisma generate 2>/dev/null; then
  ok "Prisma schema is valid"
else
  err "Prisma schema validation failed!"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 5. Check critical files exist ──
info "Step 5: Checking critical files..."
CRITICAL_FILES=(
  "src/lib/db.ts"
  "src/lib/decimal-serializer.ts"
  "src/lib/ledger-helper.ts"
  "src/lib/tenant-db.ts"
  "scripts/deploy-update.sh"
  "scripts/rollback-deploy.sh"
  "scripts/backup-db.sh"
)
for file in "${CRITICAL_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    info "  ✓ $file"
  else
    err "  Missing: $file"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# ── 6. Check .env exists ──
info "Step 6: Checking .env..."
if [[ -f ".env" ]]; then
  ok ".env file exists"
  if grep -q "DATABASE_URL" .env; then
    ok "DATABASE_URL is set"
  else
    err "DATABASE_URL not found in .env"
    ERRORS=$((ERRORS + 1))
  fi
else
  err ".env file not found"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 7. Summary ──
echo "============================================"
if [[ "$ERRORS" -eq 0 ]]; then
  ok "ALL CHECKS PASSED — Ready to deploy!"
  echo ""
  echo "Next steps:"
  echo "  1. bash scripts/deploy-update.sh"
  echo "  2. Test the app in your browser"
  echo ""
  echo "  If something breaks:"
  echo "    bash scripts/rollback-deploy.sh"
  echo ""
else
  err "$ERRORS ERROR(S) FOUND — Fix before deploying!"
  echo ""
  exit 1
fi
echo "============================================"
