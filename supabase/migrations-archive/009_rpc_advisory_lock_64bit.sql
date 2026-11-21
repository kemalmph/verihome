-- Migration 009: Widen advisory lock key from 32-bit to 64-bit.
--
-- hashtext() returns int4 (32-bit), giving ~4 billion possible lock keys.
-- Two distinct property UUIDs can hash to the same key, causing unrelated
-- properties to serialise against each other (spurious wait, not wrong result).
--
-- pg_advisory_xact_lock(int4, int4) accepts two 32-bit keys, giving 64-bit
-- space — probability of any two UUIDs colliding drops to ~1 in 2^64.
--
-- We extract the first and last 32 bits of the UUID's 128-bit value directly,
-- so the key is deterministic and evenly distributed without a hash step.

CREATE OR REPLACE FUNCTION public.create_booking_if_available(
  p_property_id     uuid,
  p_user_id         uuid,
  p_check_in        date,
  p_check_out       date,
  p_guests          integer,
  p_price_per_night numeric,
  p_cleaning_fee    numeric,
  p_total_price     numeric,
  p_transfer_code   text
) RETURNS bookings
  LANGUAGE plpgsql AS
$$
DECLARE
  v_booking    bookings;
  v_code       TEXT;
  v_buffer     INT;
  v_hex        TEXT;
BEGIN
  -- Build 64-bit advisory lock key from the UUID's first and last 32-bit words.
  v_hex := replace(p_property_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT COALESCE(buffer_days, 0)
    INTO v_buffer
    FROM short_stay_rates
   WHERE property_id = p_property_id
     AND active = true
   LIMIT 1;

  IF EXISTS (
    SELECT 1
      FROM availability_blocks
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
    bank_transfer_code
  ) VALUES (
    v_code, p_property_id, p_user_id,
    p_check_in, p_check_out, p_guests,
    p_price_per_night, p_cleaning_fee, p_total_price,
    p_transfer_code
  )
  RETURNING * INTO v_booking;

  INSERT INTO availability_blocks (property_id, start_date, end_date, reason, booking_id)
  VALUES (p_property_id, p_check_in, p_check_out, 'booked', v_booking.id);

  RETURN v_booking;
END;
$$;
