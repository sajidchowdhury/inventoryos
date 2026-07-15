-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Data Integrity & CHECK Constraints
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Add database-level CHECK constraints so the database protects itself
-- even if application validation fails.
--
-- These constraints prevent:
--   - Negative stock, prices, amounts
--   - Discounts exceeding subtotal
--   - Invalid quantities (zero or negative)
--   - Negative warranty months
--   - Invalid payment amounts
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. CCTV Products ──
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_stock_non_negative" CHECK ("stock" >= 0);
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_cost_price_non_negative" CHECK ("costPrice" >= 0);
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_sell_price_non_negative" CHECK ("sellPrice" >= 0);
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_min_stock_non_negative" CHECK ("minStock" >= 0);
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_warranty_non_negative" CHECK ("warrantyMonths" >= 0);

-- ── 2. CCTV Serial Items ──
ALTER TABLE "cctv_serial_items" ADD CONSTRAINT "cctv_serial_items_cost_non_negative" CHECK ("costPrice" >= 0);

-- ── 3. CCTV Customers ──
-- openingBalance can be negative (customer may have advance/credit)

-- ── 4. CCTV Suppliers ──
-- openingBalance can be negative (we may have advance with supplier)

-- ── 5. CCTV Purchases ──
ALTER TABLE "cctv_purchases" ADD CONSTRAINT "cctv_purchases_total_non_negative" CHECK ("totalAmount" >= 0);
ALTER TABLE "cctv_purchases" ADD CONSTRAINT "cctv_purchases_paid_non_negative" CHECK ("paidAmount" >= 0);
ALTER TABLE "cctv_purchases" ADD CONSTRAINT "cctv_purchases_due_non_negative" CHECK ("dueAmount" >= 0);

-- ── 6. CCTV Purchase Items ──
ALTER TABLE "cctv_purchase_items" ADD CONSTRAINT "cctv_purchase_items_qty_positive" CHECK ("quantity" > 0);
ALTER TABLE "cctv_purchase_items" ADD CONSTRAINT "cctv_purchase_items_cost_non_negative" CHECK ("costPrice" >= 0);
ALTER TABLE "cctv_purchase_items" ADD CONSTRAINT "cctv_purchase_items_sell_non_negative" CHECK ("sellPrice" >= 0);

-- ── 7. CCTV Sales ──
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_subtotal_non_negative" CHECK ("subtotal" >= 0);
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_discount_non_negative" CHECK ("discount" >= 0);
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_discount_le_subtotal" CHECK ("discount" <= "subtotal");
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_total_non_negative" CHECK ("totalAmount" >= 0);
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_paid_non_negative" CHECK ("paidAmount" >= 0);
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_due_non_negative" CHECK ("dueAmount" >= 0);

-- ── 8. CCTV Sale Items ──
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_qty_positive" CHECK ("quantity" > 0);
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_sell_non_negative" CHECK ("sellPrice" >= 0);
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_cost_non_negative" CHECK ("costPrice" >= 0);
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_discount_non_negative" CHECK ("discount" >= 0);

-- ── 9. CCTV Payments ──
ALTER TABLE "cctv_payments" ADD CONSTRAINT "cctv_payments_amount_positive" CHECK ("amount" > 0);

-- ── 10. CCTV Expenses ──
ALTER TABLE "cctv_expenses" ADD CONSTRAINT "cctv_expenses_amount_positive" CHECK ("amount" > 0);

-- ── 11. CCTV Returns ──
ALTER TABLE "cctv_returns" ADD CONSTRAINT "cctv_returns_total_non_negative" CHECK ("totalAmount" >= 0);

-- ── 12. CCTV Return Items ──
ALTER TABLE "cctv_return_items" ADD CONSTRAINT "cctv_return_items_qty_positive" CHECK ("quantity" > 0);
ALTER TABLE "cctv_return_items" ADD CONSTRAINT "cctv_return_items_sell_non_negative" CHECK ("sellPrice" >= 0);

-- ── 13. CCTV Repairs ──
ALTER TABLE "cctv_repairs" ADD CONSTRAINT "cctv_repairs_cost_non_negative" CHECK ("repairCost" >= 0);

-- ── 14. CCTV Estimates ──
ALTER TABLE "cctv_estimates" ADD CONSTRAINT "cctv_estimates_total_non_negative" CHECK ("totalAmount" >= 0);

-- ── 15. CCTV Estimate Items ──
ALTER TABLE "cctv_estimate_items" ADD CONSTRAINT "cctv_estimate_items_qty_positive" CHECK ("quantity" > 0);
ALTER TABLE "cctv_estimate_items" ADD CONSTRAINT "cctv_estimate_items_price_non_negative" CHECK ("unitPrice" >= 0);

-- ── 16. CCTV Supplier Replacements ──
ALTER TABLE "cctv_supplier_replacements" ADD CONSTRAINT "cctv_replacements_qty_positive" CHECK ("quantity" > 0);
