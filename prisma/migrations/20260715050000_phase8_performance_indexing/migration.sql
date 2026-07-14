-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 8: Performance & Indexing
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Add composite indexes for the most common query patterns.
-- These indexes speed up date-range reports, status filtering, and
-- multi-tenant queries at scale (1M+ rows).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Serial Items: filter by business + status (e.g. "show all IN_STOCK") ──
CREATE INDEX "cctv_serial_items_businessId_status_idx"
  ON "cctv_serial_items" ("businessId", "status");

-- ── 2. Sales: date-range reports (e.g. "sales from Jan 1 to Jan 31") ──
CREATE INDEX "cctv_sales_businessId_saleDate_idx"
  ON "cctv_sales" ("businessId", "saleDate");

-- ── 3. Purchases: date-range reports ──
CREATE INDEX "cctv_purchases_businessId_purchaseDate_idx"
  ON "cctv_purchases" ("businessId", "purchaseDate");

-- ── 4. Payments: cash book by date + payment type filtering ──
CREATE INDEX "cctv_payments_businessId_paymentDate_idx"
  ON "cctv_payments" ("businessId", "paymentDate");

CREATE INDEX "cctv_payments_businessId_type_idx"
  ON "cctv_payments" ("businessId", "type");

-- ── 5. Repairs: filter by business + status (e.g. "show all received repairs") ──
CREATE INDEX "cctv_repairs_businessId_status_idx"
  ON "cctv_repairs" ("businessId", "status");
