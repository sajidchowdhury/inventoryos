-- ── SUB-3: Set Pro tier monthly price to ৳500 ──
--
-- Background: the user's intended subscription model is ৳500/month for
-- the Pro tier. The code previously had ৳800/month (Pro) and ৳1500/month
-- (Pro AI) — see docs/STOCK_CALCULATION_BUGS.md Section 13, SUB-3.
--
-- This migration updates the `payment_config` table's `proMonthly` and
-- `proAnnual` columns for any existing row. If no row exists yet, the
-- @default() on the schema (also updated to 500 / 5000) will be used
-- when the row is first created.
--
-- Annual price follows the "pay 10 months, get 12" rule: 500 × 10 = 5000.
--
-- Pro AI prices (৳1500/month, ৳15000/year) are unchanged.

-- Update existing row(s). Use UPDATE ... WHERE id = 'default' so we only
-- touch the singleton. If the row doesn't exist, this is a no-op.
UPDATE "payment_config"
SET "proMonthly" = 500,
    "proAnnual"  = 5000
WHERE "id" = 'default';
