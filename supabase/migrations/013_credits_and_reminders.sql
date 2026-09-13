-- Migration 013: Credit application at booking checkout + reminder tracking
--
-- 1. Adds reminder_sent_at / expiry_reminder_sent_at to bookings
-- 2. Creates create_booking_with_credits() RPC — atomically deducts
--    available credits and creates the booking in one transaction

-- ── 1. Reminder tracking columns ─────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS checkin_reminder_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at   timestamptz;

-- ── 2. Credit-aware booking RPC ───────────────────────────────
--
-- p_credit_amount: total credit to apply (must be <= user's available balance).
-- Credits are consumed oldest-expiring first, marked redeemed atomically.
-- Raises 'insufficient_credits' if p_credit_amount > available balance.
-- p_total_price should already have the credit deducted (what the guest transfers).
-- p_gross_price is the pre-credit total, stored for audit.

CREATE OR REPLACE FUNCTION public.create_booking_with_credits(
  p_property_id     uuid,
  p_user_id         uuid,
  p_check_in        date,
  p_check_out       date,
  p_guests          integer,
  p_price_per_night numeric,
  p_cleaning_fee    numeric,
  p_gross_price     numeric,   -- total before credits
  p_credit_amount   numeric,   -- credit to deduct (0 if none)
  p_total_price     numeric,   -- p_gross_price - p_credit_amount (actual transfer)
  p_transfer_code   text,
  p_expires_hours   integer DEFAULT 24
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
  -- Per-property advisory lock (same key derivation as create_booking_if_available)
  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  -- Validate credit amount against available balance
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

  -- Check availability
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

  -- Redeem credits oldest-expiring first
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
      v_deduct   := LEAST(v_credit.amount, v_remaining);
      v_remaining := v_remaining - v_deduct;

      UPDATE user_credits
         SET redeemed_at = now(),
             booking_id  = v_booking.id
       WHERE id = v_credit.id;
    END LOOP;
  END IF;

  RETURN v_booking;
END;
$$;
