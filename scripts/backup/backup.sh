#!/usr/bin/env bash
# ── backup.sh ──
#
# Wrapper around pg_dump that:
#   • runs pre-flight checks (Docker running, DB container up)
#   • dumps the production database to a timestamped .sql file
#   • runs scripts/backup/verify-backup.js against the fresh dump
#   • applies retention (7 days of daily backups + 365 days for 1st-of-month
#     monthly archives)
#   • prints a final report (file size + duration)
#
# Usage:
#   ./scripts/backup/backup.sh                 # daily backup with verification
#   ./scripts/backup/backup.sh --label manual  # custom label in the filename
#   ./scripts/backup/backup.sh --no-verify     # skip the verify-backup.js pass
#   ./scripts/backup/backup.sh --help          # show this help
#
# Env vars (all optional — sensible defaults provided):
#   DB_CONTAINER    Docker container running Postgres (default: inventoryos-db)
#   DB_USER         Postgres user (default: inventoryos)
#   DB_NAME         Postgres database name (default: inventoryos)
#   DB_PASSWORD     Postgres password (required; reads from .env if unset)
#   BACKUP_DIR      Directory to write backups to (default: ./backups)
#   RETENTION_DAILY_DAYS   Days to keep daily backups (default: 7)
#   RETENTION_MONTHLY_DAYS Days to keep 1st-of-month archives (default: 365)
#
# Exit codes:
#   0 = success
#   1 = pre-flight failure (Docker not running, container down, etc.)
#   2 = pg_dump failed
#   3 = verification failed (only when --no-verify is NOT passed)
#   4 = retention sweep failed (non-fatal in practice; see code)

set -euo pipefail

# ── Defaults ──
DB_CONTAINER="${DB_CONTAINER:-inventoryos-db}"
DB_USER="${DB_USER:-inventoryos}"
DB_NAME="${DB_NAME:-inventoryos}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/backups}"
RETENTION_DAILY_DAYS="${RETENTION_DAILY_DAYS:-7}"
RETENTION_MONTHLY_DAYS="${RETENTION_MONTHLY_DAYS:-365}"

LABEL=""
DO_VERIFY=1

# ── Color helpers (best-effort; degrade gracefully if not a TTY) ──
if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_GREEN="\033[32m"; C_RED="\033[31m"
  C_YELLOW="\033[33m"; C_BLUE="\033[34m"; C_DIM="\033[2m"
else
  C_RESET=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_BLUE=""; C_DIM=""
fi

log()  { printf "%b[backup]%b %s\n" "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf "%b[backup]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_GREEN" "✓ " "$C_RESET" "$*"; }
warn() { printf "%b[backup]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_YELLOW" "! " "$C_RESET" "$*" >&2; }
err()  { printf "%b[backup]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_RED" "✗ " "$C_RESET" "$*" >&2; }

# ── Argument parsing ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)
      LABEL="${2:-}"
      shift 2
      ;;
    --label=*)
      LABEL="${1#--label=}"
      shift
      ;;
    --no-verify)
      DO_VERIFY=0
      shift
      ;;
    --help|-h)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      err "Unknown argument: $1"
      err "See --help for usage."
      exit 1
      ;;
  esac
done

# ── Resolve DB_PASSWORD from .env if not set ──
if [[ -z "${DB_PASSWORD:-}" ]]; then
  # Try the project root .env (and .env.production)
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  for env_file in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.production"; do
    if [[ -f "$env_file" ]]; then
      # shellcheck disable=SC1090
      set -a
      # shellcheck disable=SC1090
      source "$env_file" 2>/dev/null || true
      set +a
    fi
  done
fi
if [[ -z "${DB_PASSWORD:-}" ]]; then
  err "DB_PASSWORD is not set (env or .env)"
  err "Set DB_PASSWORD in your environment or .env file before running this script."
  exit 1
fi

# ── Pre-flight checks ──
log "Pre-flight checks..."

# 1. Docker daemon running?
if ! command -v docker >/dev/null 2>&1; then
  err "docker command not found on PATH"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  err "Docker daemon is not running (or current user lacks access)."
  err "Start Docker and retry."
  exit 1
