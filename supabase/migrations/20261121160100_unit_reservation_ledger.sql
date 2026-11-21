-- ============================================================================
-- Coworking money, in the ledger the rest of the business already uses.
--
-- Three things have to change together or a reservation cannot be paid for:
--
--   1. ledger_entries gains reservation_id — the ledger links to a booking, a
--      viewing, a consultation, a property, a user and an owner, and knew
--      nothing about a unit reservation.
--   2. The two closed CHECK lists are widened: one account, three event types.
--   3. post_ledger_entries learns to carry the new column through.
--
-- §19.9: a CHECK is widened by DROP then ADD, never ALTER, and the new values
-- are proved by writing rows with them. That section exists because two
-- migrations once wrote code for values no migration had added, and every
-- write failed silently for months.
-- ============================================================================

-- ─── 1. the link column ─────────────────────────────────────────────────────

ALTER TABLE public.ledger_entries
  ADD COLUMN reservation_id uuid REFERENCES public.unit_reservations(id);

CREATE INDEX idx_ledger_reservation
  ON public.ledger_entries USING btree (reservation_id);

COMMENT ON COLUMN public.ledger_entries.reservation_id IS
  'The coworking unit reservation this entry belongs to, where it has one.';

-- ─── 2. the closed lists, widened ───────────────────────────────────────────
--
-- One new account. Coworking income is not booking margin: there is no owner
-- split to take a margin out of, the platform is letting its own space. Giving
-- it its own account keeps the two readable apart in every report rather than
-- silently merging two different businesses into one line.

ALTER TABLE public.ledger_entries DROP CONSTRAINT ledger_entries_account_check;
ALTER TABLE public.ledger_entries ADD  CONSTRAINT ledger_entries_account_check
  CHECK (account = ANY (ARRAY[
    'cash'::text,
    'commission_receivable'::text,
    'owner_payable'::text,
    'deposits_held'::text,
    'credits_outstanding'::text,
    'unearned_revenue'::text,
    'revenue_booking_margin'::text,
    'revenue_consultation'::text,
    'revenue_cleaning'::text,
    'revenue_commission'::text,
    'revenue_forfeited_deposit'::text,
    'revenue_coworking'::text,            -- new
    'expense_operating'::text,
    'equity_drawings'::text
  ]));

ALTER TABLE public.ledger_entries DROP CONSTRAINT ledger_entries_event_type_check;
ALTER TABLE public.ledger_entries ADD  CONSTRAINT ledger_entries_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'booking_payment_received'::text,
    'booking_revenue_earned'::text,
    'booking_refund_issued'::text,
    'consultation_payment_received'::text,
    'consultation_revenue_earned'::text,
    'viewing_deposit_received'::text,
    'viewing_deposit_refunded'::text,
    'viewing_deposit_forfeited'::text,
    'viewing_deposit_converted_to_credit'::text,
    'security_deposit_received'::text,
    'security_deposit_refunded'::text,
    'security_deposit_claimed'::text,
    'credit_issued'::text,
    'credit_redeemed'::text,
    'credit_expired'::text,
    'credit_refunded'::text,
    'owner_payout_due'::text,
    'owner_payout_paid'::text,
    'placement_commission_earned'::text,
    'placement_commission_received'::text,
    'cleaning_fee_received'::text,
    'operating_expense_paid'::text,
    'equity_drawing_paid'::text,
    'reservation_payment_received'::text, -- new
    'reservation_revenue_earned'::text,   -- new
    'reservation_refund_issued'::text     -- new
  ]));

-- Same once-only guard the other three entities have: paying twice for one
-- reservation is a double posting, and the index refuses it rather than
-- trusting every future caller to check first.
CREATE UNIQUE INDEX ledger_once_per_reservation
  ON public.ledger_entries USING btree (event_type, reservation_id, account, direction)
  WHERE (reservation_id IS NOT NULL AND event_type = ANY (ARRAY[
    'reservation_payment_received'::text,
    'reservation_revenue_earned'::text
  ]));

-- ─── 3. post_ledger_entries carries the new column ──────────────────────────
--
-- Signature unchanged, so CREATE OR REPLACE is correct here; §19.7's
-- DROP-then-CREATE rule is for when the arguments change. The balance,
-- minimum-entries and non-zero checks are unchanged — reproduced in full
-- because replacing a function with a partial body is how behaviour gets lost.

