-- ── ST-9: Add activePaymentMethods to businesses ──
--
-- Per-business payment methods config. The PaymentMethodSelector now has
-- 6 methods (cash/bank/bkash/nagad/card/cheque per PM-7). Previously every
-- shop saw all 6 methods at the POS, even if they don't use bKash or card.
-- Now: a shop owner can configure which methods are active for their
-- business from Settings → Profile, and the POS / payment forms will
-- only show the active ones.
--
-- Stored as a comma-separated string (e.g. "cash,bank,bkash"). Default
-- = all 6 methods (backward compat — existing shops see no change until
-- they explicitly disable a method).

ALTER TABLE "businesses" ADD COLUMN "activePaymentMethods" TEXT;
