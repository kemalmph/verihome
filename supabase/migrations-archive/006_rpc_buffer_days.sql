-- Migration 006: Enforce buffer_days in the atomic availability RPC
-- and expose it to getUnavailableDates via a helper function.
--
-- buffer_days blocks N days after each checkout for cleaning.
-- It applies to NEW availability checks only — confirmed bookings
-- already in availability_blocks are never modified or invalidated.

-- ── 1. Replace the atomic booking RPC ────────────────────────────
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
  v_win_start  DATE;
  v_win_end    DATE;
BEGIN
  -- Fetch buffer_days for this property (0 if no active rate or field missing)
  SELECT COALESCE(buffer_days, 0)
    INTO v_buffer
    FROM short_stay_rates
   WHERE property_id = p_property_id
     AND active = true
   LIMIT 1;

  -- One-directional buffer: extend each existing block's end_date forward by
  -- buffer_days. This blocks new check-ins within the cleaning gap after an
  -- existing checkout, without penalising the days before an existing check-in.
  -- Equivalent condition: existing_end + buffer > p_check_in AND existing_start < p_check_out

  PERFORM 1
    FROM availability_blocks
   WHERE property_id = p_property_id
     AND start_date          < p_check_out
     AND end_date + v_buffer > p_check_in
   FOR UPDATE;

  IF EXISTS (
    SELECT 1
      FROM availability_blocks
     WHERE property_id = p_property_id
       AND start_date          < p_check_out
       AND end_date + v_buffer > p_check_in
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

  -- Block the actual booking dates (NOT extended by buffer — the buffer is
  -- virtual padding applied at check time, not persisted)
  INSERT INTO availability_blocks (property_id, start_date, end_date, reason, booking_id)
  VALUES (p_property_id, p_check_in, p_check_out, 'booked', v_booking.id);

  RETURN v_booking;
END;
$$;

-- ── 2. Helper: get buffer_days for a property ────────────────────
-- Used by getUnavailableDates on the JS side via a direct query,
-- but also useful for any future SQL callers.
CREATE OR REPLACE FUNCTION public.get_property_buffer_days(p_property_id uuid)
RETURNS INT
LANGUAGE sql STABLE AS
$$
  SELECT COALESCE(
    (SELECT buffer_days FROM short_stay_rates
      WHERE property_id = p_property_id AND active = true
      LIMIT 1),
    0
  );
$$;
