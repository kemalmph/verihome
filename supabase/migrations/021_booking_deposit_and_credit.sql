-- Migration 021: persist the security deposit and credit applied on a booking.
--
-- The security deposit was computed from short_stay_rates at quote time, shown
-- to the guest, and then forgotten -- and pricing.ts excluded it from the
-- transfer total, so it was never actually collected. It is now collected
-- upfront, which means the agreed figure has to live on the booking:
-- reading short_stay_rates later would return the CURRENT deposit, not the one
-- the guest agreed to, and deposits_held would stop matching cash received.
--
-- credit_applied is stored for the same reason. It is derivable from
-- user_credits.booking_id today, but restore_booking_credits sets that link to
-- NULL when a booking is cancelled -- which would erase the record of what was
-- redeemed at the moment the ledger most needs it.
--
-- total_price also changes meaning: it is now the GROSS price of the stay
-- (subtotal + cleaning), not the net after credit. Cash expected from the guest
-- is total_price - credit_applied + security_deposit. Nothing is rewritten:
-- no booking has ever used credit, so the two meanings coincide on every
-- existing row.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS security_deposit numeric(12,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied   numeric(12,0) NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.security_deposit IS
  'Refundable deposit agreed at booking time, collected upfront with the stay payment. A liability (deposits_held), never revenue unless forfeited.';
COMMENT ON COLUMN bookings.credit_applied IS
  'User credit redeemed against this booking. Kept here because restore_booking_credits detaches the user_credits rows on cancellation.';
COMMENT ON COLUMN bookings.total_price IS
  'Gross price of the stay: subtotal + cleaning fee, before credit and excluding the refundable security deposit. Cash expected = total_price - credit_applied + security_deposit.';
