-- ============================================================================
-- unit_reservations — who has which unit, when.
--
-- lettable_units says what exists. Nothing said who has it. Every tile an
-- operator dashboard wants (free now, in use today, revenue this month,
-- memberships expiring) was a zero because this table did not exist.
--
-- WHY NOT bookings
--
-- `bookings` is property-shaped in ways that are not cosmetic:
--
--   property_id                     NOT NULL — 100% of rows rely on it
--   check_in_date / check_out_date  date — a meeting room is booked by the hour
--   nights, guests, price_per_night — a monthly desk is not nights x rate
--
-- Making property_id nullable would drop a guarantee that holds for every
-- existing row in order to serve a different business. That is the same call
-- that kept sites out of properties, and it gets the same answer: a separate
-- table. §19.2 is this project's own account of what happens when two things
-- are forced into one shape.
-- ============================================================================

-- Needed for the overlap exclusion constraint below: GiST has to index a
-- plain uuid alongside a range, and only btree_gist teaches it how.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- ─── Exclusive use vs shared use ────────────────────────────────────────────
--
-- A hot desk unit with capacity 20 is twenty people who may all be there at
-- once, and overlapping reservations are the normal case. Every other unit
-- type is one space one party at a time: a meeting room, a private office, a
-- retail lot, the café, a storage unit, the event hall.
--
-- So "two reservations overlap" is a bug for most types and expected for one.
-- That difference has to be a column, not a convention, because an exclusion
-- constraint can only read the row it is defending.
--
-- Generated and STORED, not a default: a default can be overridden on insert
-- and would then disagree with the unit's own type, which is exactly the class
-- of silent drift §19.4 records.
ALTER TABLE public.lettable_units
  ADD COLUMN exclusive_use boolean
  GENERATED ALWAYS AS (unit_type <> 'hot_desk') STORED;

COMMENT ON COLUMN public.lettable_units.exclusive_use IS
  'False only for hot_desk, where capacity is simultaneous seats. True means one party at a time, enforced by unit_reservations_no_overlap.';

-- ─── The reservations ───────────────────────────────────────────────────────

CREATE TABLE public.unit_reservations (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_code  text NOT NULL,
  unit_id           uuid NOT NULL REFERENCES public.lettable_units(id) ON DELETE RESTRICT,
  user_id           uuid NOT NULL REFERENCES public.users(id)          ON DELETE RESTRICT,

  -- timestamptz, not date. One shape covers a 2-hour meeting room, a day pass
  -- and a month of a dedicated desk; a date column cannot express the first
  -- and would have forced a second table within the week.
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,

  -- How many of the unit's capacity this reservation takes. Always 1 for an
  -- exclusive unit; 1..n for a hot desk.
  seats             integer NOT NULL DEFAULT 1,

  -- Snapshots, taken when the reservation is made. The unit's price and type
  -- may change afterwards and must not rewrite what someone already agreed
  -- to — the same reason bookings freezes commission_pct (§12).
  letting_mode      text NOT NULL,
  unit_price        numeric NOT NULL,
  total_price       numeric NOT NULL,
  exclusive_use     boolean NOT NULL,

  status            text NOT NULL DEFAULT 'pending',
  payment_status    text NOT NULL DEFAULT 'unpaid',

  notes             text,
  confirmed_at      timestamptz,
  cancelled_at      timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unit_reservations_code_key UNIQUE (reservation_code),

  -- A reservation that ends before it starts is not a short reservation, it is
  -- a corrupt row. Equal is also rejected: a zero-length booking holds nothing.
  CONSTRAINT unit_reservations_time_order_check CHECK (ends_at > starts_at),
  CONSTRAINT unit_reservations_seats_check      CHECK (seats > 0),
  CONSTRAINT unit_reservations_price_check      CHECK (unit_price  >= 0),
  CONSTRAINT unit_reservations_total_check      CHECK (total_price >= 0),

  -- Closed lists, mirrored in src/lib/coworking/taxonomy.ts. Widening one is a
  -- DROP then ADD with the new value proven by writing a row (§19.9).
  CONSTRAINT unit_reservations_letting_mode_check
    CHECK (letting_mode = ANY (ARRAY['hourly'::text, 'daily'::text, 'monthly'::text, 'lease'::text])),
  CONSTRAINT unit_reservations_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'expired'::text])),
  CONSTRAINT unit_reservations_payment_status_check
    CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'pending_verification'::text, 'paid'::text, 'refunded'::text]))
);

-- ─── The double-booking backstop ────────────────────────────────────────────
--
-- create_unit_reservation_if_available() takes a per-unit advisory lock and
-- checks availability before inserting, the same pattern as §8's booking
-- guard. This constraint is what catches the write that does not go through
-- that function — a migration, a fix applied by hand, a second code path
-- written next year by someone who did not read this file.
--
-- §8 is the project's own record of why: the application-level check was there
-- first, and it was the database constraint that actually stopped the
-- double-booking.
--
-- Only pending and confirmed hold a unit. A cancelled or expired reservation
-- releases it, and a completed one is in the past.
ALTER TABLE public.unit_reservations
  ADD CONSTRAINT unit_reservations_no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (exclusive_use AND status = ANY (ARRAY['pending'::text, 'confirmed'::text]));

-- Shared units cannot use an exclusion constraint — overlap is legal there up
-- to capacity — so their limit is enforced in the function, under the lock.

CREATE INDEX idx_unit_reservations_unit_time
  ON public.unit_reservations USING btree (unit_id, starts_at, ends_at);
CREATE INDEX idx_unit_reservations_user
  ON public.unit_reservations USING btree (user_id);
CREATE INDEX idx_unit_reservations_status
  ON public.unit_reservations USING btree (status, starts_at);

COMMENT ON TABLE public.unit_reservations IS
  'Who holds which lettable unit, when. Separate from bookings because bookings is property-shaped: NOT NULL property_id, date granularity, nights x rate pricing.';

-- ─── updated_at ─────────────────────────────────────────────────────────────

CREATE TRIGGER unit_reservations_set_updated_at
  BEFORE UPDATE ON public.unit_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Grants: none for anon or authenticated ─────────────────────────────────
--
-- A reservation says where a named person will be at a given hour. That is
-- exactly the shape of data §19.12 exists to keep off the public API: no
-- table-level grant, no column grant, and scripts/audit-anon-exposure.js
-- carries this table in CLOSED_TO_ALL so a future grant fails the audit rather
-- than shipping.
--
-- Operator pages reach it through server actions that call requireAdmin(),
-- like every other admin-only table here.
ALTER TABLE public.unit_reservations ENABLE ROW LEVEL SECURITY;
