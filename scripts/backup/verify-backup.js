#!/usr/bin/env node
// ── verify-backup.js ──
//
// Inspects a pg_dump SQL file for completeness. Runs 8 structural checks and
// prints a human-readable report. Designed to be invoked by backup.sh after a
// pg_dump, by restore.sh before a restore, or manually during incident
// response.
//
// Usage:
//   node verify-backup.js <path-to-sql>
//   node verify-backup.js --latest                 # inspect newest *.sql in backups/
//   node verify-backup.js --stdin                  # read from STDIN instead of a file
//   cat dump.sql | node verify-backup.js --stdin
//
// Exit codes:
//   0 = healthy                       (all checks passed, may have non-blocking warnings)
//   1 = missing / unreadable          (file does not exist, not readable, empty)
//   2 = structurally incomplete       (one or more critical checks failed)
//
// Checks:
//   1.  pg_dump header present ("-- PostgreSQL database dump")
//   2.  pg_dump footer present ("-- PostgreSQL database dump complete")
//   3.  all 29 expected tables have CREATE TABLE
//   4.  core tables have COPY statements (data present)
//   5.  file size is reasonable (> 50KB)
//   6.  no error markers (pg_dump error: / ERROR: / FATAL:)
//   7.  COPY block count matches expected (≥ 20 COPY ... blocks)
//   8.  sequence reset statements present (SELECT pg_catalog.setval / ALTER SEQUENCE)

"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ── The 29 tables defined in prisma/schema.prisma ──
// Prisma emits them as quoted, case-sensitive identifiers in pg_dump output,
// e.g. `CREATE TABLE "BusinessType" (` — so we match the model names verbatim.
const EXPECTED_TABLES = [
  "BusinessType",
  "User",
  "Business",
  "BusinessUser",
  "Category",
  "Product",
  "Batch",
  "Inventory",
  "Transaction",
  "OtpVerification",
  "Session",
  "AlertPreference",
  "NotificationLog",
  "Customer",
  "Sale",
  "SaleItem",
  "Payment",
  "Return",
  "ReturnItem",
  "DiscountRule",
  "Supplier",
  "Purchase",
  "PurchaseItem",
  "AIUsageLog",
  "SuperAdmin",
  "SuperAdminSession",
  "BusinessDailyStats",
  "CronJobLog",
  "AIResponseCache",
];

// Core tables whose COPY blocks must be present for the dump to be considered
// "complete enough to restore and use". These are the tables that hold the
// platform's operational truth — without them, a restore is meaningless even
// if the schema is intact.
const CORE_TABLES = [
  "BusinessType",
  "User",
  "Business",
  "BusinessUser",
  "Product",
  "Batch",
  "Inventory",
  "Sale",
  "SaleItem",
  "Payment",
  "Customer",
  "Supplier",
  "Purchase",
  "PurchaseItem",
  "AIUsageLog",
  "SuperAdmin",
  "SuperAdminSession",
  "CronJobLog",
  "BusinessDailyStats",
];

const MIN_FILE_SIZE_BYTES = 50 * 1024; // 50 KB
const MIN_COPY_BLOCKS = 20; // core tables + a few lookups; loose floor

// ── Helpers ──

