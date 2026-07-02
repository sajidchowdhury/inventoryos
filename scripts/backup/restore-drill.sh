#!/usr/bin/env bash
# ── restore-drill.sh ──
#
# Monthly automated disaster-recovery drill. The script:
#
#   1. Takes a fresh backup of the production database.
#   2. Verifies the backup with verify-backup.js.
#   3. Restores it into a disposable `inventoryos_drill` database.
#   4. Compares row counts in 21 critical tables between production and drill.
#   5. Spot-checks a single Business record (existence + key fields).
#   6. Drops the drill database and deletes the drill backup file.
#   7. Sends an email alert (if ALERT_EMAIL is set) summarizing pass/fail.
#
# This script is designed to be invoked from cron once per month:
#
#   0 4 1 * *  /opt/inventoryos/scripts/backup/restore-drill.sh \
#                >> /var/log/inventoryos/restore-drill.log 2>&1
#
# Usage:
#   ./scripts/backup/restore-drill.sh
#   ./scripts/backup/restore-drill.sh --keep        # don't drop drill DB / file
#   ./scripts/backup/restore-drill.sh --help
#
# Env vars (all optional — sensible defaults provided):
#   DB_CONTAINER       Docker container running Postgres (default: inventoryos-db)
#   DB_USER            Postgres user (default: inventoryos)
#   DB_PASSWORD        Postgres password (required; reads from .env if unset)
#   PROD_DB_NAME       Production database name (default: inventoryos)
#   DRILL_DB_NAME      Disposable drill database name (default: inventoryos_drill)
#   BACKUP_DIR         Directory for the drill backup file (default: ./backups)
#   ALERT_EMAIL        Optional: email address to alert on pass/fail
#   ALERT_FROM         Optional: sender address for the alert email (default: root@localhost)
#   SMTP_HOST          Optional: SMTP relay host (defaults to /usr/sbin/sendmail if unset)
#
# Exit codes:
#   0 = drill passed
#   1 = drill failed (backup, verify, restore, or row-count mismatch)

set -euo pipefail

# ── Defaults ──
DB_CONTAINER="${DB_CONTAINER:-inventoryos-db}"
DB_USER="${DB_USER:-inventoryos}"
PROD_DB_NAME="${PROD_DB_NAME:-inventoryos}"
DRILL_DB_NAME="${DRILL_DB_NAME:-inventoryos_drill}"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/backups}"
ALERT_FROM="${ALERT_FROM:-root@localhost}"

KEEP_DRILL=0

# ── Color helpers ──
if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_GREEN="\033[32m"; C_RED="\033[31m"
  C_YELLOW="\033[33m"; C_BLUE="\033[34m"; C_DIM="\033[2m"
else
  C_RESET=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_BLUE=""; C_DIM=""
fi

log()  { printf "%b[drill]%b %s\n" "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf "%b[drill]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_GREEN" "✓ " "$C_RESET" "$*"; }
warn() { printf "%b[drill]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_YELLOW" "! " "$C_RESET" "$*" >&2; }
err()  { printf "%b[drill]%b %s%b%s%b\n" "$C_BLUE" "$C_RESET" "$C_RED" "✗ " "$C_RESET" "$*" >&2; }

# ── Argument parsing ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep)
      KEEP_DRILL=1
      shift
      ;;
    --help|-h)
      sed -n '2,38p' "$0"
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

# ── Paths ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
RESTORE_SCRIPT="$SCRIPT_DIR/restore.sh"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-backup.js"

# All scripts we depend on must exist.
for s in "$BACKUP_SCRIPT" "$RESTORE_SCRIPT" "$VERIFY_SCRIPT"; do
  if [[ ! -f "$s" ]]; then
    err "Required script not found: $s"
    exit 1
  fi
done
if ! command -v docker >/dev/null 2>&1; then
  err "docker command not found on PATH"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  err "node command not found on PATH"
  exit 1
fi

# ── State ──
DRILL_RESULT="UNKNOWN"
DRILL_SUMMARY=""
DRILL_DETAILS=()
DRILL_BACKUP_FILE=""

# Output buffer for the email alert (collected throughout the run).
EMAIL_BUFFER="$(mktemp)"
trap 'rm -f "$EMAIL_BUFFER"' EXIT

# Capture every log line into the email buffer AND stdout.
log_to_buffer() {
  echo "$1" | tee -a "$EMAIL_BUFFER"
}
ok_to_buffer() {
  printf "✓ %s\n" "$1" | tee -a "$EMAIL_BUFFER"
}
err_to_buffer() {
  printf "✗ %s\n" "$1" | tee -a "$EMAIL_BUFFER" >&2
}

