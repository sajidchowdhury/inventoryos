-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Money Type Migration (Float → Decimal)
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Change all monetary fields from FLOAT (imprecise) to
-- NUMERIC(12,2) (exact decimal with 2 decimal places).
--
-- Float arithmetic produces rounding errors: 0.1 + 0.2 = 0.30000000000000004
-- Decimal stores exact values: 0.1 + 0.2 = 0.30
--
-- This migration is safe — PostgreSQL can cast FLOAT to NUMERIC without data loss.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. CCTV Products ──
ALTER TABLE "cctv_products" ALTER COLUMN "costPrice" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_products" ALTER COLUMN "sellPrice" TYPE DECIMAL(12,2);

-- ── 2. CCTV Serial Items ──
ALTER TABLE "cctv_serial_items" ALTER COLUMN "costPrice" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_serial_items" ALTER COLUMN "sellPrice" TYPE DECIMAL(12,2);

-- ── 3. CCTV Customers ──
ALTER TABLE "cctv_customers" ALTER COLUMN "openingBalance" TYPE DECIMAL(12,2);

-- ── 4. CCTV Suppliers ──
ALTER TABLE "cctv_suppliers" ALTER COLUMN "openingBalance" TYPE DECIMAL(12,2);

-- ── 5. CCTV Purchases ──
ALTER TABLE "cctv_purchases" ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_purchases" ALTER COLUMN "paidAmount" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_purchases" ALTER COLUMN "dueAmount" TYPE DECIMAL(12,2);

-- ── 6. CCTV Purchase Items ──
ALTER TABLE "cctv_purchase_items" ALTER COLUMN "costPrice" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_purchase_items" ALTER COLUMN "sellPrice" TYPE DECIMAL(12,2);

-- ── 7. CCTV Sales ──
ALTER TABLE "cctv_sales" ALTER COLUMN "subtotal" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_sales" ALTER COLUMN "discount" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_sales" ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_sales" ALTER COLUMN "paidAmount" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_sales" ALTER COLUMN "dueAmount" TYPE DECIMAL(12,2);

-- ── 8. CCTV Sale Items ──
ALTER TABLE "cctv_sale_items" ALTER COLUMN "sellPrice" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_sale_items" ALTER COLUMN "costPrice" TYPE DECIMAL(12,2);
ALTER TABLE "cctv_sale_items" ALTER COLUMN "discount" TYPE DECIMAL(12,2);

-- ── 9. CCTV Payments ──
ALTER TABLE "cctv_payments" ALTER COLUMN "amount" TYPE DECIMAL(12,2);

-- ── 10. CCTV Expenses ──
ALTER TABLE "cctv_expenses" ALTER COLUMN "amount" TYPE DECIMAL(12,2);

-- ── 11. CCTV Returns ──
ALTER TABLE "cctv_returns" ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2);

-- ── 12. CCTV Return Items ──
ALTER TABLE "cctv_return_items" ALTER COLUMN "sellPrice" TYPE DECIMAL(12,2);

-- ── 13. CCTV Repairs ──
ALTER TABLE "cctv_repairs" ALTER COLUMN "repairCost" TYPE DECIMAL(12,2);

-- ── 14. CCTV Estimates ──
ALTER TABLE "cctv_estimates" ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2);

-- ── 15. CCTV Estimate Items ──
ALTER TABLE "cctv_estimate_items" ALTER COLUMN "unitPrice" TYPE DECIMAL(12,2);
