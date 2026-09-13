-- Migration 012: Fix two security/correctness issues
--
-- 1. issue_viewing_credit: add deposit_paid guard.
--    Without it a user could upload any image, get marked attended,
--    and receive IDR 50K credit before their deposit was verified.
--
-- 2. expire_single_booking: single-booking expiry in its own transaction.
--    The loop in expire_unpaid_bookings() held all advisory locks until
--    the outer transaction committed — expiring 40 bookings blocked 40
--    properties from accepting new bookings for the duration of the loop.
--    The cron route now calls expire_single_booking() per booking so each
--    lock is acquired and released independently.

-- ── 1. Patch issue_viewing_credit ────────────────────────────

CREATE OR REPLACE FUNCTION public.issue_viewing_credit(p_viewing_id uuid)
RETURNS user_credits
LANGUAGE plpgsql AS
$$
DECLARE
  v_viewing  viewings;
  v_credit   user_credits;
  v_hex      TEXT;
BEGIN
  v_hex := replace(p_viewing_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_viewing FROM viewings WHERE id = p_viewing_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'viewing_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Deposit must be confirmed by admin before credit can be issued
  IF v_viewing.deposit_paid IS NOT TRUE THEN
    RAISE EXCEPTION 'deposit_not_confirmed' USING ERRCODE = 'P0001';
  END IF;

  IF v_viewing.attended IS NOT TRUE THEN
    RAISE EXCEPTION 'viewing_not_attended' USING ERRCODE = 'P0001';
  END IF;

  IF v_viewing.credit_issued THEN
    SELECT * INTO v_credit FROM user_credits WHERE viewing_id = p_viewing_id LIMIT 1;
    RETURN v_credit;
  END IF;

  INSERT INTO user_credits (user_id, viewing_id, amount, reason, expires_at)
  VALUES (
    v_viewing.user_id,
    p_viewing_id,
    COALESCE(v_viewing.deposit_amount, 50000),
    'viewing_deposit',
    now() + interval '6 months'
  )
  RETURNING * INTO v_credit;

  UPDATE viewings
     SET credit_issued    = true,
         credit_issued_at = now()
   WHERE id = p_viewing_id;

  RETURN v_credit;
END;
$$;

-- ── 2. Single-booking expiry (one transaction per booking) ────

CREATE OR REPLACE FUNCTION public.expire_single_booking(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql AS
$$
DECLARE
  v_property_id uuid;
  v_hex         TEXT;
  v_found       BOOLEAN := false;
BEGIN
  SELECT property_id INTO v_property_id
    FROM bookings
   WHERE id             = p_booking_id
     AND payment_status = 'unpaid'
     AND status NOT IN ('confirmed', 'cancelled', 'expired')
     AND expires_at IS NOT NULL
     AND expires_at < now();

  IF NOT FOUND THEN
    RETURN false;  -- already expired, confirmed, or not past deadline
  END IF;

  v_hex := replace(v_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  DELETE FROM availability_blocks WHERE booking_id = p_booking_id;

  UPDATE bookings
     SET status     = 'expired',
         updated_at = now()
   WHERE id             = p_booking_id
     AND payment_status = 'unpaid'
     AND status NOT IN ('confirmed', 'cancelled', 'expired');

  GET DIAGNOSTICS v_found = ROW_COUNT;
  RETURN v_found > 0;
END;
$$;
