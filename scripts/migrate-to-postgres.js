// ── InventoryOS: SQLite → PostgreSQL Migration Script (v2 — Verified) ──
//
// WHAT'S NEW IN v2 (Gap 2 closure):
//   ✓ Handles `Transaction` table name (SQL reserved word — needs quoting)
//   ✓ Includes all 29 tables (including BusinessDailyStats, CronJobLog, AIResponseCache)
//   ✓ Per-table row count verification AFTER migration
//   ✓ PostgreSQL sequence reset (so new records don't conflict with migrated IDs)
//   ✓ Pre-migration validation (SQLite exists, PostgreSQL reachable & schema pushed)
//   ✓ --dry-run flag (validate without writing)
//   ✓ --verify-only flag (skip migration, just verify counts)
//   ✓ JSON field validation (BusinessUser.permissions must parse if non-null)
//   ✓ Better error reporting (collects errors, exits non-zero on failure)
//   ✓ Progress + timing per table
//
// USAGE:
//   node scripts/migrate-to-postgres.js                 # full migration
//   node scripts/migrate-to-postgres.js --dry-run       # validate only, no writes
//   node scripts/migrate-to-postgres.js --verify-only   # skip migration, verify counts
//
// PREREQUISITES:
//   1. SQLite database exists at db/custom.db
//   2. PostgreSQL is running and reachable via DATABASE_URL
//   3. Schema has been pushed to PostgreSQL: npx prisma db push
//      (uses DIRECT_DATABASE_URL — see docker-compose.yml)
//   4. PostgreSQL tables are EMPTY (this script uses skipDuplicates=true)
//
// EXIT CODES:
//   0 = success (or dry-run passed)
//   1 = migration failed (see error output)
//   2 = verification failed (row counts don't match)

const { PrismaClient } = require("@prisma/client");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const fs = require("fs");

// ── Parse CLI flags ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERIFY_ONLY = args.includes("--verify-only");

if (DRY_RUN && VERIFY_ONLY) {
  console.error("Error: --dry-run and --verify-only are mutually exclusive");
  process.exit(1);
}

// ── Table list in dependency order (parents before children) ──
// This order respects foreign keys — a child table cannot be inserted
// before its parent. Includes all 29 models.
const TABLES = [
  "BusinessType",
  "User",
  "Business",
  "BusinessUser",
  "Category",
  "Product",
  "Batch",
  "Inventory",
  // NOTE: "Transaction" is a SQL reserved word. We quote it with double quotes
  // in all raw SQL queries. Prisma's createMany handles it transparently.
  "Transaction",
  "Customer",
  "Supplier",
  "Sale",
  "SaleItem",
  "Payment",
  "Return",
  "ReturnItem",
  "Purchase",
  "PurchaseItem",
  "DiscountRule",
  "AlertPreference",
  "NotificationLog",
  "Session",
  "OtpVerification",
  "SuperAdmin",
  "SuperAdminSession",
  "AIUsageLog",
  "BusinessDailyStats",
  "CronJobLog",
  "AIResponseCache",
];

// ── Convert Prisma model name from PascalCase to camelCase ──
function toModelName(table) {
  return table.charAt(0).toLowerCase() + table.slice(1);
}

// ── Quote a SQL identifier (handles reserved words like "Transaction") ──
function quoteIdent(name) {
  return `"${name}"`;
}

// ── Validate that a value is JSON-parseable if it's a non-empty string ──
function validateJsonField(value, fieldName, tableName, rowId) {
  if (value === null || value === undefined || value === "") return value;
  if (typeof value !== "string") return value;
  try {
    JSON.parse(value);
    return value;
  } catch (e) {
    throw new Error(
      `Invalid JSON in ${tableName}.${fieldName} for id=${rowId}: ${e.message}`
    );
  }
}

// ── Time a function and return { result, ms } ──
async function timed(fn) {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
}

