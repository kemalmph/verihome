-- Migration 010: Proper booking expiry
--
-- Adds expires_at to bookings (set at creation, default 24h).
-- Creates expire_unpaid_bookings() RPC that atomically:
--   1. Finds all unpaid bookings past their deadline
--   2. Deletes their availability_blocks (freeing the dates)
--   3. Marks them expired
-- Done in a single transaction per property with the advisory lock,
-- so expiry and concurrent booking creation are mutually exclusive.

-- ── 1. Add expires_at column ──────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Back-fill existing unpaid bookings that have no deadline yet:
-- treat created_at + 24h as their effective deadline.
UPDATE bookings
   SET expires_at = created_at + interval '24 hours'
 WHERE expires_at IS NULL
   AND payment_status = 'unpaid'
   AND status NOT IN ('confirmed', 'cancelled');

-- ── 2. Update create_booking_if_available to set expires_at ──

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
  p_expires_hours   integer DEFAULT 24
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
    bank_transfer_code,
    expires_at
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

-- ── 3. Atomic expiry RPC ──────────────────────────────────────
--
-- Acquires the advisory lock per property before touching blocks,
-- so it's serialised with create_booking_if_available on the same property.
-- Returns the number of bookings expired.

CREATE OR REPLACE FUNCTION public.expire_unpaid_bookings()
RETURNS integer
LANGUAGE plpgsql AS
$$
DECLARE
  v_row       RECORD;
  v_hex       TEXT;
  v_count     INT := 0;
BEGIN
  FOR v_row IN
    SELECT b.id AS booking_id, b.property_id
      FROM bookings b
     WHERE b.payment_status = 'unpaid'
       AND b.status NOT IN ('confirmed', 'cancelled', 'expired')
       AND b.expires_at IS NOT NULL
       AND b.expires_at < now()
     ORDER BY b.property_id  -- consistent order avoids deadlock between concurrent cron calls
  LOOP
    v_hex := replace(v_row.property_id::text, '-', '');
    PERFORM pg_advisory_xact_lock(
      ('x' || left(v_hex,  8))::bit(32)::int,
      ('x' || right(v_hex, 8))::bit(32)::int
    );

    -- Delete the availability block so the dates are freed
    DELETE FROM availability_blocks
     WHERE booking_id = v_row.booking_id;

    -- Mark the booking expired
    UPDATE bookings
       SET status      = 'expired',
           updated_at  = now()
     WHERE id          = v_row.booking_id
       AND payment_status = 'unpaid'
       AND status NOT IN ('confirmed', 'cancelled', 'expired');

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
