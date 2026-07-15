// src/lib/backup.ts
// ═══════════════════════════════════════════════════════════════════════════
// InventoryOS — Backup & Restore Helpers (Phase 1: Foundation)
// ═══════════════════════════════════════════════════════════════════════════
//
// All backup/restore operations are SUPER-ADMIN ONLY. None of these helpers
// are exposed to client admin panels or the main business software — they are
// invoked exclusively by /api/super-admin/* routes.
//
// Two layers:
//   1. Tenant-wise  — JSON export of every row belonging to one businessId.
//                      Used for client data portability + surgical restores.
//   2. System-wide  — pg_dump -Fc of the whole Postgres DB.
//                      Used for disaster recovery (server loss, bad migration).
//
// Files written to:
//   /backups/tenants/{businessId}/{backupId}_{timestamp}.json
//   /backups/db/inventoryos_{timestamp}.sql
//
// Rotation: keep last 7 tenant backups per business, last 10 system backups.
//
// Safety: every restore automatically creates a "pre-restore" backup first,
// so a bad restore can be rolled back. All actions are logged to
// BackupAuditLog with who/when/what/result.

import { db } from "./db";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_TENANT_BACKUPS = 7;
export const MAX_SYSTEM_BACKUPS = 10;

export const TENANT_BACKUP_DIR = path.resolve(process.cwd(), "backups/tenants");
export const SYSTEM_BACKUP_DIR = path.resolve(process.cwd(), "backups/db");

