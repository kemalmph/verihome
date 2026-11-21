-- Migration 014: Four follow-up fixes
--
-- 1. restore_booking_credits(): return non-expired credits on cancellation
-- 2. deposit_refund_confirmed_at on viewings: separate intent from execution
-- 3. Change create_booking_with_credits / create_booking_if_available default
--    expires_hours from 24 → 48 so the daily reminder cron fires ~25h before
--    expiry rather than 1h before

-- ── 1. Credit restoration on booking cancellation ─────────────

CREATE OR REPLACE FUNCTION public.restore_booking_credits(p_booking_id uuid)
RETURNS TABLE (restored int, expired_skipped int)
LANGUAGE plpgsql AS
$$
DECLARE
  v_restored        INT := 0;
  v_expired_skipped INT := 0;
  v_row             user_credits%ROWTYPE;
BEGIN
  FOR v_row IN
    SELECT * FROM user_credits
     WHERE booking_id  = p_booking_id
       AND redeemed_at IS NOT NULL
     FOR UPDATE
  LOOP
    IF v_row.expires_at IS NULL OR v_row.expires_at > now() THEN
      UPDATE user_credits
         SET redeemed_at = NULL,
             booking_id  = NULL
       WHERE id = v_row.id;
      v_restored := v_restored + 1;
    ELSE
      -- Credit expired between redemption and cancellation — cannot restore.
      -- Leave redeemed_at set; the booking_id stays for audit.
      v_expired_skipped := v_expired_skipped + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_restored, v_expired_skipped;
END;
$$;

-- ── 2. Refund visibility: split intent from execution ─────────

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS deposit_refund_requested_at timestamptz;

-- ── 3. Extend default expiry to 48h ──────────────────────────
--    A daily 08:00 cron with 24h expiry fires 1h before the deadline
--    for a 09:00 booking. 48h expiry gives ~25h of notice.

CREATE OR REPLACE FUNCTION public.create_booking_if_available(
  p_property_id     uuid,
  p_user_id         uuid,
  p_check_in        date,
  p_check_out       date,
  p_guests          integer,
  p_price_per_night numeric,
  p_cleaning_fee    numeric,
  p_total_price     numeric,
  p_transfer_code   text,
  p_expires_hours   integer DEFAULT 48
) RETURNS bookings
  LANGUAGE plpgsql AS
$$
DECLARE
  v_booking    bookings;
  v_code       TEXT;
  v_buffer     INT;
  v_hex        TEXT;
BEGIN
  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT COALESCE(buffer_days, 0) INTO v_buffer
    FROM short_stay_rates
   WHERE property_id = p_property_id AND active = true LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM availability_blocks
     WHERE property_id = p_property_id
       AND start_date          < p_check_out
       AND end_date + v_buffer > p_check_in
     FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_code := generate_booking_code();

  INSERT INTO bookings (
    booking_code, property_id, user_id,
    check_in_date, check_out_date, guests,
    price_per_night, cleaning_fee, total_price,
    bank_transfer_code, expires_at
  ) VALUES (
    v_code, p_property_id, p_user_id,
    p_check_in, p_check_out, p_guests,
    p_price_per_night, p_cleaning_fee, p_total_price,
    p_transfer_code,
    now() + (p_expires_hours || ' hours')::interval
  )
  RETURNING * INTO v_booking;

  INSERT INTO availability_blocks (property_id, start_date, end_date, reason, booking_id)
  VALUES (p_property_id, p_check_in, p_check_out, 'booked', v_booking.id);

  RETURN v_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_with_credits(
  p_property_id     uuid,
  p_user_id         uuid,
  p_check_in        date,
  p_check_out       date,
  p_guests          integer,
  p_price_per_night numeric,
  p_cleaning_fee    numeric,
  p_gross_price     numeric,
  p_credit_amount   numeric,
  p_total_price     numeric,
  p_transfer_code   text,
  p_expires_hours   integer DEFAULT 48
) RETURNS bookings
  LANGUAGE plpgsql AS
$$
DECLARE
  v_booking     bookings;
  v_code        TEXT;
  v_buffer      INT;
  v_hex         TEXT;
  v_credit      user_credits%ROWTYPE;
  v_remaining   NUMERIC := p_credit_amount;
  v_deduct      NUMERIC;
  v_avail_total NUMERIC;
BEGIN
  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  IF p_credit_amount > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_avail_total
      FROM user_credits
     WHERE user_id     = p_user_id
       AND redeemed_at IS NULL
       AND (expires_at IS NULL OR expires_at > now());

    IF v_avail_total < p_credit_amount THEN
      RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT COALESCE(buffer_days, 0) INTO v_buffer
    FROM short_stay_rates
   WHERE property_id = p_property_id AND active = true LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM availability_blocks
     WHERE property_id = p_property_id
       AND start_date          < p_check_out
       AND end_date + v_buffer > p_check_in
     FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_code := generate_booking_code();

  INSERT INTO bookings (
    booking_code, property_id, user_id,
    check_in_date, check_out_date, guests,
    price_per_night, cleaning_fee, total_price,
    bank_transfer_code, expires_at
  ) VALUES (
    v_code, p_property_id, p_user_id,
    p_check_in, p_check_out, p_guests,
    p_price_per_night, p_cleaning_fee, p_total_price,
    p_transfer_code,
    now() + (p_expires_hours || ' hours')::interval
  )
  RETURNING * INTO v_booking;

  INSERT INTO availability_blocks (property_id, start_date, end_date, reason, booking_id)
  VALUES (p_property_id, p_check_in, p_check_out, 'booked', v_booking.id);

  IF p_credit_amount > 0 THEN
    FOR v_credit IN
      SELECT * FROM user_credits
       WHERE user_id     = p_user_id
         AND redeemed_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY expires_at ASC NULLS LAST
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_deduct    := LEAST(v_credit.amount, v_remaining);
      v_remaining := v_remaining - v_deduct;
      UPDATE user_credits
         SET redeemed_at = now(), booking_id = v_booking.id
       WHERE id = v_credit.id;
    END LOOP;
  END IF;

  RETURN v_booking;
END;
$$;
