-- ── EX-7 + EX-8: Add paidTo + attachmentUrl to cctv_expenses ──
--
-- EX-7 (paidTo): An expense had `category` and `description` but no payee.
-- "Salary" — paid to whom? "Transport" — which driver? Useful for audit.
-- New `paidTo` TEXT column, nullable for backward compat with pre-EX-7 rows.
--
-- EX-8 (attachmentUrl): Bangladesh tax audit may require receipts for
-- expenses above a threshold. The schema had no `attachmentUrl` field.
-- New `attachmentUrl` TEXT column, nullable. Stored as a URL (the UI
-- uploads to whatever object storage the business uses, then stores
-- the link here). No server-side validation of the URL — the UI is
-- responsible for ensuring the link is reachable.
--
-- Also adds an index on (businessId, paidTo) to support the
-- "expenses by payee" filter that auditors commonly request.

ALTER TABLE "cctv_expenses" ADD COLUMN "paidTo"        TEXT;
ALTER TABLE "cctv_expenses" ADD COLUMN "attachmentUrl" TEXT;

CREATE INDEX "cctv_expenses_businessId_paidTo_idx" ON "cctv_expenses"("businessId", "paidTo");
