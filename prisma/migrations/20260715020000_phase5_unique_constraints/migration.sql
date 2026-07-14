-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Unique Constraints & Invoice Numbers
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Prevent duplicate serial numbers, invoice numbers, and estimate
-- numbers within a business. These are database-level constraints that
-- protect against race conditions even if application validation fails.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Unique serial numbers per business (fixes C-3) ──
-- Two products in the same business cannot have the same serial number.
-- This is a hard constraint — the database rejects duplicates.
CREATE UNIQUE INDEX "cctv_serial_items_businessId_serialNumber_key"
  ON "cctv_serial_items" ("businessId", "serialNumber");

-- ── 2. Unique invoice numbers per business (fixes C-4) ──
-- Two sales in the same business cannot have the same invoice number.
-- Uses partial index: only enforces uniqueness when invoiceNo IS NOT NULL
-- (walk-in sales without invoice numbers are allowed).
CREATE UNIQUE INDEX "cctv_sales_businessId_invoiceNo_key"
  ON "cctv_sales" ("businessId", "invoiceNo")
  WHERE "invoiceNo" IS NOT NULL;

-- ── 3. Unique estimate numbers per business ──
-- Two estimates in the same business cannot have the same estimate number.
CREATE UNIQUE INDEX "cctv_estimates_businessId_estimateNo_key"
  ON "cctv_estimates" ("businessId", "estimateNo")
  WHERE "estimateNo" IS NOT NULL;
