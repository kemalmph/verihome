-- Migration 023: stop an event being booked twice.
--
-- The application guards by reading prior state and then posting, which is
-- check-then-act with no lock -- the same shape as the phantom read that
-- allowed double bookings. Two admins confirming the same payment at once both
-- read "not yet paid" and both post, silently doubling cash. Verified
-- reproducible before this migration.
--
-- These events happen at most once per record, and postLedgerEntries now
-- guarantees one entry per account per event, so a replay repeats a
-- combination that already exists and the database rejects it. That merge is
-- load-bearing: a booking whose cleaning fee goes to the owner credits
-- owner_payable twice, and an unmerged set trips these indexes.
--
-- Refunds, deposit claims and owner payouts are deliberately NOT here: those
-- legitimately recur (partial refunds, repeated payouts).

CREATE UNIQUE INDEX IF NOT EXISTS ledger_once_per_booking
  ON ledger_entries (event_type, booking_id, account, direction)
  WHERE booking_id IS NOT NULL
    AND event_type IN ('booking_payment_received','booking_revenue_earned','credit_redeemed');

CREATE UNIQUE INDEX IF NOT EXISTS ledger_once_per_viewing
  ON ledger_entries (event_type, viewing_id, account, direction)
  WHERE viewing_id IS NOT NULL
    AND event_type IN ('viewing_deposit_received','viewing_deposit_converted_to_credit',
                       'viewing_deposit_forfeited','viewing_deposit_refunded');

CREATE UNIQUE INDEX IF NOT EXISTS ledger_once_per_consultation
  ON ledger_entries (event_type, consultation_id, account, direction)
  WHERE consultation_id IS NOT NULL
    AND event_type IN ('consultation_payment_received','consultation_revenue_earned');