fi
ok "Docker daemon is running"

# 2. DB container up?
if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  err "Container '$DB_CONTAINER' is not running."
  err "Start it with: docker compose up -d db"
  exit 1
fi
ok "Container '$DB_CONTAINER' is up"

# 3. Database responsive (pg_isready)?
if ! docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  err "pg_isready reports the database is NOT accepting connections"
  err "Check container logs: docker logs $DB_CONTAINER"
  exit 1
fi
ok "Database is accepting connections"

# 4. Backup directory exists / can be created
mkdir -p "$BACKUP_DIR"
if [[ ! -d "$BACKUP_DIR" ]]; then
  err "Could not create BACKUP_DIR: $BACKUP_DIR"
  exit 1
fi
ok "Backup directory: $BACKUP_DIR"

# 5. verify-backup.js available (if --no-verify not passed)
VERIFY_SCRIPT="$(cd "$(dirname "$0")" && pwd)/verify-backup.js"
if [[ "$DO_VERIFY" -eq 1 ]]; then
  if [[ ! -f "$VERIFY_SCRIPT" ]]; then
    err "verify-backup.js not found at: $VERIFY_SCRIPT"
    exit 1
  fi
  if ! command -v node >/dev/null 2>&1; then
    err "node command not found on PATH (required for verification)"
    exit 1
  fi
  ok "verify-backup.js + node available"
fi

# ── Build backup filename ──
# Format: inventoryos-YYYY-MM-DD_HHMMSS[-label].sql
TS="$(date -u +'%Y-%m-%d_%H%M%S')"
DAY_OF_MONTH="$(date -u +'%d')"
FILE_BASE="inventoryos-${TS}"
if [[ -n "$LABEL" ]]; then
  FILE_BASE="${FILE_BASE}-${LABEL}"
fi
BACKUP_FILE="${BACKUP_DIR}/${FILE_BASE}.sql"

# Is this a 1st-of-month backup? (Those get extended retention.)
IS_MONTHLY=0
if [[ "$DAY_OF_MONTH" == "01" ]]; then
  IS_MONTHLY=1
fi

# ── Run pg_dump ──
log "Running pg_dump → ${C_DIM}${BACKUP_FILE}${C_RESET}"
log "  container: $DB_CONTAINER   database: $DB_NAME   user: $DB_USER"
START_EPOCH="$(date +%s)"

# We pipe through `docker exec -i` because pg_dump runs inside the container,
# but we want the .sql file written on the host (so it can be picked up by
# external backup tooling / Docker volume snapshots separately).
#
# --no-owner / --no-privileges: dump only schema + data, not ownership grants
# (so the file can be restored into a fresh DB with a different superuser).
# --clean --if-exists: emit DROP TABLE IF EXISTS before each CREATE so the file
# can be piped to psql against a non-empty database idempotently.
if ! docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        pg_dump \
          --username "$DB_USER" \
          --dbname "$DB_NAME" \
          --no-owner \
          --no-privileges \
          --clean \
          --if-exists \
          --verbose \
    > "$BACKUP_FILE" 2> "${BACKUP_FILE}.err"; then
  err "pg_dump failed. Tail of error log:"
  tail -n 50 "${BACKUP_FILE}.err" >&2 || true
  rm -f "$BACKUP_FILE" "${BACKUP_FILE}.err"
  exit 2
fi
rm -f "${BACKUP_FILE}.err"

END_EPOCH="$(date +%s)"
DURATION_SEC=$((END_EPOCH - START_EPOCH))

# File size
FILE_SIZE_BYTES="$(stat -c %s "$BACKUP_FILE" 2>/dev/null || stat -f %z "$BACKUP_FILE" 2>/dev/null || echo 0)"
FILE_SIZE_HR="$(numfmt --to=iec --suffix=B "$FILE_SIZE_BYTES" 2>/dev/null || echo "${FILE_SIZE_BYTES} bytes")"

ok "pg_dump completed in ${DURATION_SEC}s (${FILE_SIZE_HR})"

