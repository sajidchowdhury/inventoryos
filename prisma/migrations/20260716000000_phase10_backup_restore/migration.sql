-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 10: Backup & Restore Tables (super-admin only)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Three new tables for the manual backup/restore feature:
--   1. tenant_backups  — per-business JSON exports (last 7 kept per business)
--   2. system_backups  — full pg_dump snapshots (last 10 kept)
--   3. backup_audit_logs — every backup + restore action (who/when/what/result)
--
-- All operations are SUPER-ADMIN ONLY. No client-facing access.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant backups (per-business JSON exports)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tenant_backups" (
    "id"            TEXT NOT NULL,
    "businessId"    TEXT NOT NULL,
    "fileName"      TEXT NOT NULL,
    "filePath"      TEXT NOT NULL,
    "fileSizeKb"    INTEGER NOT NULL,
    "recordCount"   INTEGER NOT NULL,
    "tableCount"    INTEGER NOT NULL,
    "reason"        TEXT NOT NULL DEFAULT 'manual',
    "createdBy"     TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_backups_pkey" PRIMARY KEY ("id")
);

-- Indexes for tenant backups
CREATE INDEX IF NOT EXISTS "tenant_backups_businessId_createdAt_idx"
    ON "tenant_backups" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "tenant_backups_businessId_reason_idx"
    ON "tenant_backups" ("businessId", "reason");

-- FK to businesses (cascade delete when business is deleted)
ALTER TABLE "tenant_backups"
    ADD CONSTRAINT "tenant_backups_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "businesses" ("id")
    ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- System backups (full pg_dump snapshots)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "system_backups" (
    "id"            TEXT NOT NULL,
    "fileName"      TEXT NOT NULL,
    "filePath"      TEXT NOT NULL,
    "fileSizeKb"    INTEGER NOT NULL,
    "format"        TEXT NOT NULL DEFAULT 'custom',
    "reason"        TEXT NOT NULL DEFAULT 'manual',
    "createdBy"     TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_backups_createdAt_idx"
    ON "system_backups" ("createdAt");
CREATE INDEX IF NOT EXISTS "system_backups_reason_idx"
    ON "system_backups" ("reason");

-- ─────────────────────────────────────────────────────────────────────────────
-- Backup audit log (every backup + restore action)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "backup_audit_logs" (
    "id"            TEXT NOT NULL,
    "action"        TEXT NOT NULL,           -- 'backup' | 'restore'
    "scope"         TEXT NOT NULL,           -- 'tenant' | 'system'
    "businessId"    TEXT,                    -- NULL for system-wide
    "fileName"      TEXT,
    "status"        TEXT NOT NULL,           -- 'success' | 'failed'
    "durationMs"    INTEGER,
    "recordCount"   INTEGER,
    "fileSizeKb"    INTEGER,
    "errorMessage"  TEXT,
    "triggeredBy"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "backup_audit_logs_createdAt_idx"
    ON "backup_audit_logs" ("createdAt");
CREATE INDEX IF NOT EXISTS "backup_audit_logs_scope_action_idx"
    ON "backup_audit_logs" ("scope", "action");
CREATE INDEX IF NOT EXISTS "backup_audit_logs_businessId_idx"
    ON "backup_audit_logs" ("businessId");