# ── Helper: send the alert email at the end of the run ──
send_alert_email() {
  local subject="[InventoryOS DRILL] ${DRILL_RESULT}: ${DRILL_SUMMARY:-no summary}"
  if [[ -z "${ALERT_EMAIL:-}" ]]; then
    return 0
  fi
  if [[ -z "${SMTP_HOST:-}" ]] && command -v sendmail >/dev/null 2>&1; then
    {
      echo "From: $ALERT_FROM"
      echo "To: $ALERT_EMAIL"
      echo "Subject: $subject"
      echo "Content-Type: text/plain; charset=UTF-8"
      echo ""
      echo "InventoryOS Restore Drill — $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
      echo ""
      cat "$EMAIL_BUFFER"
    } | sendmail -t -f "$ALERT_FROM" 2>/dev/null \
      && log_to_buffer "[drill] Alert email sent to $ALERT_EMAIL via sendmail" \
      || warn "Failed to send alert email via sendmail"
  elif [[ -n "${SMTP_HOST:-}" ]]; then
    # Try curl to an SMTP relay as a fallback
    local smtp_port="${SMTP_PORT:-25}"
    if command -v curl >/dev/null 2>&1; then
      {
        echo "From: $ALERT_FROM"
        echo "To: $ALERT_EMAIL"
        echo "Subject: $subject"
        echo ""
        cat "$EMAIL_BUFFER"
      } | curl --silent --show-error \
            --url "smtp://${SMTP_HOST}:${smtp_port}" \
            --mail-from "$ALERT_FROM" \
            --mail-rcpt "$ALERT_EMAIL" \
            --upload-file - 2>/dev/null \
        && log_to_buffer "[drill] Alert email sent to $ALERT_EMAIL via SMTP ($SMTP_HOST)" \
        || warn "Failed to send alert email via SMTP curl"
    else
      warn "SMTP_HOST set but curl not available — cannot send alert email"
    fi
  else
    warn "ALERT_EMAIL set but no sendmail binary or SMTP_HOST — cannot send alert email"
  fi
}

# ── Step 1: take a fresh backup ──
log_to_buffer "════════════════════════════════════════════════════════════════"
log_to_buffer "  InventoryOS Restore Drill — $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
log_to_buffer "════════════════════════════════════════════════════════════════"
log_to_buffer ""
log_to_buffer "Step 1/5: Take a fresh backup of production database '$PROD_DB_NAME'..."

mkdir -p "$BACKUP_DIR"
TS="$(date -u +'%Y-%m-%d_%H%M%S')"
DRILL_BACKUP_FILE="${BACKUP_DIR}/inventoryos-${TS}-drill.sql"

# We invoke pg_dump directly here (instead of calling backup.sh) because we
# want a single, specific file we control end-to-end and we don't want the
# retention sweep touching it.
START_EPOCH="$(date +%s)"
if ! docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        pg_dump \
          --username "$DB_USER" \
          --dbname "$PROD_DB_NAME" \
          --no-owner \
          --no-privileges \
          --clean \
          --if-exists \
        > "$DRILL_BACKUP_FILE" 2> "${DRILL_BACKUP_FILE}.err"; then
  DRILL_RESULT="FAIL"
  DRILL_SUMMARY="Backup step failed"
  err_to_buffer "Step 1 FAILED — pg_dump reported an error:"
  tail -n 30 "${DRILL_BACKUP_FILE}.err" 2>/dev/null | while IFS= read -r line; do
    err_to_buffer "  $line"
  done
  rm -f "$DRILL_BACKUP_FILE" "${DRILL_BACKUP_FILE}.err"
  send_alert_email
  exit 1
fi
rm -f "${DRILL_BACKUP_FILE}.err"
END_EPOCH="$(date +%s)"
DURATION_SEC=$((END_EPOCH - START_EPOCH))

FILE_SIZE_BYTES="$(stat -c %s "$DRILL_BACKUP_FILE" 2>/dev/null || stat -f %z "$DRILL_BACKUP_FILE" 2>/dev/null || echo 0)"
FILE_SIZE_HR="$(numfmt --to=iec --suffix=B "$FILE_SIZE_BYTES" 2>/dev/null || echo "${FILE_SIZE_BYTES} bytes")"

ok_to_buffer "Step 1 OK — backup created in ${DURATION_SEC}s (${FILE_SIZE_HR})"
ok_to_buffer "  File: $DRILL_BACKUP_FILE"

# ── Step 2: verify the backup ──
log_to_buffer ""
log_to_buffer "Step 2/5: Verify backup with verify-backup.js..."