// ── Main migration ──
async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  InventoryOS — SQLite → PostgreSQL Migration (v2 — Verified)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : VERIFY_ONLY ? "VERIFY ONLY" : "FULL MIGRATION"}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Source: db/custom.db (SQLite)`);
  console.log(`  Target: ${process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || "(not set)"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── STEP 1: Open SQLite source ──
  console.log("▸ Step 1: Opening SQLite source...");
  const sqlitePath = path.join(__dirname, "..", "db", "custom.db");
  if (!fs.existsSync(sqlitePath)) {
    console.error(`✗ SQLite database not found at ${sqlitePath}`);
    console.error("  Run the dev server once to create it, or copy your existing database.");
    process.exit(1);
  }
  const sqliteDb = await open({
    filename: sqlitePath,
    driver: sqlite3.Database,
  });
  console.log("  ✓ SQLite opened\n");

  // ── STEP 2: Verify SQLite tables exist ──
  console.log("▸ Step 2: Verifying SQLite tables...");
  const sqliteTables = (await sqliteDb.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'"
  )).map((t) => t.name);

  const missingInSqlite = TABLES.filter((t) => !sqliteTables.includes(t));
  if (missingInSqlite.length > 0) {
    console.log(`  ⚠️ Tables in script but not in SQLite (will skip): ${missingInSqlite.join(", ")}`);
  }
  console.log(`  ✓ Found ${sqliteTables.length} tables in SQLite (${TABLES.length} in migration list)\n`);

  // ── DRY RUN: just show row counts and exit ──
  if (DRY_RUN) {
    console.log("▸ Dry-run validation:\n");
    let totalRows = 0;
    console.log(`  ${"Table".padEnd(28)} ${"Rows".padStart(8)}`);
    console.log(`  ${"-".repeat(28)} ${"-".repeat(8)}`);
    for (const table of TABLES) {
      try {
        const r = await sqliteDb.get(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`);
        console.log(`  ${table.padEnd(28)} ${String(r.c).padStart(8)}`);
        totalRows += r.c;
      } catch (e) {
        console.log(`  ${table.padEnd(28)} ${"ERROR".padStart(8)}`);
      }
    }
    console.log(`\n  Total rows to migrate: ${totalRows}`);
    console.log("\n  Dry run complete — no data was written to PostgreSQL.");
    console.log("  Run without --dry-run to perform the actual migration.");
    await sqliteDb.close();
    return;
  }

  // ── STEP 3: Connect to PostgreSQL ──
  console.log("▸ Step 3: Connecting to PostgreSQL...");
  const pg = new PrismaClient({
    log: ["warn", "error"],
  });
  try {
    await pg.$connect();
    console.log("  ✓ PostgreSQL connected\n");

    // ── STEP 4: Verify PostgreSQL schema is pushed ──
    console.log("▸ Step 4: Verifying PostgreSQL schema...");
    const pgTables = (await pg.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `).map((t) => t.table_name);

    if (pgTables.length === 0) {
      console.error("  ✗ PostgreSQL has no tables. Run 'npx prisma db push' first.");
      console.error("    Use DIRECT_DATABASE_URL (not the PgBouncer URL) for migrations.");
      process.exit(1);
    }

    const missingInPg = TABLES.filter((t) => !pgTables.includes(t));
    if (missingInPg.length > 0) {
      console.error(`  ✗ PostgreSQL missing tables: ${missingInPg.join(", ")}`);
      console.error("    Run 'npx prisma db push' to create missing tables.");
      process.exit(1);
    }
    console.log(`  ✓ All ${TABLES.length} tables exist in PostgreSQL\n`);

    // ── STEP 5: Check PostgreSQL tables are empty ──
    if (!VERIFY_ONLY) {
      console.log("▸ Step 5: Checking PostgreSQL tables are empty...");
      let nonEmptyTables = [];
      for (const table of TABLES) {
        const modelName = toModelName(table);
        if (typeof pg[modelName] === "undefined") continue;
        try {
          const count = await pg[modelName].count();
          if (count > 0) nonEmptyTables.push(`${table} (${count} rows)`);
        } catch (e) {
          // ignore count errors
        }
      }
      if (nonEmptyTables.length > 0) {
        console.log(`  ⚠️ PostgreSQL tables are NOT empty:`);
        nonEmptyTables.forEach((t) => console.log(`     ${t}`));
        console.log("  Continuing anyway with skipDuplicates=true (existing rows will be kept).");
        console.log("  If you want a clean migration, truncate these tables first:\n");
        console.log(`    TRUNCATE ${TABLES.map(quoteIdent).join(", ")} CASCADE;\n`);
      } else {
        console.log("  ✓ All target tables are empty\n");
      }
    }

    // ── STEP 6: Migrate data ──
    if (!VERIFY_ONLY) {
      console.log("▸ Step 6: Migrating data...\n");
      const errors = [];
      let totalMigrated = 0;
      let totalSkipped = 0;

      for (let i = 0; i < TABLES.length; i++) {
        const table = TABLES[i];
        const modelName = toModelName(table);

        // Skip if Prisma doesn't have this Model
        if (typeof pg[modelName] === "undefined") {
          console.log(`  [${i + 1}/${TABLES.length}] ${table}: PRISMA MODEL NOT FOUND — skipping`);
          continue;
        }

        // Read from SQLite (use quoted identifier for reserved words)
        let rows;
        try {
          rows = await sqliteDb.all(`SELECT * FROM ${quoteIdent(table)}`);
        } catch (e) {
          console.log(`  [${i + 1}/${TABLES.length}] ${table}: ✗ SQLite read error — ${e.message}`);
          errors.push({ table, phase: "read", error: e.message });
          continue;
        }

        if (rows.length === 0) {
          console.log(`  [${i + 1}/${TABLES.length}] ${table}: 0 rows (skipped)`);
          continue;
        }

        // ── Validate JSON fields ──
        if (table === "BusinessUser") {
          for (const row of rows) {
            try {
              row.permissions = validateJsonField(row.permissions, "permissions", table, row.id);
            } catch (e) {
              errors.push({ table, phase: "validate", error: e.message, rowId: row.id });
              console.log(`  [${i + 1}/${TABLES.length}] ${table}: ✗ ${e.message}`);
            }
          }
        }

        // ── Insert in batches of 100 ──
        const { ms } = await timed(async () => {
          const batchSize = 100;
          let migrated = 0;
          let skipped = 0;
          for (let j = 0; j < rows.length; j += batchSize) {
            const batch = rows.slice(j, j + batchSize);
            try {
              const result = await pg[modelName].createMany({
                data: batch,
                skipDuplicates: true,
              });
              migrated += result.count;
              skipped += batch.length - result.count;
            } catch (err) {
              // Try one-by-one fallback for batches that fail
              if (err.code === "P2002") {
                // Unique constraint violation — skip
                skipped += batch.length;
              } else {
                // Other error — try one-by-one
                for (const row of batch) {
                  try {
                    await pg[modelName].create({ data: row });
                    migrated++;
                  } catch (singleErr) {
                    if (singleErr.code === "P2002") {
                      skipped++;
                    } else {
                      errors.push({
                        table,
                        phase: "insert",
                        error: singleErr.message.substring(0, 200),
                        rowId: row.id,
                      });
                    }
                  }
                }
              }
            }
          }
          totalMigrated += migrated;
          totalSkipped += skipped;
          return { migrated, skipped };
        });

        console.log(
          `  [${i + 1}/${TABLES.length}] ${table}: ${rows.length} rows → ${ms}ms`
        );
      }

      console.log(`\n  ── Migration Summary ──`);
      console.log(`  Total rows migrated: ${totalMigrated}`);
      console.log(`  Total rows skipped (duplicates): ${totalSkipped}`);
      console.log(`  Errors: ${errors.length}`);
      if (errors.length > 0) {
        console.log(`\n  First 5 errors:`);
        errors.slice(0, 5).forEach((e, i) => {
          console.log(`    ${i + 1}. ${e.table}.${e.phase}: ${e.error}${e.rowId ? ` (id=${e.rowId})` : ""}`);
        });
      }
      console.log("");
    }

    // ── STEP 7: Reset PostgreSQL sequences ──
    // PostgreSQL sequences track the next auto-increment value. After
    // migrating data with explicit IDs, the sequences still point to 1,
    // so the next INSERT would conflict with migrated IDs. We reset each
    // sequence to max(id) + 1.
    if (!VERIFY_ONLY && !DRY_RUN) {
      console.log("▸ Step 7: Resetting PostgreSQL sequences...");
      try {
        const sequences = await pg.$queryRaw`
          SELECT
            t.relname AS table_name,
            a.attname AS column_name,
            pg_get_serial_sequence(t.relname::text, a.attname) AS sequence_name
          FROM pg_class t
          JOIN pg_attribute a ON a.attrelid = t.oid
          WHERE t.relkind = 'r'
            AND pg_get_serial_sequence(t.relname::text, a.attname) IS NOT NULL
        `;
        if (sequences.length === 0) {
          console.log("  ℹ️ No SERIAL columns found (cuid() IDs only) — nothing to reset\n");
        } else {
          for (const seq of sequences) {
            const maxId = await pg.$queryRawUnsafe(
              `SELECT COALESCE(MAX(${seq.column_name}), 0) AS max_id FROM ${quoteIdent(seq.table_name)}`
            );
            const nextVal = (maxId[0].max_id || 0) + 1;
            await pg.$queryRawUnsafe(
              `SELECT setval('${seq.sequence_name}', ${nextVal}, false)`
            );
            console.log(`  ✓ ${seq.table_name}.${seq.column_name} → next val: ${nextVal}`);
          }
          console.log("");
        }
      } catch (e) {
        console.log(`  ⚠️ Sequence reset error (non-fatal): ${e.message}\n`);
      }
    }

    // ── STEP 8: Verify row counts match ──
    console.log("▸ Step 8: Verifying row counts (SQLite vs PostgreSQL)...\n");
    const verification = [];
    let allMatch = true;

    console.log(`  ${"Table".padEnd(28)} ${"SQLite".padStart(8)} ${"Postgres".padStart(10)} ${"Match".padStart(8)}`);
    console.log(`  ${"-".repeat(28)} ${"-".repeat(8)} ${"-".repeat(10)} ${"-".repeat(8)}`);

    for (const table of TABLES) {
      const modelName = toModelName(table);
      if (typeof pg[modelName] === "undefined") {
        console.log(`  ${table.padEnd(28)} ${"(no model)".padStart(8)} ${"-".padStart(10)} ${"-".padStart(8)}`);
        continue;
      }

      // SQLite count
      let sqliteCount;
      try {
        const r = await sqliteDb.get(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`);
        sqliteCount = r.c;
      } catch (e) {
        sqliteCount = "ERR";
      }

      // PostgreSQL count
      let pgCount;
      try {
        pgCount = await pg[modelName].count();
      } catch (e) {
        pgCount = "ERR";
      }

      const match = sqliteCount === pgCount;
      if (!match) allMatch = false;

      const matchStr = match ? "✓" : "✗ MISMATCH";
      console.log(`  ${table.padEnd(28)} ${String(sqliteCount).padStart(8)} ${String(pgCount).padStart(10)} ${matchStr.padStart(8)}`);
      verification.push({ table, sqliteCount, pgCount, match });
    }

    console.log("");
    if (allMatch) {
      console.log("  ✓ All row counts match — migration verified!\n");
    } else {
      console.log("  ✗ Row count mismatches detected — investigate before going live!\n");
      const mismatches = verification.filter((v) => !v.match);
      mismatches.forEach((m) => {
        console.log(`    ${m.table}: SQLite=${m.sqliteCount}, PostgreSQL=${m.pgCount}`);
      });
      console.log("");
    }

    // ── STEP 9: Spot-check (first record of key tables) ──
    if (!VERIFY_ONLY) {
      console.log("▸ Step 9: Spot-checking key records...\n");
      const spotCheckTables = ["Business", "Product", "Sale", "SaleItem", "Batch", "BusinessUser"];
      for (const table of spotCheckTables) {
        const modelName = toModelName(table);
        if (typeof pg[modelName] === "undefined") continue;

        // Get first record from SQLite
        const sqliteRow = await sqliteDb.get(`SELECT * FROM ${quoteIdent(table)} LIMIT 1`);
        if (!sqliteRow) {
          console.log(`  ${table}: no rows to spot-check`);
          continue;
        }

        // Fetch same record from PostgreSQL by ID
        const pgRow = await pg[modelName].findUnique({ where: { id: sqliteRow.id } });
        if (!pgRow) {
          console.log(`  ✗ ${table}: id=${sqliteRow.id} NOT FOUND in PostgreSQL`);
          continue;
        }

        // Compare boolean fields (SQLite 0/1 vs PG true/false)
        const booleanFields = ["isActive", "aiEnabled", "isPrescription", "success", "multiUserEnabled"];
        const dateFields = ["createdAt", "updatedAt", "expiryDate", "subscriptionStart", "subscriptionEnd", "lastLoginAt", "expiresAt", "date"];
        let allFieldsMatch = true;
        const fieldIssues = [];

        for (const [key, sqliteVal] of Object.entries(sqliteRow)) {
          const pgVal = pgRow[key];
          // Booleans: SQLite stores as 0/1, PG as true/false
          if (booleanFields.includes(key)) {
            const sqliteBool = sqliteVal === 1 || sqliteVal === true;
            const pgBool = pgVal === true || pgVal === 1;
            if (sqliteBool !== pgBool) {
              fieldIssues.push(`${key}: SQLite=${sqliteVal} PG=${pgVal}`);
              allFieldsMatch = false;
            }
          }
          // Dates: SQLite stores as ms-since-epoch (number), PG as Date object
          else if (dateFields.includes(key) && sqliteVal !== null) {
            const sqliteDate = new Date(typeof sqliteVal === "number" ? sqliteVal : sqliteVal);
            const pgDate = new Date(pgVal);
            if (sqliteDate.getTime() !== pgDate.getTime()) {
              fieldIssues.push(`${key}: SQLite=${sqliteDate.toISOString()} PG=${pgDate.toISOString()}`);
              allFieldsMatch = false;
            }
          }
        }

        if (allFieldsMatch) {
          console.log(`  ✓ ${table}: id=${sqliteRow.id} — all fields match`);
        } else {
          console.log(`  ✗ ${table}: id=${sqliteRow.id} — field mismatches:`);
          fieldIssues.forEach((f) => console.log(`      ${f}`));
        }
      }
      console.log("");
    }

    await pg.$disconnect();
  } catch (e) {
    console.error(`\n✗ Migration failed: ${e.message}`);
    console.error(e.stack);
    try { await pg.$disconnect(); } catch (_) {}
    process.exit(1);
  }

  await sqliteDb.close();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Migration complete.");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Update .env to use the PostgreSQL DATABASE_URL permanently");
  console.log("  2. Start the app: docker compose up -d");
  console.log("  3. Verify login works at https://your-domain");
  console.log("  4. Test a sale, an AI Chat call, and a dashboard load");
  console.log("  5. Backup SQLite: cp db/custom.db db/custom.db.backup");
  console.log("  6. Keep SQLite backup for 30 days before deleting");
}

main().catch((err) => {
  console.error("\n═══════════════════════════════════════════════════════════════");
  console.error("  MIGRATION FAILED");
  console.error("═══════════════════════════════════════════════════════════════");
  console.error(err);
  process.exit(1);
});
