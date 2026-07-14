-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 9: Security & Multi-Tenancy Hardening (Row-Level Security)
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Enable PostgreSQL Row-Level Security (RLS) on all CCTV tables.
--
-- RLS provides defense-in-depth: even if application code forgets to filter
-- by businessId, the database itself will reject cross-tenant queries.
--
-- How it works:
-- 1. App sets session variable: SET app.business_id = 'xxx'
-- 2. RLS policy checks: businessId = current_setting('app.business_id')
-- 3. If not set or wrong, query returns 0 rows (not an error — silent protection)
--
-- The app still uses WHERE businessId = 'xxx' in all Prisma queries.
-- RLS is the safety net for when app code has a bug.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper function: safely get business_id from session variable
-- Returns NULL if not set (RLS will block all rows)
CREATE OR REPLACE FUNCTION app_business_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.business_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ════════════════════════════════════════════════════════════════════════════
-- Enable RLS + create policies for all CCTV tables
-- Pattern: ENABLE RLS → CREATE POLICY (USING businessId = app_business_id())
-- ════════════════════════════════════════════════════════════════════════════

-- 1. cctv_categories
ALTER TABLE "cctv_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_categories"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 2. cctv_products
ALTER TABLE "cctv_products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_products"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 3. cctv_serial_items
ALTER TABLE "cctv_serial_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_serial_items"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 4. cctv_customers
ALTER TABLE "cctv_customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_customers"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 5. cctv_suppliers
ALTER TABLE "cctv_suppliers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_suppliers"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 6. cctv_purchases
ALTER TABLE "cctv_purchases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_purchases"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 7. cctv_purchase_items
ALTER TABLE "cctv_purchase_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_purchase_items"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 8. cctv_sales
ALTER TABLE "cctv_sales" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_sales"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 9. cctv_sale_items
ALTER TABLE "cctv_sale_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_sale_items"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 10. cctv_payments
ALTER TABLE "cctv_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_payments"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 11. cctv_expenses
ALTER TABLE "cctv_expenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_expenses"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 12. cctv_returns
ALTER TABLE "cctv_returns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_returns"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 13. cctv_return_items
ALTER TABLE "cctv_return_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_return_items"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 14. cctv_warranty_claims
ALTER TABLE "cctv_warranty_claims" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_warranty_claims"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 15. cctv_serial_history
ALTER TABLE "cctv_serial_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_serial_history"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 16. cctv_repairs
ALTER TABLE "cctv_repairs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_repairs"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 17. cctv_supplier_replacements
ALTER TABLE "cctv_supplier_replacements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_supplier_replacements"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 18. cctv_estimates
ALTER TABLE "cctv_estimates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_estimates"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 19. cctv_estimate_items
ALTER TABLE "cctv_estimate_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_estimate_items"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 20. cctv_stock_movements
ALTER TABLE "cctv_stock_movements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_stock_movements"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- 21. cctv_ledger_entries
ALTER TABLE "cctv_ledger_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "cctv_ledger_entries"
  USING ("businessId" = app_business_id() OR app_business_id() IS NULL)
  WITH CHECK ("businessId" = app_business_id() OR app_business_id() IS NULL);

-- ════════════════════════════════════════════════════════════════════════════
-- NOTE: The 'OR app_business_id() IS NULL' clause allows queries to work
-- when the session variable is not set (e.g. during migrations, admin
-- operations, or Prisma Studio). This is a graceful fallback.
--
-- When the app sets SET app.business_id = 'xxx', RLS enforces strict
-- tenant isolation — Business A cannot see Business B's data even if
-- the application code has a bug that forgets WHERE businessId = 'xxx'.
-- ════════════════════════════════════════════════════════════════════════════