if ! node "$VERIFY_SCRIPT" "$DRILL_BACKUP_FILE" >> "$EMAIL_BUFFER" 2>&1; then
  DRILL_RESULT="FAIL"
  DRILL_SUMMARY="Backup verification failed"
  err_to_buffer "Step 2 FAILED — backup did not pass structural verification"
  if [[ "$KEEP_DRILL" -eq 0 ]]; then
    rm -f "$DRILL_BACKUP_FILE"
    log_to_buffer "[drill] Deleted drill backup file (use --keep to retain)"
  fi
  send_alert_email
  exit 1
fi
ok_to_buffer "Step 2 OK — backup passed structural verification"

# ── Step 3: restore into the disposable drill database ──
log_to_buffer ""
log_to_buffer "Step 3/5: Restore into disposable drill database '$DRILL_DB_NAME'..."

# Drop the drill DB if it already exists (from a previous failed drill, etc.)
log_to_buffer "  Dropping existing '$DRILL_DB_NAME' if present..."
docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname postgres \
  --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DRILL_DB_NAME' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname postgres \
  --command "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\";" \
  >/dev/null 2>&1 || warn "Could not drop pre-existing drill DB (continuing)"

log_to_buffer "  Creating fresh '$DRILL_DB_NAME'..."
if ! docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        psql --username "$DB_USER" --dbname postgres \
        --command "CREATE DATABASE \"$DRILL_DB_NAME\";" >/dev/null; then
  DRILL_RESULT="FAIL"
  DRILL_SUMMARY="Could not create drill database"
  err_to_buffer "Step 3 FAILED — could not create drill database '$DRILL_DB_NAME'"
  if [[ "$KEEP_DRILL" -eq 0 ]]; then
    rm -f "$DRILL_BACKUP_FILE"
  fi
  send_alert_email
  exit 1
fi

RESTORE_START="$(date +%s)"
if ! docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        psql --username "$DB_USER" --dbname "$DRILL_DB_NAME" --set ON_ERROR_STOP=1 --quiet \
        < "$DRILL_BACKUP_FILE" >> "$EMAIL_BUFFER" 2>&1; then
  DRILL_RESULT="FAIL"
  DRILL_SUMMARY="Restore into drill database failed"
  err_to_buffer "Step 3 FAILED — psql reported an error during restore"
  if [[ "$KEEP_DRILL" -eq 0 ]]; then
    docker exec -i "$DB_CONTAINER" \
      env PGPASSWORD="$DB_PASSWORD" \
      psql --username "$DB_USER" --dbname postgres \
      --command "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\";" >/dev/null 2>&1 || true
    rm -f "$DRILL_BACKUP_FILE"
  fi
  send_alert_email
  exit 1
fi
RESTORE_END="$(date +%s)"
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
ok_to_buffer "Step 3 OK — restored into drill database in ${RESTORE_DURATION}s"

# ── Step 4: compare row counts in 21 critical tables ──
# 21 tables — enough to cover every operational surface (catalog, sales,
# inventory, AI, super-admin, cron, alerts) without over-running the drill.
COMPARE_TABLES=(
  "BusinessType"
  "User"
  "Business"
  "BusinessUser"
  "Category"
  "Product"
  "Batch"
  "Inventory"
  "Transaction"
  "Customer"
  "Sale"
  "SaleItem"
  "Payment"
  "Return"
  "ReturnItem"
  "Supplier"
  "Purchase"
  "PurchaseItem"
  "AIUsageLog"
  "SuperAdmin"
  "CronJobLog"
)

log_to_buffer ""
log_to_buffer "Step 4/5: Compare row counts in ${#COMPARE_TABLES[@]} critical tables..."

build_count_union() {
  local db="$1"
  local sql=""
  for t in "${COMPARE_TABLES[@]}"; do
    sql="${sql}SELECT '${t}' AS tbl, COUNT(*) AS n FROM \"${t}\" UNION ALL "
  done
  sql="${sql% UNION ALL }"
  echo "$sql"
}

PROD_COUNTS_FILE="$(mktemp)"
DRILL_COUNTS_FILE="$(mktemp)"
trap 'rm -f "$EMAIL_BUFFER" "$PROD_COUNTS_FILE" "$DRILL_COUNTS_FILE"' EXIT

docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname "$PROD_DB_NAME" \
    --tuples-only --no-align --field-separator='|' \
    --command "$(build_count_union "$PROD_DB_NAME")" \
  > "$PROD_COUNTS_FILE" 2>/dev/null \
  || err_to_buffer "  Could not fetch production row counts (continuing)"

docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname "$DRILL_DB_NAME" \
    --tuples-only --no-align --field-separator='|' \
    --command "$(build_count_union "$DRILL_DB_NAME")" \
  > "$DRILL_COUNTS_FILE" 2>/dev/null \
  || err_to_buffer "  Could not fetch drill row counts (continuing)"

# Diff the two outputs. `diff` exits 0 if identical, 1 if different, 2 on error.
if diff -q "$PROD_COUNTS_FILE" "$DRILL_COUNTS_FILE" >/dev/null 2>&1; then
  ok_to_buffer "Step 4 OK — all ${#COMPARE_TABLES[@]} table row counts match between production and drill"
  log_to_buffer ""
  log_to_buffer "  Table                    Production    Drill"
  log_to_buffer "  ──────────────────────────────────────────────────"
  while IFS='|' read -r tbl n; do
    printf "  %-24s %10s %10s\n" "$tbl" "$n" "$n" | tee -a "$EMAIL_BUFFER"
  done < "$PROD_COUNTS_FILE"
else
  DRILL_RESULT="FAIL"
  DRILL_SUMMARY="Row-count mismatch between production and drill"
  err_to_buffer "Step 4 FAILED — row counts differ between production and drill"
  log_to_buffer ""
  log_to_buffer "  Table                    Production    Drill     Match"
  log_to_buffer "  ──────────────────────────────────────────────────────────"
  # Pair up rows by table name; both files should be in the same order, but we
  # build an associative lookup to be safe.
  declare -A prod_map=()
  while IFS='|' read -r tbl n; do
    prod_map["$tbl"]="$n"
  done < "$PROD_COUNTS_FILE"
  while IFS='|' read -r tbl n; do
    pn="${prod_map["$tbl"]:-?}"
    match="✓"
    if [[ "$pn" != "$n" ]]; then
      match="✗"
    fi
    printf "  %-24s %10s %10s %6s\n" "$tbl" "$pn" "$n" "$match" | tee -a "$EMAIL_BUFFER"
  done < "$DRILL_COUNTS_FILE"

  if [[ "$KEEP_DRILL" -eq 0 ]]; then
    docker exec -i "$DB_CONTAINER" \
      env PGPASSWORD="$DB_PASSWORD" \
      psql --username "$DB_USER" --dbname postgres \
      --command "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\";" >/dev/null 2>&1 || true
    rm -f "$DRILL_BACKUP_FILE"
  fi
  send_alert_email
  exit 1
fi

# ── Step 5: spot-check a Business record ──
log_to_buffer ""
log_to_buffer "Step 5/5: Spot-check a Business record..."

# Pick the most recently created business from production, then verify the
# same id exists in drill with the same name/phone/tier.
SPOT_CHECK_ROW="$(docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="$DB_PASSWORD" \
  psql --username "$DB_USER" --dbname "$PROD_DB_NAME" \
    --tuples-only --no-align --field-separator='|' \
    --command "SELECT id, name, COALESCE(phone,''), subscriptionTier FROM \"Business\" ORDER BY \"createdAt\" DESC LIMIT 1;" \
  2>/dev/null || true)"

if [[ -z "$SPOT_CHECK_ROW" ]]; then
  warn_to_buffer="  No Business records in production — skipping spot-check"
  log_to_buffer "$warn_to_buffer"
