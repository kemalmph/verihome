-- 026: allow 'expired' as a booking status.
--
-- Migration 010 introduced expire_stale_bookings(), and 012 replaced it with
-- expire_single_booking(). Both write status = 'expired'. Neither ever widened
-- bookings_status_check, which has allowed only
--   pending | confirmed | cancelled | completed
-- since the table was created.
--
-- So every expiry attempt has failed with a check constraint violation, and the
-- failure was invisible: the cron records the error per booking and keeps
-- going, so the run reports expired=0 rather than crashing.
--
-- The second-order damage is worse than the stale row. expire_single_booking()
-- deletes the availability block BEFORE the UPDATE, so the violation rolls the
-- delete back with it. An unpaid booking past its deadline therefore keeps its
-- dates blocked forever, against a booking that can never be paid.
--
-- 'expired' is already a first-class value everywhere else that matters —
-- integrity.ts, reports/statement.ts, the expiry cron and the reminder cron all
-- filter on it. Only this constraint and the TypeScript union were left behind.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'expired'));