CREATE OR REPLACE FUNCTION public.post_ledger_entries(p_entries jsonb)
 RETURNS SETOF ledger_entries
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_debits numeric; v_credits numeric; v_count int;
BEGIN
  v_count := jsonb_array_length(p_entries);
  IF v_count IS NULL OR v_count < 2 THEN
    RAISE EXCEPTION 'ledger_incomplete: a financial event needs at least two entries, got %', COALESCE(v_count,0)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM((e->>'amount')::numeric) FILTER (WHERE e->>'direction' = 'debit'),  0),
    COALESCE(SUM((e->>'amount')::numeric) FILTER (WHERE e->>'direction' = 'credit'), 0)
  INTO v_debits, v_credits
  FROM jsonb_array_elements(p_entries) e;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'ledger_unbalanced: debits=% credits=% (difference %)',
      v_debits, v_credits, v_debits - v_credits USING ERRCODE = 'P0001';
  END IF;

  IF v_debits = 0 THEN
    RAISE EXCEPTION 'ledger_zero_value: an event that moves no money should not be posted'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  INSERT INTO ledger_entries (
    entry_date, event_type, account, direction, amount,
    booking_id, viewing_id, consultation_id, property_id, user_id, owner_id,
    reservation_id,
    description, created_by, reversed_by
  )
  SELECT
    COALESCE((e->>'entry_date')::timestamptz, now()),
    e->>'event_type', e->>'account', e->>'direction', (e->>'amount')::numeric,
    (e->>'booking_id')::uuid, (e->>'viewing_id')::uuid, (e->>'consultation_id')::uuid,
    (e->>'property_id')::uuid, (e->>'user_id')::uuid, (e->>'owner_id')::uuid,
    (e->>'reservation_id')::uuid,
    e->>'description', (e->>'created_by')::uuid, (e->>'reversed_by')::uuid
  FROM jsonb_array_elements(p_entries) e
  RETURNING *;
END;
$function$;

-- ─── reservation_code ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_reservation_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  code TEXT;
  suffix TEXT;
BEGIN
  LOOP
    suffix := upper(substr(md5(random()::text), 1, 4));
    code := 'CW-' || to_char(now(), 'YYYYMMDD') || '-' || suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM unit_reservations WHERE reservation_code = code);
  END LOOP;
  RETURN code;
END;
$function$;

-- ─── Creating a reservation, without double-booking ─────────────────────────
--
-- The per-unit advisory lock is §8's pattern: serialise the check and the
-- insert for this one unit, so two requests cannot both read "free" and both
-- insert. The 64-bit key comes from the unit's uuid hex, the same two-int
-- split used by create_booking_if_available.
--
-- Two different availability rules, because the two unit kinds genuinely
-- differ:
--
--   exclusive_use -> no overlapping pending/confirmed reservation at all.
--                    The exclusion constraint also enforces this; the check
--                    here exists to raise a named error instead of a
--                    constraint violation the UI cannot read.
--   shared        -> overlapping seats must not exceed the unit's capacity.
--                    No constraint can express this, so the lock is the only
--                    thing holding it. That is why it is here and not in the
--                    application.

CREATE OR REPLACE FUNCTION public.create_unit_reservation_if_available(
  p_unit_id       uuid,
  p_user_id       uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_seats         integer DEFAULT 1,
  p_total_price   numeric DEFAULT NULL,
  p_expires_hours integer DEFAULT 24
)
 RETURNS unit_reservations
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_unit      lettable_units%ROWTYPE;
  v_res       unit_reservations;
  v_hex       text;
  v_taken     integer;
  v_total     numeric;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = 'P0001';
  END IF;
  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'invalid_seats' USING ERRCODE = 'P0001';
  END IF;

  v_hex := replace(p_unit_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_unit FROM lettable_units WHERE id = p_unit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unit_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- status on lettable_units is lettability, not occupancy: a unit under
  -- maintenance or retired is not on the market at all.
  IF v_unit.status <> 'available' THEN
    RAISE EXCEPTION 'unit_not_lettable' USING ERRCODE = 'P0001';
  END IF;

  IF v_unit.exclusive_use THEN
    IF p_seats <> 1 THEN
      RAISE EXCEPTION 'exclusive_unit_takes_one_seat' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unit_reservations
       WHERE unit_id = p_unit_id
         AND status IN ('pending', 'confirmed')
         AND tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at)
    ) THEN
      RAISE EXCEPTION 'unit_already_taken' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    SELECT COALESCE(SUM(seats), 0) INTO v_taken
      FROM unit_reservations
     WHERE unit_id = p_unit_id
       AND status IN ('pending', 'confirmed')
       AND tstzrange(starts_at, ends_at) && tstzrange(p_starts_at, p_ends_at);

    IF v_taken + p_seats > v_unit.capacity THEN
      RAISE EXCEPTION 'unit_at_capacity: % of % seats already taken', v_taken, v_unit.capacity
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- The caller may pass a total, for a negotiated rate. With none, the unit's
  -- own price stands in — and it is recorded on the row either way, so a later
  -- price change cannot rewrite what was agreed.
  v_total := COALESCE(p_total_price, COALESCE(v_unit.price, 0) * p_seats);

  INSERT INTO unit_reservations (
    reservation_code, unit_id, user_id, starts_at, ends_at, seats,
    letting_mode, unit_price, total_price, exclusive_use, expires_at
  ) VALUES (
    generate_reservation_code(), p_unit_id, p_user_id, p_starts_at, p_ends_at, p_seats,
    v_unit.letting_mode, COALESCE(v_unit.price, 0), v_total, v_unit.exclusive_use,
    now() + (p_expires_hours || ' hours')::interval
  )
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$function$;