function pad(str, len) {
  return String(str).padEnd(len, " ");
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Find the newest *.sql file in ./backups/ (or BACKUP_DIR if set).
 * Returns null if none exists.
 */
function findLatestBackup() {
  const dir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(process.cwd(), "backups");
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const sqlFiles = entries
    .filter((e) => e.isFile() && /\.sql$/i.test(e.name))
    .map((e) => {
      const full = path.join(dir, e.name);
      try {
        return { name: full, mtime: fs.statSync(full).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  return sqlFiles.length > 0 ? sqlFiles[0].name : null;
}

/** Read all of STDIN into a string. */
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

// ── Main verification routine ──
//
// We do NOT load the entire file into memory if it's huge — we stream it line
// by line for the structural scans, but we do read the first 64KB and last 64KB
// separately for the header/footer checks (which are always at the file's
// edges) and accept that pg_dump's footer always comes last.

async function verifyFile(filePath, source) {
  const checks = [];
  let exitCode = 0;

  // ── Pre-check: file readability + size ──
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (err) {
    checks.push({
      name: "File readable",
      ok: false,
      detail: `${source}: ${err.message}`,
      critical: true,
    });
    // Nothing else to check; bail out.
    return finish(checks, 1);
  }

  // ── Check 5: file size reasonable ──
  const sizeOk = stat.size >= MIN_FILE_SIZE_BYTES;
  checks.push({
    name: "File size reasonable (>50KB)",
    ok: sizeOk,
    detail: sizeOk
      ? `${fmtBytes(stat.size)}`
      : `Only ${fmtBytes(stat.size)} — likely a truncated or empty dump`,
    critical: !sizeOk,
  });

  if (!sizeOk && stat.size === 0) {
    // An empty file is structurally incomplete AND unreadable-ish; report and
    // bail.
    checks.push({
      name: "File not empty",
      ok: false,
      detail: "File is empty (0 bytes)",
      critical: true,
    });
    return finish(checks, 2);
  }

  // ── Stream the file line-by-line and accumulate evidence ──
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  const createTableFound = new Set(); // table names with CREATE TABLE
  const copyFound = new Set(); // table names with COPY ... FROM stdin
  let copyBlockCount = 0; // number of COPY blocks total
  let setvalCount = 0; // SELECT pg_catalog.setval(...)
  let alterSeqCount = 0; // ALTER SEQUENCE ... RESTART ...
  let errorMarkers = []; // any "pg_dump: error:" / "ERROR:" / "FATAL:" lines
  let headerFound = false;
  let footerFound = false;
  const HEADER_RE = /-- PostgreSQL database dump/;
  const FOOTER_RE = /-- PostgreSQL database dump complete/;
  const CREATE_RE = /^CREATE TABLE\s+(?:public\.)?"([^"]+)"\s*\(/i;
  const COPY_RE = /^COPY\s+(?:public\.)?"([^"]+)"\s+\([^)]*\)\s+FROM stdin;/i;
  const SETVAL_RE = /SELECT pg_catalog\.setval\s*\(/i;
  const ALTERSEQ_RE = /ALTER SEQUENCE\s+(?:public\.)?"([^"]+)"/i;
  const ERROR_RE = /^(pg_dump:\s*error:|ERROR:\s|FATAL:\s|pg_restore:\s*error:)/i;

  for await (const line of rl) {
    if (!headerFound && HEADER_RE.test(line)) headerFound = true;
    if (!footerFound && FOOTER_RE.test(line)) footerFound = true;

    const createMatch = line.match(CREATE_RE);
    if (createMatch) createTableFound.add(createMatch[1]);

    const copyMatch = line.match(COPY_RE);
    if (copyMatch) {
      copyFound.add(copyMatch[1]);
      copyBlockCount++;
    }

    if (SETVAL_RE.test(line)) setvalCount++;
    if (ALTERSEQ_RE.test(line)) alterSeqCount++;

    if (errorMarkers.length < 10 && ERROR_RE.test(line)) {
      errorMarkers.push(line.trim().slice(0, 200));
    }
  }

  // ── Check 1: pg_dump header ──
  checks.push({
    name: "pg_dump header present",
    ok: headerFound,
    detail: headerFound
      ? "Found '-- PostgreSQL database dump' marker"
      : "Header marker not found — file may not be a pg_dump output",
    critical: !headerFound,
  });

  // ── Check 2: pg_dump footer ──
  checks.push({
    name: "pg_dump footer present",
    ok: footerFound,
    detail: footerFound
      ? "Found '-- PostgreSQL database dump complete' marker"
      : "Footer marker not found — dump may be truncated",
    critical: !footerFound,
  });

  // ── Check 3: all expected tables have CREATE TABLE ──
  const missingTables = EXPECTED_TABLES.filter((t) => !createTableFound.has(t));
  const allTablesPresent = missingTables.length === 0;
  checks.push({
    name: `All ${EXPECTED_TABLES.length} expected tables present`,
    ok: allTablesPresent,
    detail: allTablesPresent
      ? `All ${EXPECTED_TABLES.length} tables have CREATE TABLE`
      : `Missing CREATE TABLE for: ${missingTables.join(", ")}${
          createTableFound.size > 0
            ? ` (found ${createTableFound.size}/${EXPECTED_TABLES.length})`
            : ""
        }`,
    critical: !allTablesPresent,
  });

  // ── Check 4: core tables have COPY statements ──
  const missingCopy = CORE_TABLES.filter((t) => !copyFound.has(t));
  const allCoreCopiesPresent = missingCopy.length === 0;
  checks.push({
    name: `Core tables have COPY statements (${CORE_TABLES.length} tables)`,
    ok: allCoreCopiesPresent,
    detail: allCoreCopiesPresent
      ? `All ${CORE_TABLES.length} core tables have COPY ... FROM stdin`
      : `Missing COPY for: ${missingCopy.join(", ")}`,
    critical: !allCoreCopiesPresent,
  });

  // ── Check 6: no error markers ──
  const noErrors = errorMarkers.length === 0;
  checks.push({
    name: "No error markers",
    ok: noErrors,
    detail: noErrors
      ? "No 'pg_dump: error:' / 'ERROR:' / 'FATAL:' lines detected"
      : `Found ${errorMarkers.length} error marker(s): ${errorMarkers[0].slice(0, 120)}…`,
    critical: !noErrors,
  });

  // ── Check 7: COPY block count ──
  const copyCountOk = copyBlockCount >= MIN_COPY_BLOCKS;
  checks.push({
    name: `COPY block count ≥ ${MIN_COPY_BLOCKS}`,
    ok: copyCountOk,
    detail: `Found ${copyBlockCount} COPY ... FROM stdin blocks`,
    critical: !copyCountOk,
  });

  // ── Check 8: sequence reset statements ──
  // pg_dump emits `SELECT pg_catalog.setval(...)` for any sequence that was
  // advanced during insert, and `ALTER SEQUENCE ... OWNED BY ...` for the
  // schema. Either-or is acceptable; we just want to see ≥1 sequence statement.
  const sequenceStatements = setvalCount + alterSeqCount;
  const sequenceOk = sequenceStatements > 0;
  checks.push({
    name: "Sequence reset statements present",
    ok: sequenceOk,
    detail: sequenceOk
      ? `Found ${setvalCount} setval() + ${alterSeqCount} ALTER SEQUENCE statements`
      : "No setval() or ALTER SEQUENCE statements found — sequences may not be reset after restore",
    critical: false, // not strictly fatal (tables may simply have no sequences)
  });

  // ── Decide exit code ──
  const anyCritical = checks.some((c) => !c.ok && c.critical);
  exitCode = anyCritical ? 2 : 0;
  return finish(checks, exitCode);
}

