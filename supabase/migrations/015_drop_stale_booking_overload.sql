-- Migration 015: Drop the stale create_booking_if_available overload.
--
-- Migration 010 added p_expires_hours to create_booking_if_available via
-- CREATE OR REPLACE. In Postgres, CREATE OR REPLACE only replaces a function
-- with an identical signature -- adding a parameter creates a SECOND overload
-- instead. Both then matched a 9-argument call (the newer one via its DEFAULT),
-- so every booking failed with:
--
--   Could not choose the best candidate function between: ...
--
-- The surviving 10-parameter version accepts everything the 9-parameter one did,
-- so dropping the old signature cannot break any caller. The old version also
-- predates the expiry system and never set expires_at, which would leave
-- bookings that the expiry cron can never reclaim.

DROP FUNCTION IF EXISTS public.create_booking_if_available(
  uuid,     -- p_property_id
  uuid,     -- p_user_id
  date,     -- p_check_in
  date,     -- p_check_out
  integer,  -- p_guests
  numeric,  -- p_price_per_night
  numeric,  -- p_cleaning_fee
  numeric,  -- p_total_price
  text      -- p_transfer_code
);
