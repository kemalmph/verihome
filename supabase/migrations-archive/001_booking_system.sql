-- ============================================================
-- Migration 001: Booking System Foundation
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Extend properties table ───────────────────────────────

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS rental_mode        TEXT    NOT NULL DEFAULT 'long_term'
    CHECK (rental_mode IN ('long_term', 'short_stay', 'both')),
  ADD COLUMN IF NOT EXISTS is_furnished       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_instant_bookable BOOLEAN NOT NULL DEFAULT false;

-- ── 2. short_stay_rates ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS short_stay_rates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id            UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  price_per_night        NUMERIC(12,2) NOT NULL,
  price_per_night_weekend NUMERIC(12,2),            -- null = same as weekday
  min_nights             INT  NOT NULL DEFAULT 1,
  max_nights             INT,                        -- null = no limit
  cleaning_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
  active                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

-- ── 3. bookings (enum-like status via CHECK) ─────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code        TEXT UNIQUE NOT NULL,
  property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  user_id             UUID NOT NULL REFERENCES users(id)       ON DELETE RESTRICT,
  booking_type        TEXT NOT NULL DEFAULT 'short_stay'
    CHECK (booking_type IN ('short_stay', 'long_term', 'viewing')),

  -- stay dates
  check_in_date       DATE NOT NULL,
  check_out_date      DATE NOT NULL,
  nights              INT  NOT NULL GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
  guests              INT  NOT NULL DEFAULT 1,

  -- pricing snapshot (locked at booking time)
  price_per_night     NUMERIC(12,2) NOT NULL DEFAULT 0,
  cleaning_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price         NUMERIC(12,2) NOT NULL,

  -- status
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending_verification', 'paid', 'refunded')),

  -- payment (manual bank transfer)
  payment_provider    TEXT NOT NULL DEFAULT 'manual',
  bank_transfer_code  TEXT,          -- unique 3-digit suffix appended to transfer amount
  payment_proof_url   TEXT,

  -- admin
  admin_notes         TEXT,
  confirmed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_property_id_idx    ON bookings (property_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx        ON bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_status_idx         ON bookings (status);
CREATE INDEX IF NOT EXISTS bookings_check_in_date_idx  ON bookings (check_in_date);

-- ── 4. availability_blocks ───────────────────────────────────

CREATE TABLE IF NOT EXISTS availability_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,   -- exclusive (last blocked night)
  reason      TEXT NOT NULL DEFAULT 'booked'
    CHECK (reason IN ('booked', 'maintenance', 'owner_use', 'other')),
  booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_blocks_dates_check CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS availability_blocks_property_dates_idx
  ON availability_blocks (property_id, start_date, end_date);

-- ── 5. booking_code generator ────────────────────────────────

CREATE OR REPLACE FUNCTION generate_booking_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  suffix TEXT;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text), 1, 4));
    code := 'VH-' || to_char(now(), 'YYYYMMDD') || '-' || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ── 6. Atomic booking creation RPC ───────────────────────────
-- Checks availability and creates booking + availability_block in one transaction.
-- Returns the new booking row or raises an exception on conflict.

CREATE OR REPLACE FUNCTION create_booking_if_available(
  p_property_id     UUID,
  p_user_id         UUID,
  p_check_in        DATE,
  p_check_out       DATE,
  p_guests          INT,
  p_price_per_night NUMERIC,
  p_cleaning_fee    NUMERIC,
  p_total_price     NUMERIC,
  p_transfer_code   TEXT
)
RETURNS bookings LANGUAGE plpgsql AS $$
DECLARE
  v_booking bookings;
  v_code    TEXT;
BEGIN
  -- Lock all existing blocks for this property to prevent race conditions
  PERFORM 1
    FROM availability_blocks
   WHERE property_id = p_property_id
     AND start_date < p_check_out
     AND end_date   > p_check_in
   FOR UPDATE;

  -- Check for overlap
  IF EXISTS (
    SELECT 1
      FROM availability_blocks
     WHERE property_id = p_property_id
       AND start_date < p_check_out
       AND end_date   > p_check_in
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

  -- Block the dates
  INSERT INTO availability_blocks (property_id, start_date, end_date, reason, booking_id)
  VALUES (p_property_id, p_check_in, p_check_out, 'booked', v_booking.id);

  RETURN v_booking;
END;
$$;

-- ── 7. updated_at trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER short_stay_rates_updated_at
  BEFORE UPDATE ON short_stay_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 8. RLS ───────────────────────────────────────────────────

ALTER TABLE short_stay_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;

-- short_stay_rates: public read, admin write
CREATE POLICY "public_read_rates"   ON short_stay_rates FOR SELECT USING (true);
CREATE POLICY "admin_write_rates"   ON short_stay_rates FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- availability_blocks: public read, admin write
CREATE POLICY "public_read_blocks"  ON availability_blocks FOR SELECT USING (true);
CREATE POLICY "admin_write_blocks"  ON availability_blocks FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- bookings: users see their own, admins see all
CREATE POLICY "user_own_bookings"   ON bookings FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "user_insert_booking" ON bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_bookings"  ON bookings FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