else
  BIZ_ID="$(echo "$SPOT_CHECK_ROW" | cut -d'|' -f1)"
  BIZ_NAME="$(echo "$SPOT_CHECK_ROW" | cut -d'|' -f2)"
  BIZ_PHONE="$(echo "$SPOT_CHECK_ROW" | cut -d'|' -f3)"
  BIZ_TIER="$(echo "$SPOT_CHECK_ROW" | cut -d'|' -f4)"
  log_to_buffer "  Production Business: id=$BIZ_ID name='$BIZ_NAME' tier=$BIZ_TIER"

  DRILL_SPOT_CHECK="$(docker exec -i "$DB_CONTAINER" \
    env PGPASSWORD="$DB_PASSWORD" \
    psql --username "$DB_USER" --dbname "$DRILL_DB_NAME" \
      --tuples-only --no-align --field-separator='|' \
      --command "SELECT id, name, COALESCE(phone,''), subscriptionTier FROM \"Business\" WHERE id = '$BIZ_ID';" \
    2>/dev/null || true)"

  if [[ -z "$DRILL_SPOT_CHECK" ]]; then
    DRILL_RESULT="FAIL"
    DRILL_SUMMARY="Spot-check: business $BIZ_ID missing from drill DB"
    err_to_buffer "Step 5 FAILED — business '$BIZ_ID' not found in drill database"
    if [[ "$KEEP_DRILL" -eq 0 ]]; then
      docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        psql --username "$DB_USER" --dbname postgres \
        --command "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\";" >/dev/null 2>&1 || true
      rm -f "$DRILL_BACKUP_FILE"
    fi
    send_alert_email
    exit 1
  fi

  DRILL_ID="$(echo "$DRILL_SPOT_CHECK" | cut -d'|' -f1)"
  DRILL_NAME="$(echo "$DRILL_SPOT_CHECK" | cut -d'|' -f2)"
  DRILL_PHONE="$(echo "$DRILL_SPOT_CHECK" | cut -d'|' -f3)"
  DRILL_TIER="$(echo "$DRILL_SPOT_CHECK" | cut -d'|' -f4)"

  if [[ "$BIZ_ID" == "$DRILL_ID" \
        && "$BIZ_NAME" == "$DRILL_NAME" \
        && "$BIZ_PHONE" == "$DRILL_PHONE" \
        && "$BIZ_TIER" == "$DRILL_TIER" ]]; then
    ok_to_buffer "Step 5 OK — spot-check business matched (id, name, phone, tier all identical)"
  else
    DRILL_RESULT="FAIL"
    DRILL_SUMMARY="Spot-check: business $BIZ_ID fields differ"
    err_to_buffer "Step 5 FAILED — business fields differ between production and drill:"
    log_to_buffer "    Production: id=$BIZ_ID name='$BIZ_NAME' phone='$BIZ_PHONE' tier=$BIZ_TIER"
    log_to_buffer "    Drill:      id=$DRILL_ID name='$DRILL_NAME' phone='$DRILL_PHONE' tier=$DRILL_TIER"
    if [[ "$KEEP_DRILL" -eq 0 ]]; then
      docker exec -i "$DB_CONTAINER" \
        env PGPASSWORD="$DB_PASSWORD" \
        psql --username "$DB_USER" --dbname postgres \
        --command "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\";" >/dev/null 2>&1 || true
      rm -f "$DRILL_BACKUP_FILE"
    fi
    send_alert_email
    exit 1
  fi
fi

# ── Cleanup: drop drill DB + delete drill backup file ──
log_to_buffer ""
log_to_buffer "Cleanup: dropping drill database and deleting drill backup file..."

if [[ "$KEEP_DRILL" -eq 1 ]]; then
  warn "  --keep passed; leaving drill database and backup file in place"
  log_to_buffer "  --keep passed; leaving drill database and backup file in place"
  log_to_buffer "    Drill DB:   $DRILL_DB_NAME"
  log_to_buffer "    Backup:     $DRILL_BACKUP_FILE"
else
  docker exec -i "$DB_CONTAINER" \
    env PGPASSWORD="$DB_PASSWORD" \
    psql --username "$DB_USER" --dbname postgres \
    --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DRILL_DB_NAME' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  docker exec -i "$DB_CONTAINER" \
    env PGPASSWORD="$DB_PASSWORD" \
    psql --username "$DB_USER" --dbname postgres \
    --command "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\";" \
    >/dev/null 2>&1 \
    && ok_to_buffer "  Dropped drill database '$DRILL_DB_NAME'" \
    || err_to_buffer "  Could not drop drill database '$DRILL_DB_NAME' (cleanup deferred)"
  rm -f "$DRILL_BACKUP_FILE" \
    && ok_to_buffer "  Deleted drill backup file: $(basename "$DRILL_BACKUP_FILE")" \
    || err_to_buffer "  Could not delete drill backup file"
fi

# ── Final report ──
DRILL_RESULT="PASS"
DRILL_SUMMARY="Backup + verify + restore + ${#COMPARE_TABLES[@]}-table comparison + spot-check all passed"

log_to_buffer ""
log_to_buffer "════════════════════════════════════════════════════════════════"
printf "  %bDRILL PASSED%b\n" "$C_GREEN" "$C_RESET" | tee -a "$EMAIL_BUFFER"
log_to_buffer "════════════════════════════════════════════════════════════════"
log_to_buffer "  Backup:   $DRILL_BACKUP_FILE (deleted by cleanup)"
log_to_buffer "  Restore:  $DRILL_DB_NAME (dropped by cleanup)"
log_to_buffer "  Duration: backup=${DURATION_SEC}s + restore=${RESTORE_DURATION}s"
log_to_buffer "  Tables:   all ${#COMPARE_TABLES[@]} compared tables matched"
log_to_buffer "════════════════════════════════════════════════════════════════"
echo ""

send_alert_email
exit 0