# ── Verify ──
if [[ "$DO_VERIFY" -eq 1 ]]; then
  log "Running verify-backup.js..."
  if ! node "$VERIFY_SCRIPT" "$BACKUP_FILE"; then
    err "Verification FAILED — backup file may be corrupt or incomplete."
    err "Backup file kept for inspection: $BACKUP_FILE"
    exit 3
  fi
  ok "Backup passed structural verification"
fi

# ── Tag monthly backups ──
if [[ "$IS_MONTHLY" -eq 1 ]]; then
  MONTHLY_TAG="${BACKUP_DIR}/${FILE_BASE}.monthly"
  echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > "$MONTHLY_TAG"
  ok "Tagged as monthly archive (extended ${RETENTION_MONTHLY_DAYS}d retention): $(basename "$MONTHLY_TAG")"
fi

# ── Apply retention ──
log "Applying retention (daily: ${RETENTION_DAILY_DAYS}d, monthly: ${RETENTION_MONTHLY_DAYS}d)..."

# Daily retention: delete .sql files older than RETENTION_DAILY_DAYS days, UNLESS
# they have a matching .monthly tag (those are protected by the monthly sweep).
RETENTION_CUTOFF_DAY="$(date -u -d "${RETENTION_DAILY_DAYS} days ago" +'%Y-%m-%d' 2>/dev/null \
                       || date -u -v-${RETENTION_DAILY_DAYS}d +'%Y-%m-%d' 2>/dev/null \
                       || true)"

DAILY_DELETED=0
if [[ -n "$RETENTION_CUTOFF_DAY" ]]; then
  while IFS= read -r -d '' f; do
    # Skip if a .monthly tag exists for this file
    if [[ -f "${f}.monthly" ]]; then
      continue
    fi
    rm -f "$f"
    DAILY_DELETED=$((DAILY_DELETED + 1))
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'inventoryos-*.sql' -not -newermt "$RETENTION_CUTOFF_DAY" -print0)
fi
ok "Daily retention: removed $DAILY_DELETED expired file(s)"

# Monthly retention: delete .sql files with a .monthly tag older than
# RETENTION_MONTHLY_DAYS days (plus the .monthly tag itself).
RETENTION_CUTOFF_MONTH="$(date -u -d "${RETENTION_MONTHLY_DAYS} days ago" +'%Y-%m-%d' 2>/dev/null \
                          || date -u -v-${RETENTION_MONTHLY_DAYS}d +'%Y-%m-%d' 2>/dev/null \
                          || true)"

MONTHLY_DELETED=0
if [[ -n "$RETENTION_CUTOFF_MONTH" ]]; then
  while IFS= read -r -d '' tag; do
    local_sql="${tag%.monthly}.sql"
    rm -f "$tag" "$local_sql"
    MONTHLY_DELETED=$((MONTHLY_DELETED + 1))
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'inventoryos-*.sql.monthly' -not -newermt "$RETENTION_CUTOFF_MONTH" -print0)
fi
ok "Monthly retention: removed $MONTHLY_DELETED expired archive(s)"

# ── Final report ──
echo ""
echo "────────────────────────────────────────────────────────────────"
printf "  %bBACKUP COMPLETE%b\n" "$C_GREEN" "$C_RESET"
echo "────────────────────────────────────────────────────────────────"
printf "  File:      %s\n" "$BACKUP_FILE"
printf "  Size:      %s\n" "$FILE_SIZE_HR"
printf "  Duration:  %ss\n" "$DURATION_SEC"
printf "  Verified:  %s\n" "$([[ "$DO_VERIFY" -eq 1 ]] && echo "yes" || echo "skipped (--no-verify)")"
printf "  Monthly:   %s\n" "$([[ "$IS_MONTHLY" -eq 1 ]] && echo "yes (extended ${RETENTION_MONTHLY_DAYS}d retention)" || echo "no")"
printf "  Retention: deleted %s daily + %s monthly file(s)\n" "$DAILY_DELETED" "$MONTHLY_DELETED"
echo "────────────────────────────────────────────────────────────────"
echo ""

exit 0
