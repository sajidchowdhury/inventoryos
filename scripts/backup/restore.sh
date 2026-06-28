#!/usr/bin/env bash
# ── restore.sh ──
#
# Safe restore of an InventoryOS backup.
#
# By default this restores into a TEST database (inventoryos_restore_test) so
# operators can inspect a backup before committing it to production. Restoring
# into the production database requires an explicit --target=inventoryos flag
# AND typing the confirmation phrase "OVERWRITE PRODUCTION".
#
# Usage:
#   ./scripts/backup/restore.sh <path-to-backup.sql>
#   ./scripts/backup/restore.sh <path-to-backup.sql> --target=inventoryos
#   ./scripts/backup/restore.sh --latest                       # use newest backup
#   ./scripts/backup/restore.sh --latest --target=inventoryos  # newest → prod
#   ./scripts/backup/restore.sh --help
#
# Env vars (all optional — sensible defaults provided):
#   DB_CONTAINER    Docker container running Postgres (default: inventoryos-db)
#   DB_USER         Postgres user (default: inventoryos)
#   DB_PASSWORD     Postgres password (required; reads from .env if unset)
#   TEST_DB_NAME    Test database to restore into (default: inventoryos_restore_test)
#   PROD_DB_NAME    Production database name (default: inventoryos)
#
# Exit codes:
#   0 = success
#   1 = bad arguments / pre-flight failure
#   2 = backup file not found or failed structural verification
#   3 = restore failed (psql reported an error)
#   4 = production restore attempted without confirmation

set -euo pipefail

# ── Defaults ──
DB_CONTAINER="${DB_CONTAINER:-inventoryos-db}"
DB_USER="${DB_USER:-inventoryos}"
TEST_DB_NAME="${TEST_DB_NAME:-inventoryos_restore_test}"
PROD_DB_NAME="${PROD_DB_NAME:-inventoryos}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/backups}"

TARGET_DB=""
BACKUP_FILE=""
USE_LATEST=0
CONFIRM_OVERRIDE=0

# ── Color helpers ──
if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_GREEN="\033[32m"; C_RED="\033[31m"
  C_YELLOW="\033[33m"; C_BLUE="\033[34m"; C_DIM="\033[2m"
  C_BOLD="\033[1m"
else
  C_RESET=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_BLUE=""; C_DIM=""; C_BOLD=""
fi

log()  { printf "%b[restore]%b %s\n" "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf "%b[restore]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_GREEN" "✓ " "$C_RESET" "$*"; }
warn() { printf "%b[restore]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_YELLOW" "! " "$C_RESET" "$*" >&2; }
err()  { printf "%b[restore]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_RED" "✗ " "$C_RESET" "$*" >&2; }

# ── Argument parsing ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --latest)
      USE_LATEST=1
      shift
      ;;
    --target=*)
      TARGET_DB="${1#--target=}"
      shift
      ;;
    --target)
      TARGET_DB="${2:-}"
      shift 2
      ;;
    --help|-h)
      sed -n '2,32p' "$0"
      exit 0
      ;;
    --*)
      err "Unknown option: $1"
      err "See --help for usage."
      exit 1
      ;;
    *)
      if [[ -z "$BACKUP_FILE" ]]; then
        BACKUP_FILE="$1"
      else
        err "Unexpected positional argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

