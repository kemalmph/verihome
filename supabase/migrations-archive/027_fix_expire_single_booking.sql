-- 027: repair expire_single_booking().
--
-- With 026 the UPDATE finally succeeded, and the function failed one line
-- later instead:
--
--   v_found BOOLEAN := false;
--   GET DIAGNOSTICS v_found = ROW_COUNT;
--   RETURN v_found > 0;              -- ERROR: operator does not exist: boolean > integer
--
-- ROW_COUNT is an integer being read into a boolean. The comparison is a hard
-- error raised at the RETURN, after the UPDATE, so the whole call aborts and
-- the expiry rolls back exactly as before. Between this and 026 the function
-- has never once succeeded since it was introduced in migration 012.
--
-- Two further changes while rewriting it:
--
-- 1. The DELETE now runs AFTER the UPDATE and only when the UPDATE actually
--    expired a row. The old order deleted the availability block first, so a
--    booking confirmed by someone else between the SELECT and the advisory
--    lock would lose its block and keep its confirmed status — a confirmed
--    stay with nothing holding its dates.
--
-- 2. The UPDATE re-checks expires_at, not just status and payment_status. The
--    initial SELECT runs before the lock is taken, so every condition that
--    decided to expire has to be re-asserted under it.

CREATE OR REPLACE FUNCTION public.expire_single_booking(p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_property_id uuid;
  v_hex         TEXT;
  v_rows        INT := 0;
BEGIN
  SELECT property_id INTO v_property_id
    FROM bookings
   WHERE id             = p_booking_id
     AND payment_status = 'unpaid'
     AND status NOT IN ('confirmed', 'cancelled', 'expired', 'completed')
     AND expires_at IS NOT NULL
     AND expires_at < now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Serialise against booking creation for this property: the two together
  -- decide whether a set of dates is free.
  v_hex := replace(v_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  -- The decision point. Every condition is re-checked under the lock, because
  -- the SELECT above ran without it.
  UPDATE bookings
     SET status     = 'expired',
         updated_at = now()
   WHERE id             = p_booking_id
     AND payment_status = 'unpaid'
     AND status NOT IN ('confirmed', 'cancelled', 'expired', 'completed')
     AND expires_at IS NOT NULL
     AND expires_at < now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Someone paid, confirmed or cancelled it while we waited for the lock.
    -- Leave the availability block alone: it still belongs to a live booking.
    RETURN false;
  END IF;

  -- Only now are the dates genuinely free.
  DELETE FROM availability_blocks WHERE booking_id = p_booking_id;

  RETURN true;
END;
$function$;
