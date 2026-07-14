-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 7: Double-Entry Ledger System
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Create cctv_ledger_entries table for double-entry accounting.
-- Every financial transaction creates balanced debit + credit entries.
-- Sum of all debits = sum of all credits per business (trial balance).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE "cctv_ledger_entries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "description" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cctv_ledger_entries_amount_positive" CHECK ("amount" >= 0),
    CONSTRAINT "cctv_ledger_entries_type_valid" CHECK ("entryType" IN ('DEBIT', 'CREDIT'))
);

CREATE INDEX "cctv_ledger_entries_businessId_idx" ON "cctv_ledger_entries"("businessId");
CREATE INDEX "cctv_ledger_entries_accountId_idx" ON "cctv_ledger_entries"("accountId");
CREATE INDEX "cctv_ledger_entries_businessId_accountId_idx" ON "cctv_ledger_entries"("businessId", "accountId");
CREATE INDEX "cctv_ledger_entries_referenceId_idx" ON "cctv_ledger_entries"("referenceId");
CREATE INDEX "cctv_ledger_entries_createdAt_idx" ON "cctv_ledger_entries"("createdAt");

ALTER TABLE "cctv_ledger_entries"
  ADD CONSTRAINT "cctv_ledger_entries_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE;
