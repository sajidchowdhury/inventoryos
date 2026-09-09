-- ── EX-2: Add paymentMethod column to CCTVExpense ──
--
-- Previously, expenses had no paymentMethod field. The POST endpoint
-- accepted paymentMethod and used it for the ledger entry (DEBIT
-- expense, CREDIT cash/bank/bkash/nagad), but the UI never sent it,
-- and the column didn't exist on the table — so the method was lost
-- after the ledger entry was written. The expense record itself had
-- no way to show which payment method was used.
--
-- This migration adds the paymentMethod column with a default of
-- 'cash' (matching the existing behavior where all expenses default
-- to cash).

ALTER TABLE "cctv_expenses" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cash';