# ── Resolve DB_PASSWORD from .env if not set ──
if [[ -z "${DB_PASSWORD:-}" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  for env_file in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.production"; do
    if [[ -f "$env_file" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$env_file" 2>/dev/null || true
      set +a
    fi
  done
fi
if [[ -z "${DB_PASSWORD:-}" ]]; then
  err "DB_PASSWORD is not set (env or .env)"
  exit 1
fi

# ── Resolve --latest ──
if [[ "$USE_LATEST" -eq 1 ]]; then
  if [[ ! -d "$BACKUP_DIR" ]]; then
    err "BACKUP_DIR does not exist: $BACKUP_DIR"
    exit 2
  fi
  latest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'inventoryos-*.sql' -printf '%T@ %p\n' 2>/dev/null \
            | sort -rn | head -n 1 | awk '{print $2}')"
  if [[ -z "$latest" ]]; then
    err "No .sql backups found in $BACKUP_DIR"
    exit 2
  fi
  BACKUP_FILE="$latest"
  ok "Using latest backup: $BACKUP_FILE"
fi

# ── Validate backup file ──
if [[ -z "$BACKUP_FILE" ]]; then
  err "No backup file specified. Pass a path or use --latest."
  err "See --help for usage."
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  err "Backup file not found: $BACKUP_FILE"
  exit 2
fi

BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")"
FILE_SIZE_BYTES="$(stat -c %s "$BACKUP_FILE" 2>/dev/null || stat -f %z "$BACKUP_FILE" 2>/dev/null || echo 0)"
FILE_SIZE_HR="$(numfmt --to=iec --suffix=B "$FILE_SIZE_BYTES" 2>/dev/null || echo "${FILE_SIZE_BYTES} bytes")"

log "Backup file: $BACKUP_FILE ($FILE_SIZE_HR)"

# ── Pre-flight: Docker + DB container up ──
log "Pre-flight checks..."

if ! command -v docker >/dev/null 2>&1; then
  err "docker command not found on PATH"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  err "Docker daemon is not running"
  exit 1
fi
ok "Docker daemon is running"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  err "Container '$DB_CONTAINER' is not running"
  err "Start it with: docker compose up -d db"
  exit 1
fi
ok "Container '$DB_CONTAINER' is up"

# ── Pre-flight: structural verification ──
VERIFY_SCRIPT="$(cd "$(dirname "$0")" && pwd)/verify-backup.js"
if [[ ! -f "$VERIFY_SCRIPT" ]]; then
  err "verify-backup.js not found at: $VERIFY_SCRIPT"
  err "Cannot proceed without structural verification."
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  err "node command not found on PATH (required for verification)"
  exit 2
fi

log "Running structural verification..."
if ! node "$VERIFY_SCRIPT" "$BACKUP_FILE"; then
  err "Backup failed structural verification. Refusing to restore."
  err "Inspect the file manually or take a fresh backup."
  exit 2
fi
ok "Backup passed structural verification"

# ── Resolve target database ──
# Default → test DB. Production only with --target=inventoryos + confirmation.
if [[ -z "$TARGET_DB" ]]; then
  TARGET_DB="$TEST_DB_NAME"
  log "No --target specified; defaulting to TEST database: $TARGET_DB"
elif [[ "$TARGET_DB" == "$PROD_DB_NAME" ]]; then
  # Production restore — require explicit confirmation.
  echo ""
  printf "%b⚠️  PRODUCTION RESTORE REQUESTED ⚠️%b\n" "$C_RED" "$C_RESET"
  echo ""
  echo "You are about to restore into the PRODUCTION database:"
  echo "  Target:    $PROD_DB_NAME"
  echo "  Backup:    $BACKUP_FILE"
  echo "  Size:      $FILE_SIZE_HR"
  echo ""
  echo "This will DROP and REPLACE all data currently in '$PROD_DB_NAME'."
  echo ""
  printf "To confirm, type: %bOVERWRITE PRODUCTION%b\n" "$C_BOLD" "$C_RESET"
  printf "> "
  read -r CONFIRMATION
  if [[ "$CONFIRMATION" != "OVERWRITE PRODUCTION" ]]; then
    err "Confirmation did not match. Aborting production restore."
    err "Tip: omit --target to restore into the test database instead."
    exit 4
  fi
  ok "Production restore confirmed"
else
  log "Restoring into target database: $TARGET_DB"
fi

# ── Ensure target database exists ──
log "Ensuring target database '$TARGET_DB' exists..."

# Connect to the 'postgres' maintenance DB to create the target DB if missing.
EXISTING_DB_COUNT="$(docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname postgres --tuples-only --no-align \
  --command "SELECT COUNT(*) FROM pg_database WHERE datname = '$TARGET_DB';" 2>/dev/null \
  | tr -d '[:space:]')"

if [[ "$EXISTING_DB_COUNT" != "1" ]]; then
  log "Creating database '$TARGET_DB'..."
  if ! docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        psql --username "$DB_USER" --dbname postgres \
        --command "CREATE DATABASE \"$TARGET_DB\";" >/dev/null; then
    err "Failed to create database '$TARGET_DB'"
    exit 3
  fi
  ok "Database '$TARGET_DB' created"
else
  ok "Database '$TARGET_DB' already exists (will be overwritten)"
fi

# ── Restore ──
log "Restoring backup into '$TARGET_DB' (ON_ERROR_STOP=1)..."
START_EPOCH="$(date +%s)"

# We pipe the .sql file from the host into `docker exec -i psql`. We pass
# --set ON_ERROR_STOP=1 so psql aborts on the first error (avoids partial /
# corrupt restores that look "fine" but silently dropped tables).
#
# We also drop existing connections to the target DB so the restore doesn't
# compete with active sessions (best-effort; not all deployments allow this).
docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname postgres \
  --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || warn "Could not terminate existing sessions to '$TARGET_DB' (continuing)"

# The dump uses --clean --if-exists, so DROP/CREATE happens automatically
# inside the file. We just stream it in.
if ! docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        psql \
          --username "$DB_USER" \
          --dbname "$TARGET_DB" \
          --set ON_ERROR_STOP=1 \
          --quiet \
        < "$BACKUP_FILE"; then
  err "Restore failed (psql reported an error). The target database may be in a"
  err "partially-restored state. Inspect the dump and retry."
  exit 3
fi

END_EPOCH="$(date +%s)"
DURATION_SEC=$((END_EPOCH - START_EPOCH))
ok "Restore completed in ${DURATION_SEC}s"

# ── Post-restore: print row counts for key tables ──
log "Post-restore row counts for key tables:"

KEY_TABLES=(
  "BusinessType"
  "User"
  "Business"
  "BusinessUser"
  "Product"
  "Batch"
  "Inventory"
  "Sale"
  "SaleItem"
  "Payment"
  "Customer"
  "Supplier"
  "Purchase"
  "PurchaseItem"
  "AIUsageLog"
  "SuperAdmin"
  "SuperAdminSession"
  "CronJobLog"
  "BusinessDailyStats"
)

ROW_COUNTS_SQL=""
for t in "${KEY_TABLES[@]}"; do
  # Quote the table name to preserve Prisma's case-sensitive identifiers.
  ROW_COUNTS_SQL="${ROW_COUNTS_SQL}SELECT '${t}' AS table_name, COUNT(*) AS row_count FROM \"${t}\" UNION ALL "
done
# Strip the trailing "UNION ALL "
ROW_COUNTS_SQL="${ROW_COUNTS_SQL% UNION ALL }"
ROW_COUNTS_SQL="${ROW_COUNTS_SQL};"

echo ""
printf "  %b%-25s %10s%b\n" "$C_BOLD" "Table" "Rows" "$C_RESET"
echo "  ──────────────────────────────────────────"

docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname "$TARGET_DB" \
    --tuples-only --no-align --field-separator='|' \
    --command "$ROW_COUNTS_SQL" 2>/dev/null \
  | while IFS='|' read -r tbl rows; do
      printf "  %-25s %10s\n" "$tbl" "$rows"
    done

echo "  ──────────────────────────────────────────"
echo ""

# ── Final report ──
echo "────────────────────────────────────────────────────────────────"
printf "  %bRESTORE COMPLETE%b\n" "$C_GREEN" "$C_RESET"
echo "────────────────────────────────────────────────────────────────"
printf "  Backup:    %s\n" "$BACKUP_FILE"
printf "  Target:    %s%b%s%b\n" \
  "$([[ "$TARGET_DB" == "$PROD_DB_NAME" ]] && echo "$C_RED" || echo "$C_BLUE")" \
  "$TARGET_DB" \
  "$C_RESET" \
  ""
printf "  Size:      %s\n" "$FILE_SIZE_HR"
printf "  Duration:  %ss\n" "$DURATION_SEC"
if [[ "$TARGET_DB" != "$PROD_DB_NAME" ]]; then
  printf "  %bNOTE:%b This is the TEST database. To restore to production, re-run with --target=%s and confirm.%b\n" \
    "$C_YELLOW" "$C_RESET" "$PROD_DB_NAME" "$C_RESET"
fi
echo "────────────────────────────────────────────────────────────────"
echo ""

exit 0