function finish(checks, exitCode) {
  // ── Print report ──
  const label = exitCode === 0 ? "HEALTHY" : exitCode === 1 ? "UNREADABLE" : "INCOMPLETE";
  console.log("");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`  Backup verification report — ${label}`);
  console.log("════════════════════════════════════════════════════════════════");
  console.log("");
  for (const c of checks) {
    const mark = c.ok ? "✓" : c.critical ? "✗" : "!";
    const status = c.ok ? "PASS" : c.critical ? "FAIL" : "WARN";
    console.log(`  ${mark} [${status}] ${pad(c.name, 50)}`);
    console.log(`           ${c.detail}`);
  }
  console.log("");
  console.log(
    `  Summary: ${checks.filter((c) => c.ok).length}/${checks.length} checks passed ` +
      `(${checks.filter((c) => !c.ok && c.critical).length} critical failures)`
  );
  console.log(`  Exit code: ${exitCode} (${label})`);
  console.log("");
  process.exit(exitCode);
}

// ── CLI entrypoint ──
async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    console.error(
      "Usage: node verify-backup.js <path-to-sql> | --latest | --stdin"
    );
    process.exit(1);
  }

  // --stdin: read dump from STDIN into a temp file (we need seekable/stat-able
  // access for the streaming pass; writing to a temp file is simplest).
  if (argv.includes("--stdin")) {
    const tmp = require("os").tmpdir();
    const tmpFile = path.join(
      tmp,
      `verify-backup-stdin-${process.pid}-${Date.now()}.sql`
    );
    let data;
    try {
      data = await readStdin();
    } catch (err) {
      console.error(`Failed to read STDIN: ${err.message}`);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.error("STDIN was empty — nothing to verify");
      process.exit(1);
    }
    try {
      fs.writeFileSync(tmpFile, data, { encoding: "utf8" });
    } catch (err) {
      console.error(`Failed to write temp file: ${err.message}`);
      process.exit(1);
    }
    console.log(`[verify-backup] Read ${fmtBytes(data.length)} from STDIN → ${tmpFile}`);
    try {
      await verifyFile(tmpFile, "STDIN");
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* best-effort */
      }
    }
    return;
  }

  if (argv.includes("--latest")) {
    const latest = findLatestBackup();
    if (!latest) {
      console.error(
        "[verify-backup] --latest: no .sql files found in ./backups/ (or $BACKUP_DIR)"
      );
      process.exit(1);
    }
    console.log(`[verify-backup] Inspecting latest backup: ${latest}`);
    return verifyFile(latest, latest);
  }

  // Default: explicit file path
  const file = argv[0];
  if (!file) {
    console.error("Usage: node verify-backup.js <path-to-sql> | --latest | --stdin");
    process.exit(1);
  }
  return verifyFile(path.resolve(file), file);
}

main().catch((err) => {
  console.error(`[verify-backup] Uncaught error: ${err.stack || err.message || err}`);
  process.exit(1);
});