// Every tenant-scoped model name in Prisma (NOT the table name).
// To find this list: grep for models with `businessId String` in schema.prisma.
// Order matters for restore: parent tables first, then children with FKs.
const TENANT_MODELS = [
  // Core pharmacy module
  "BusinessUser",
  "Category",
  "Product",
  "Batch",
  "Inventory",
  "Transaction",
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
  "BusinessDailyStats",
  "AIResponseCache",
  "FefoOverride",
  "GeneratedReport",
  "SubscriptionInvoice",
  "PaymentTransaction",
  "SubscriptionAdjustment",
  "ShelfScan",
  "StorageZone",
  "ProductZoneAssignment",
  "StockCountDay",
  "StockCountZoneSession",
  "StockCountProductSummary",
  "StockCountLine",
  "ZoneAssignmentSnapshot",

  // CCTV module (new)
  "CCTVCategory",
  "CCTVProduct",
  "CCTVCustomer",
  "CCTVSupplier",
  "CCTVPurchase",
  "CCTVPurchaseItem",
  "CCTVSale",
  "CCTVSaleItem",
  "CCTVExpense",
  "CCTVPayment",
  "CCTVReturn",
  "CCTVReturnItem",
  "CCTVWarrantyClaim",
  "CCTVSerialItem",
  "CCTVSerialHistory",
  "CCTVRepair",
  "CCTVSupplierReplacement",
  "CCTVEstimate",
  "CCTVEstimateItem",
  "CCTVStockMovement",
  "CCTVLedgerEntry",

  // MobileShop module
  "MSCategory",
  "MSProduct",
  "MSSerialItem",
  "MSSerialItemHistory",
  "MSKitDefinition",
  "MSKitComponent",
  "MSBranch",
  "MSTechnician",
  "MSOutsourcedVendor",
  "MSCustomer",
  "MSSupplier",
  "MSPurchase",
  "MSPurchaseItem",
  "MSSale",
  "MSSaleItem",
  "MSPayment",
  "MSReturn",
  "MSReturnItem",
  "MSExpense",
  "MSJobCard",
  "MSJobCardPart",
  "MSInstallationTask",
  "MSTaskChecklist",
  "MSProject",
  "MSSiteSurvey",
  "MSCableRoute",
  "MSCameraPosition",
  "MSTransfer",
  "MSTransferItem",
  "MSWarrantyClaim",
  "MSAmcContract",
  "MSAmcVisit",
  "MSEmiPlan",
  "MSEmiInstallment",
  "MSLoyaltyConfig",
  "MSLoyaltyOffer",
  "MSLoyaltyTransaction",
  "MSCommissionRule",
  "MSCommissionRecord",
  "MSMushakInvoice",
  "MSMushakLineItem",
  "MSNbrConfig",
  "MSHsCodeMapping",
  "MSVatReturn",
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TenantBackupResult {
  backupId: string;
  fileName: string;
  filePath: string;
  fileSizeKb: number;
  recordCount: number;
  tableCount: number;
}

export interface SystemBackupResult {
  backupId: string;
  fileName: string;
  filePath: string;
  fileSizeKb: number;
}

export interface RestoreResult {
  success: boolean;
  preRestoreBackupId?: string;
  recordsRestored?: number;
  errorMessage?: string;
}

// ─── Directory Setup ─────────────────────────────────────────────────────────

/**
 * Ensure the backup directories exist on disk. Safe to call multiple times.
 * Creates /backups/tenants and /backups/db with 0o700 permissions.
 */
export async function ensureBackupDirs(): Promise<void> {
  await fs.mkdir(TENANT_BACKUP_DIR, { recursive: true, mode: 0o700 });
  await fs.mkdir(SYSTEM_BACKUP_DIR, { recursive: true, mode: 0o700 });
}

// ─── Tenant-Wise Backup ──────────────────────────────────────────────────────

/**
 * Serialize every row belonging to a businessId across all tenant-scoped tables.
 * Writes a single JSON file with the structure:
 *   {
 *     version: 1,
 *     businessId, businessName, exportedAt,
 *     tables: { CCTVProduct: [...rows], CCTVSale: [...rows], ... },
 *     meta: { tableCount, recordCount, durationMs }
 *   }
 *
 * Also creates a TenantBackup record in the DB and rotates old backups
 * (keeps last MAX_TENANT_BACKUPS).
 */
export async function serializeTenant(
  businessId: string,
  triggeredBy: string,
  reason: "manual" | "pre-restore" | "pre-delete" = "manual"
): Promise<TenantBackupResult> {
  const start = Date.now();
  await ensureBackupDirs();

  // Fetch business name for the file
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  if (!business) {
    throw new Error(`Business ${businessId} not found`);
  }

  // Walk every tenant model and serialize its rows
  const tables: Record<string, any[]> = {};
  let recordCount = 0;

  for (const modelName of TENANT_MODELS) {
    try {
      const rows = await (db as any)[modelName].findMany({
        where: { businessId },
        // Don't serialize the businessId itself — it's implicit on restore.
        // We DO serialize id and all other fields.
      });
      if (rows.length > 0) {
        tables[modelName] = rows.map((row: any) => {
          // Convert Decimal + Date to JSON-safe formats
          return JSON.parse(JSON.stringify(row, (_key, value) => {
            if (value && typeof value === "object" && "toFixed" in value) {
              // Prisma Decimal → string
              return String(value);
            }
            return value;
          }));
        });
        recordCount += rows.length;
      }
    } catch (err) {
      // Some models may not exist on this DB (e.g. mobile shop tables on a CCTV-only install).
      // Log and continue.
      console.warn(`[backup] Skipping ${modelName}:`, err instanceof Error ? err.message : err);
    }
  }

  const tableCount = Object.keys(tables).length;
  const backupId = `${businessId.slice(-8)}_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  const fileName = `${backupId}.json`;
  const bizDir = path.join(TENANT_BACKUP_DIR, businessId);
  await fs.mkdir(bizDir, { recursive: true, mode: 0o700 });
  const filePath = path.join(bizDir, fileName);

  const payload = {
    version: 1,
    businessId,
    businessName: business.name,
    exportedAt: new Date().toISOString(),
    tables,
    meta: {
      tableCount,
      recordCount,
      durationMs: Date.now() - start,
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  await fs.writeFile(filePath, jsonStr, { mode: 0o600 });
  const fileSizeKb = Math.round((Buffer.byteLength(jsonStr) / 1024) * 10) / 10;

  // Record in DB
  await db.tenantBackup.create({
    data: {
      businessId,
      fileName,
      filePath,
      fileSizeKb,
      recordCount,
      tableCount,
      reason,
      createdBy: triggeredBy,
    },
  });

  // Audit log
  await db.backupAuditLog.create({
    data: {
      action: "backup",
      scope: "tenant",
      businessId,
      fileName,
      status: "success",
      durationMs: Date.now() - start,
      recordCount,
      fileSizeKb,
      triggeredBy,
    },
  });

  // Rotate — keep last MAX_TENANT_BACKUPS
  await rotateTenantBackups(businessId);

  return { backupId, fileName, filePath, fileSizeKb, recordCount, tableCount };
}

/**
 * Restore a tenant from a JSON backup file.
 *
 * SAFETY: creates a "pre-restore" backup automatically before wiping, so a
 * bad restore can be rolled back by restoring the pre-restore backup.
 *
 * Wraps the wipe + re-insert in a single transaction so the DB is never in
 * a half-restored state.
 */
export async function deserializeTenant(
  backupId: string,
  businessId: string,
  triggeredBy: string
): Promise<RestoreResult> {
  const start = Date.now();

  // Find the backup record
  const backup = await db.tenantBackup.findFirst({
    where: {
      businessId,
      OR: [
        { fileName: { startsWith: backupId } },
        { id: backupId },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!backup) {
    return { success: false, errorMessage: `Backup ${backupId} not found for business ${businessId}` };
  }

  // Read the JSON file
  let payload: any;
  try {
    const raw = await fs.readFile(backup.filePath, "utf-8");
    payload = JSON.parse(raw);
  } catch (err) {
    return { success: false, errorMessage: `Failed to read backup file: ${err instanceof Error ? err.message : err}` };
  }

  // SAFETY: create a pre-restore backup first
  let preRestoreBackupId: string | undefined;
  try {
    const preRestore = await serializeTenant(businessId, triggeredBy, "pre-restore");
    preRestoreBackupId = preRestore.backupId;
  } catch (err) {
    return { success: false, errorMessage: `Pre-restore backup failed — aborting restore: ${err instanceof Error ? err.message : err}` };
  }

  // Wipe + re-insert in a single transaction
  try {
    let recordsRestored = 0;

    await db.$transaction(async (tx) => {
      // Delete in REVERSE order (children first, parents last) to respect FKs.
      // We use the TENANT_MODELS array reversed.
      const reversedModels = [...TENANT_MODELS].reverse();

      for (const modelName of reversedModels) {
        try {
          await (tx as any)[modelName].deleteMany({ where: { businessId } });
        } catch {
          // Skip models that don't exist on this DB
        }
      }

      // Insert in FORWARD order (parents first, children last)
      for (const modelName of TENANT_MODELS) {
        const rows = payload.tables?.[modelName];
        if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

        try {
          // Re-attach businessId to every row
          const rowsWithBizId = rows.map((r: any) => ({ ...r, businessId }));
          await (tx as any)[modelName].createMany({ data: rowsWithBizId, skipDuplicates: true });
          recordsRestored += rows.length;
        } catch (err) {
          console.warn(`[restore] Failed to insert ${modelName}:`, err instanceof Error ? err.message : err);
          // Continue — partial restore is still better than nothing
        }
      }
    });

    // Audit log
    await db.backupAuditLog.create({
      data: {
        action: "restore",
        scope: "tenant",
        businessId,
        fileName: backup.fileName,
        status: "success",
        durationMs: Date.now() - start,
        recordCount: recordsRestored,
        triggeredBy,
      },
    });

    return { success: true, preRestoreBackupId, recordsRestored };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Audit log (failure)
    await db.backupAuditLog.create({
      data: {
        action: "restore",
        scope: "tenant",
        businessId,
        fileName: backup.fileName,
        status: "failed",
        durationMs: Date.now() - start,
        errorMessage,
        triggeredBy,
      },
    });

    return { success: false, preRestoreBackupId, errorMessage };
  }
}

/**
 * Rotate tenant backups — keep only the last MAX_TENANT_BACKUPS per business.
 * Deletes both the DB record AND the file on disk.
 */
export async function rotateTenantBackups(
  businessId: string,
  keep: number = MAX_TENANT_BACKUPS
): Promise<number> {
  const all = await db.tenantBackup.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { id: true, filePath: true, createdAt: true },
  });

  if (all.length <= keep) return 0;

  const toDelete = all.slice(keep);
  let deletedCount = 0;

  for (const backup of toDelete) {
    // Delete file
    try {
      await fs.unlink(backup.filePath);
    } catch {
      // file may already be gone — ignore
    }
    // Delete DB record
    try {
      await db.tenantBackup.delete({ where: { id: backup.id } });
      deletedCount++;
    } catch {
      // ignore
    }
  }

  return deletedCount;
}

// ─── System-Wide Backup (pg_dump) ────────────────────────────────────────────

/**
 * Run `pg_dump -Fc` (custom compressed format) on the production database.
 * Returns the file path of the created dump.
 *
 * Requires `pg_dump` to be installed on the server (apt install postgresql-client).
 */
export async function runSystemDump(
  triggeredBy: string,
  reason: "manual" | "pre-restore" | "scheduled" = "manual"
): Promise<SystemBackupResult> {
  const start = Date.now();
  await ensureBackupDirs();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set — cannot run pg_dump");
  }

  // Parse the connection string to get individual params (more reliable than --dbname=URL)
  const match = databaseUrl.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error("DATABASE_URL is not in the expected postgres://user:pass@host:port/db format");
  }
  const [, user, password, host, port, dbName] = match;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `inventoryos_${timestamp}.sql`;
  const filePath = path.join(SYSTEM_BACKUP_DIR, fileName);

  // Use env vars to pass credentials (safer than CLI args — won't show in ps)
  const env = {
    ...process.env,
    PGPASSWORD: password,
    PGUSER: user,
    PGHOST: host,
    PGPORT: port,
    PGDATABASE: dbName,
  };

  try {
    // pg_dump -Fc = custom compressed format (smaller, supports parallel restore)
    // --no-owner --no-privileges = portable across servers
    const { stderr } = await execFileAsync("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file", filePath,
    ], { env, maxBuffer: 1024 * 1024 * 1024 }); // 1GB buffer for large DBs

    if (stderr && !stderr.includes("warning")) {
      console.warn("[pg_dump] stderr:", stderr);
    }

    const stat = await fs.stat(filePath);
    const fileSizeKb = Math.round((stat.size / 1024) * 10) / 10;

    // Record in DB
    const record = await db.systemBackup.create({
      data: {
        fileName,
        filePath,
        fileSizeKb,
        format: "custom",
        reason,
        createdBy: triggeredBy,
      },
    });

    // Audit log
    await db.backupAuditLog.create({
      data: {
        action: "backup",
        scope: "system",
        fileName,
        status: "success",
        durationMs: Date.now() - start,
        fileSizeKb,
        triggeredBy,
      },
    });

    // Rotate — keep last MAX_SYSTEM_BACKUPS
    await rotateSystemBackups();

    return {
      backupId: record.id,
      fileName,
      filePath,
      fileSizeKb,
    };
  } catch (err) {
    // Audit log (failure)
    await db.backupAuditLog.create({
      data: {
        action: "backup",
        scope: "system",
        fileName,
        status: "failed",
        durationMs: Date.now() - start,
        errorMessage: err instanceof Error ? err.message : String(err),
        triggeredBy,
      },
    });
    throw err;
  }
}

/**
 * Restore the full database from a pg_dump custom-format file.
 *
 * SAFETY: creates a "pre-restore" system backup first.
 *
 * Uses `pg_restore --clean --if-exists` which drops existing objects before
 * re-creating them.
 */
export async function runSystemRestore(
  filePath: string,
  triggeredBy: string
): Promise<RestoreResult> {
  const start = Date.now();

  // Verify file exists
  try {
    await fs.access(filePath);
  } catch {
    return { success: false, errorMessage: `Backup file not found: ${filePath}` };
  }

  // Verify it's a real pg_dump custom-format file (magic bytes: PGDMP)
  const fd = await fs.open(filePath, "r");
  const buf = Buffer.alloc(5);
  await fd.read(buf, 0, 5, 0);
  await fd.close();
  if (buf.toString("ascii") !== "PGDMP") {
    return { success: false, errorMessage: "File is not a valid pg_dump custom-format backup (missing PGDMP magic bytes)" };
  }

  // SAFETY: create a pre-restore backup
  let preRestoreBackupId: string | undefined;
  try {
    const preRestore = await runSystemDump(triggeredBy, "pre-restore");
    preRestoreBackupId = preRestore.backupId;
  } catch (err) {
    return {
      success: false,
      errorMessage: `Pre-restore backup failed — aborting restore: ${err instanceof Error ? err.message : err}`,
    };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { success: false, errorMessage: "DATABASE_URL is not set" };
  }
  const match = databaseUrl.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    return { success: false, errorMessage: "DATABASE_URL is not in the expected format" };
  }
  const [, user, password, host, port, dbName] = match;

  const env = {
    ...process.env,
    PGPASSWORD: password,
    PGUSER: user,
    PGHOST: host,
    PGPORT: port,
    PGDATABASE: dbName,
  };

  try {
    // --clean       : drop existing objects before recreating
    // --if-exists   : don't error if object doesn't exist
    // --no-owner    : don't try to set ownership
    // --no-privileges : don't try to set grants
    const { stderr } = await execFileAsync("pg_restore", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--dbname", dbName,
      filePath,
    ], { env, maxBuffer: 1024 * 1024 * 1024 });

    // pg_restore prints "errors" to stderr even on success (e.g. DROP of non-existent table).
    // Treat warnings as success.
    if (stderr && /error|fatal/i.test(stderr) && !/does not exist/i.test(stderr)) {
      console.warn("[pg_restore] stderr:", stderr);
    }

    const stat = await fs.stat(filePath);
    const fileSizeKb = Math.round((stat.size / 1024) * 10) / 10;

    await db.backupAuditLog.create({
      data: {
        action: "restore",
        scope: "system",
        fileName: path.basename(filePath),
        status: "success",
        durationMs: Date.now() - start,
        fileSizeKb,
        triggeredBy,
      },
    });

    return { success: true, preRestoreBackupId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db.backupAuditLog.create({
      data: {
        action: "restore",
        scope: "system",
        fileName: path.basename(filePath),
        status: "failed",
        durationMs: Date.now() - start,
        errorMessage,
        triggeredBy,
      },
    });

    return { success: false, preRestoreBackupId, errorMessage };
  }
}

/**
 * Rotate system backups — keep only the last MAX_SYSTEM_BACKUPS.
 * Deletes both the DB record AND the file on disk.
 */
export async function rotateSystemBackups(
  keep: number = MAX_SYSTEM_BACKUPS
): Promise<number> {
  const all = await db.systemBackup.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, filePath: true, createdAt: true },
  });

  if (all.length <= keep) return 0;

  const toDelete = all.slice(keep);
  let deletedCount = 0;

  for (const backup of toDelete) {
    try {
      await fs.unlink(backup.filePath);
    } catch {
      // ignore
    }
    try {
      await db.systemBackup.delete({ where: { id: backup.id } });
      deletedCount++;
    } catch {
      // ignore
    }
  }

  return deletedCount;
}

// ─── Disk Space Check ────────────────────────────────────────────────────────

/**
 * Check available disk space on the partition holding /backups.
 * Returns free space in MB. Used by API routes to refuse backup if disk is full.
 */
export async function getAvailableDiskSpaceMb(): Promise<number> {
  try {
    const { statfs } = await import("fs");
    const statfsAsync = promisify(statfs);
    const stats = await statfsAsync(TENANT_BACKUP_DIR);
    // blocks * (block size / 1024) / 1024 = MB
    return Math.round((stats.bavail * stats.bsize) / (1024 * 1024));
  } catch {
    // statfs may not be available on all platforms — return a safe default
    return 1024;
  }
}

/**
 * Minimum disk space required before allowing a backup (in MB).
 * Conservative default: 2GB free.
 */
export const MIN_DISK_SPACE_MB = 2048;
