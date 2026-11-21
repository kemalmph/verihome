-- Migration 019: a uniform payment reference across all three paid things.
--
-- Bookings, viewing deposits and consultations now share one PaymentProvider
-- (§11). Their columns did not share anything: bookings had payment_provider,
-- viewings had neither, and consultations recorded a gateway reference under
-- the provider-specific name xendit_invoice_id.
--
-- A settlement webhook receives one external reference and has to find the row
-- it belongs to. With three different shapes that is three special cases; with
-- one column name it is one lookup per table.
--
-- Safe to run now: viewings and consultations are empty and bookings holds a
-- single manual-transfer row, so nothing is being retrofitted onto live
-- gateway data.

-- ── One reference column everywhere ──────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_external_id text;

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS payment_external_id text,
  ADD COLUMN IF NOT EXISTS payment_provider    text NOT NULL DEFAULT 'manual';

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS payment_external_id text,
  ADD COLUMN IF NOT EXISTS payment_provider    text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN bookings.payment_external_id IS
  'Gateway reference, e.g. a Xendit invoice id. NULL for manual bank transfer, which is matched by the unique amount in bank_transfer_code instead.';
COMMENT ON COLUMN viewings.payment_external_id IS
  'Gateway reference. NULL for manual bank transfer.';
COMMENT ON COLUMN consultations.payment_external_id IS
  'Gateway reference. NULL for manual bank transfer.';

-- ── Carry the old consultation column over ───────────────────────────────────
-- Superseded by payment_external_id. Kept rather than dropped so no reference
-- is lost if a row exists in another environment; the application no longer
-- writes it, and it can be dropped once that is confirmed everywhere.

UPDATE consultations
   SET payment_external_id = xendit_invoice_id
 WHERE xendit_invoice_id IS NOT NULL
   AND payment_external_id IS NULL;

COMMENT ON COLUMN consultations.xendit_invoice_id IS
  'Superseded by payment_external_id. No longer written by the application.';

-- ── A reference must settle exactly one record ───────────────────────────────
-- Partial, so the many NULLs of manual payments do not collide. This is what
-- stops a replayed or duplicated webhook from settling the same payment twice.

CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_external_id_key
  ON bookings (payment_external_id) WHERE payment_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS viewings_payment_external_id_key
  ON viewings (payment_external_id) WHERE payment_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS consultations_payment_external_id_key
  ON consultations (payment_external_id) WHERE payment_external_id IS NOT NULL;
