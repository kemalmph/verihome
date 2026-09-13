-- Migration 008: Fix phantom-read double-booking in create_booking_if_available.
--
-- Root cause: FOR UPDATE only locks existing rows. When availability_blocks is
-- empty for a fresh property, both concurrent transactions see "no conflict" and
-- both insert. This is the classic phantom-read problem.
--
-- Fix: acquire a per-property advisory lock at the start of the function.
-- pg_advisory_xact_lock(bigint) blocks the second transaction until the first
-- commits or rolls back, regardless of what is in the table.
-- The lock is released automatically at transaction end.
--
-- The FOR UPDATE is kept as a secondary guard for the update case (concurrent
-- requests when a block already exists), though it is now redundant with the
-- advisory lock.

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
BEGIN
  -- Serialize all booking attempts for this property.
  -- hashtext() maps uuid text to a 32-bit int; cast to bigint for the lock key.
  PERFORM pg_advisory_xact_lock(hashtext(p_property_id::text)::bigint);

  SELECT COALESCE(buffer_days, 0)
    INTO v_buffer
    FROM short_stay_rates
   WHERE property_id = p_property_id
     AND active = true
   LIMIT 1;

  -- One-directional buffer: new check-in must not fall within the cleaning gap
  -- after an existing checkout. Does not penalise days before a check-in.
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