-- ─── Payment, and then revenue ──────────────────────────────────────────────
--
-- Two events, not one. Money received is a liability — the space has not been
-- used yet — so it lands in unearned_revenue and only becomes revenue_coworking
-- when the reservation completes. That is the same two-step the booking path
-- uses (§13), and it is what stops a quarter's takings being reported as
-- earned before the desks were sat at.
--
-- The amount is computed here from the row, not passed in, so the ledger and
-- the reservation cannot disagree about what it cost.

CREATE OR REPLACE FUNCTION public.settle_unit_reservation_payment(
  p_reservation_id uuid,
  p_actor          uuid DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE v_res unit_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_res FROM unit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_res.payment_status = 'paid' THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = 'P0001';
  END IF;
  IF v_res.total_price <= 0 THEN
    RAISE EXCEPTION 'nothing_to_pay' USING ERRCODE = 'P0001';
  END IF;

  UPDATE unit_reservations
     SET payment_status = 'paid',
         status         = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
         confirmed_at   = COALESCE(confirmed_at, now())
   WHERE id = p_reservation_id;

  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','reservation_payment_received','account','cash','direction','debit',
      'amount', v_res.total_price, 'reservation_id', v_res.id, 'user_id', v_res.user_id,
      'created_by', p_actor,
      'description','Reservation ' || v_res.reservation_code || ' paid'
    ),
    jsonb_build_object(
      'event_type','reservation_payment_received','account','unearned_revenue','direction','credit',
      'amount', v_res.total_price, 'reservation_id', v_res.id, 'user_id', v_res.user_id,
      'created_by', p_actor,
      'description','Reservation ' || v_res.reservation_code || ' not yet used'
    )
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_unit_reservation_completion(
  p_reservation_id uuid,
  p_actor          uuid DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE v_res unit_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_res FROM unit_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_res.status = 'completed' THEN
    RAISE EXCEPTION 'already_completed' USING ERRCODE = 'P0001';
  END IF;
  -- Revenue cannot be earned on money never received: the liability being
  -- released has to exist first.
  IF v_res.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'not_paid' USING ERRCODE = 'P0001';
  END IF;

  UPDATE unit_reservations SET status = 'completed' WHERE id = p_reservation_id;

  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','reservation_revenue_earned','account','unearned_revenue','direction','debit',
      'amount', v_res.total_price, 'reservation_id', v_res.id, 'user_id', v_res.user_id,
      'created_by', p_actor,
      'description','Reservation ' || v_res.reservation_code || ' used'
    ),
    jsonb_build_object(
      'event_type','reservation_revenue_earned','account','revenue_coworking','direction','credit',
      'amount', v_res.total_price, 'reservation_id', v_res.id, 'user_id', v_res.user_id,
      'created_by', p_actor,
      'description','Coworking revenue, reservation ' || v_res.reservation_code
    )
  ));
END;
$function$;

-- ─── What this slice deliberately does NOT do ───────────────────────────────
--
-- Revenue sharing with a third-party site owner. sites.owner_id exists, so a
-- site Cosystem does not own is representable, but there is no commission rate
-- on a unit and no owner_payable posting here: every rupiah of a reservation is
-- recognised as Cosystem's own coworking revenue.
--
-- That is correct for a site we run and WRONG for one we manage for someone
-- else, and the difference is a pricing decision, not something to infer. Until
-- it is made, do not create reservations against a site with an owner_id that
-- is not Cosystem's own owner record — the money would be recognised as ours.
--
-- The rental side solved the same problem with platform_commission_pct and
-- settle_booking_completion's margin split; the equivalent for units is a
-- commission rate on the unit or the site, and a third posting. §20 material.
