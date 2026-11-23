-- ============================================================================
-- Membership fees in the ledger, recognised per MEMBERSHIP month.
--
-- The owner decided: a membership month, not a calendar month. A membership
-- that starts on the 15th earns its fee from the 15th to the 14th, and the
-- schedule below is that decision written down rather than recomputed by
-- whoever opens a report next.
--
-- Why it needed deciding at all: the two readings disagree by real money at
-- every period end. A membership starting 15 January, recognised by calendar
-- month, splits January's fee across two months and leaves a part-month
-- stub in December. Recognised by membership month it does not. Neither is
-- wrong in general; picking one and never mixing them is what matters, and
-- mixing them is what happens when nothing in the schema says which.
--
-- The shape follows the reservation path (§13) exactly:
--
--   money in                -> cash debit,            unearned_revenue credit
--   a membership month ends -> unearned_revenue debit, revenue_membership credit
--
-- so takings are never reported as earned before the month they pay for has
-- been served.
-- ============================================================================

-- ─── 1. The recognition schedule ────────────────────────────────────────────
--
-- A row per membership month. Not computed on the fly: it is the record of
-- what was recognised when, it is what the ledger entries point at, and it is
-- what makes posting twice impossible rather than merely discouraged.
--
-- Periods are generated whole. Where a term does not end on a month boundary
-- the final stub is prorated by days — a membership cancelled mid-month has
-- not earned the whole month.

CREATE TABLE public.membership_periods (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id  uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,

  /** 1-based, in order. Period 1 starts on the membership's starts_on. */
  period_no      integer NOT NULL,

  starts_on      date NOT NULL,
  ends_on        date NOT NULL,

  /** This period's share of the fee, in whole rupiah. */
  amount         numeric(12,0) NOT NULL,

  /** Set by the settle functions, never by hand — they are what post the
      matching ledger entries, and a timestamp here without those entries
      would be a lie the reports would believe. */
  paid_at        timestamptz,
  recognised_at  timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT membership_periods_no_key UNIQUE (membership_id, period_no),
  CONSTRAINT membership_periods_order_check  CHECK (ends_on >= starts_on),
  CONSTRAINT membership_periods_no_check     CHECK (period_no >= 1),
  CONSTRAINT membership_periods_amount_check CHECK (amount >= 0),
  /* Revenue cannot be earned on money never received. */
  CONSTRAINT membership_periods_paid_before_earned_check
    CHECK (recognised_at IS NULL OR paid_at IS NOT NULL)
);

CREATE INDEX idx_membership_periods_membership
  ON public.membership_periods USING btree (membership_id, period_no);

-- The query a nightly job asks: which months have ended and are still
-- unrecognised.
CREATE INDEX idx_membership_periods_due
  ON public.membership_periods USING btree (ends_on)
  WHERE (recognised_at IS NULL);

COMMENT ON TABLE public.membership_periods IS
  'One row per membership month. Periods are anchored to the membership start date, not the calendar — the owner''s decision. A final part-month is prorated by days.';

ALTER TABLE public.membership_periods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.membership_periods FROM anon, authenticated;
GRANT  ALL ON TABLE public.membership_periods TO service_role;

-- ─── 2. The ledger learns about memberships ─────────────────────────────────

ALTER TABLE public.ledger_entries
  ADD COLUMN membership_id        uuid REFERENCES public.memberships(id),
  ADD COLUMN membership_period_id uuid REFERENCES public.membership_periods(id);

CREATE INDEX idx_ledger_membership
  ON public.ledger_entries USING btree (membership_id);
CREATE INDEX idx_ledger_membership_period
  ON public.ledger_entries USING btree (membership_period_id);

COMMENT ON COLUMN public.ledger_entries.membership_id IS
  'The membership this entry belongs to, where it has one.';
COMMENT ON COLUMN public.ledger_entries.membership_period_id IS
  'The membership month this entry belongs to. Payment and revenue are both posted per period, so this is what the once-only guards key on.';

-- ─── 3. The closed lists, widened ───────────────────────────────────────────
--
-- §19.9: a CHECK is widened by DROP then ADD, never ALTER, and the full list
-- is reproduced so the constraint is readable in one place. That section
-- exists because two migrations once wrote code for values no migration had
-- added, and every write failed silently for months.
--
-- revenue_membership is its own account rather than more revenue_coworking.
-- A subscription and a desk booking are different products: one is recurring
-- and churns, the other is usage that peaks and dips. Merged into one line,
-- a report cannot say which of the two is growing — the same argument that
-- gave coworking its own account apart from booking margin.

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
    'revenue_coworking'::text,
    'revenue_membership'::text,           -- new
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
    'reservation_payment_received'::text,
    'reservation_revenue_earned'::text,
    'reservation_refund_issued'::text,
    'membership_payment_received'::text,  -- new
    'membership_revenue_earned'::text,    -- new
    'membership_refund_issued'::text      -- new
  ]));

-- Keyed on the period, not the membership: a yearly fee paid up front is one
-- payment across twelve periods, and a monthly fee is one payment per period.
-- Keying on the membership would refuse the second month's payment.
CREATE UNIQUE INDEX ledger_once_per_membership_period
  ON public.ledger_entries USING btree (event_type, membership_period_id, account, direction)
  WHERE (membership_period_id IS NOT NULL AND event_type = ANY (ARRAY[
    'membership_payment_received'::text,
    'membership_revenue_earned'::text
  ]));

-- ─── 4. post_ledger_entries carries the new columns ─────────────────────────
--
-- Signature unchanged, so CREATE OR REPLACE is correct; §19.7's
-- DROP-then-CREATE rule is for when the arguments change. The balance,
-- minimum-entries and non-zero checks are reproduced in full — replacing a
-- function with a partial body is how behaviour gets lost.

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
    reservation_id, membership_id, membership_period_id,
    description, created_by, reversed_by
  )
  SELECT
    COALESCE((e->>'entry_date')::timestamptz, now()),
    e->>'event_type', e->>'account', e->>'direction', (e->>'amount')::numeric,
    (e->>'booking_id')::uuid, (e->>'viewing_id')::uuid, (e->>'consultation_id')::uuid,
    (e->>'property_id')::uuid, (e->>'user_id')::uuid, (e->>'owner_id')::uuid,
    (e->>'reservation_id')::uuid,
    (e->>'membership_id')::uuid, (e->>'membership_period_id')::uuid,
    e->>'description', (e->>'created_by')::uuid, (e->>'reversed_by')::uuid
  FROM jsonb_array_elements(p_entries) e
  RETURNING *;
END;
$function$;

-- ─── 5. Building the schedule ───────────────────────────────────────────────
--
-- Anchored to starts_on, so the 31st behaves: Postgres clamps
-- '2026-01-31'::date + interval '1 month' to 28 February, and the period after
-- that returns to the 31st because every start is computed from the anchor
-- rather than from the previous period. Stepping month by month would drift
-- to the 28th and stay there.
--
-- A yearly fee is sliced so the parts sum to exactly the fee. Each slice is
-- the difference between two running totals, which telescopes: no residue is
-- left stranded in unearned_revenue because twelve roundings of price/12 came
-- to one rupiah short.

CREATE OR REPLACE FUNCTION public.generate_membership_periods(p_membership_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_m         memberships%ROWTYPE;
  v_count     integer := 0;
  v_n         integer;
  v_total     integer;
  v_start     date;
  v_next      date;
  v_end       date;
  v_amount    numeric;
  v_full_days integer;
  v_days      integer;
  v_running   numeric := 0;
  v_prev      numeric := 0;
BEGIN
  SELECT * INTO v_m FROM memberships WHERE id = p_membership_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- How many membership months the term spans. Counted from the anchor.
  v_total := 0;
  LOOP
    EXIT WHEN (v_m.starts_on + (v_total || ' months')::interval)::date > v_m.ends_on;
    v_total := v_total + 1;
  END LOOP;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'membership_term_too_short' USING ERRCODE = 'P0001';
  END IF;

  FOR v_n IN 1..v_total LOOP
    v_start := (v_m.starts_on + ((v_n - 1) || ' months')::interval)::date;
    v_next  := (v_m.starts_on + (v_n       || ' months')::interval)::date;
    v_end   := least(v_next - 1, v_m.ends_on);

    IF v_m.period = 'yearly' THEN
      -- Running totals, so the slices sum to the fee exactly.
      v_running := round(v_m.price * v_n / v_total);
      v_amount  := v_running - v_prev;
      v_prev    := v_running;
    ELSE
      v_amount := round(v_m.price);
    END IF;

    -- A term ending mid-month has not earned that whole month.
    v_full_days := (v_next - v_start);
    v_days      := (v_end - v_start) + 1;
    IF v_days < v_full_days THEN
      v_amount := round(v_amount * v_days / v_full_days);
    END IF;

    INSERT INTO membership_periods (membership_id, period_no, starts_on, ends_on, amount)
    VALUES (p_membership_id, v_n, v_start, v_end, v_amount)
    ON CONFLICT (membership_id, period_no) DO NOTHING;

    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- ─── 6. Money in ────────────────────────────────────────────────────────────
--
-- Per period, because that is the unit both billing shapes share: a yearly
-- fee paid up front settles twelve periods in one transaction, a monthly fee
-- settles one at a time, and neither needs a special case.

CREATE OR REPLACE FUNCTION public.settle_membership_period_payment(
  p_period_id uuid,
  p_actor     uuid DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_p membership_periods%ROWTYPE;
  v_m memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM membership_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_p.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = 'P0001';
  END IF;
  IF v_p.amount <= 0 THEN
    RAISE EXCEPTION 'nothing_to_pay' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_m FROM memberships WHERE id = v_p.membership_id;

  UPDATE membership_periods SET paid_at = now() WHERE id = p_period_id;

  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','membership_payment_received','account','cash','direction','debit',
      'amount', v_p.amount,
      'membership_id', v_m.id, 'membership_period_id', v_p.id, 'user_id', v_m.user_id,
      'created_by', p_actor,
      'description', 'Membership ' || v_m.membership_code || ' month ' || v_p.period_no || ' paid'
    ),
    jsonb_build_object(
      'event_type','membership_payment_received','account','unearned_revenue','direction','credit',
      'amount', v_p.amount,
      'membership_id', v_m.id, 'membership_period_id', v_p.id, 'user_id', v_m.user_id,
      'created_by', p_actor,
      'description', 'Membership ' || v_m.membership_code || ' month ' || v_p.period_no || ' not yet served'
    )
  ));
END;
$function$;

/** Settles every unpaid period of a membership — a yearly fee paid up front. */
CREATE OR REPLACE FUNCTION public.settle_membership_payment(
  p_membership_id uuid,
  p_actor         uuid DEFAULT NULL
)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE v_id uuid; v_count integer := 0;
BEGIN
  PERFORM generate_membership_periods(p_membership_id);

  FOR v_id IN
    SELECT id FROM membership_periods
     WHERE membership_id = p_membership_id AND paid_at IS NULL
     ORDER BY period_no
  LOOP
    PERFORM settle_membership_period_payment(v_id, p_actor);
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE memberships
       SET payment_status = 'paid',
           status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
     WHERE id = p_membership_id;
  END IF;

  RETURN v_count;
END;
$function$;

-- ─── 7. Revenue, once the month has been served ─────────────────────────────

CREATE OR REPLACE FUNCTION public.settle_membership_period_revenue(
  p_period_id uuid,
  p_actor     uuid DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_p membership_periods%ROWTYPE;
  v_m memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM membership_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'period_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_p.recognised_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_recognised' USING ERRCODE = 'P0001';
  END IF;
  -- The liability being released has to exist first.
  IF v_p.paid_at IS NULL THEN
    RAISE EXCEPTION 'not_paid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_m FROM memberships WHERE id = v_p.membership_id;

  UPDATE membership_periods SET recognised_at = now() WHERE id = p_period_id;

  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','membership_revenue_earned','account','unearned_revenue','direction','debit',
      'amount', v_p.amount,
      'membership_id', v_m.id, 'membership_period_id', v_p.id, 'user_id', v_m.user_id,
      'created_by', p_actor,
      'description', 'Membership ' || v_m.membership_code || ' month ' || v_p.period_no || ' served'
    ),
    jsonb_build_object(
      'event_type','membership_revenue_earned','account','revenue_membership','direction','credit',
      'amount', v_p.amount,
      'membership_id', v_m.id, 'membership_period_id', v_p.id, 'user_id', v_m.user_id,
      'created_by', p_actor,
      'description', 'Membership revenue, ' || v_m.membership_code || ' month ' || v_p.period_no
    )
  ));
END;
$function$;

/**
 * Recognises every membership month that has ended and been paid for.
 *
 * "Ended" is judged in Asia/Jakarta, not UTC. current_date on this server is
 * UTC, which is seven hours behind: for the first seven hours of a Jakarta
 * day it names yesterday, and a month ending on the 14th would stay
 * unrecognised through the morning of the 15th.
 */
CREATE OR REPLACE FUNCTION public.recognise_due_membership_periods(
  p_actor uuid DEFAULT NULL
)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE v_id uuid; v_count integer := 0; v_today date;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  FOR v_id IN
    SELECT id FROM membership_periods
     WHERE recognised_at IS NULL
       AND paid_at IS NOT NULL
       AND ends_on < v_today
     ORDER BY ends_on, period_no
  LOOP
    PERFORM settle_membership_period_revenue(v_id, p_actor);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- ─── 8. Who may call the money functions ────────────────────────────────────
--
-- Revoked from PUBLIC *and* from anon and authenticated by name. Both halves
-- are needed and neither alone is enough: Postgres grants EXECUTE on a new
-- function to PUBLIC, and Supabase's default privileges for this schema add
-- explicit grants to anon and authenticated on top. Revoking only from
-- PUBLIC leaves `anon=X/postgres` sitting in the ACL — which is what the
-- first attempt here did, and the test caught it.
--
-- The functions below were ALL callable by anon before this migration,
-- post_ledger_entries included. Checked rather than assumed: a PostgREST RPC
-- call with the publishable key reaches the function and is then refused by
-- row-level security on ledger_entries, because none of these is SECURITY
-- DEFINER and so each runs as the caller. So this was a missing second layer,
-- not an open door — but the only thing standing between a stranger and the
-- books was one policy on one table, and that is a thinner margin than
-- double-entry bookkeeping deserves.
--
-- Safe to revoke: every one of these is called through createAdminClient(),
-- which is service_role. Checked across src/ before writing this.
--
-- Read-only report functions are deliberately left alone. The gap being
-- closed is about writing money, and widening the change widens what can
-- break.

REVOKE ALL ON FUNCTION public.generate_membership_periods(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_membership_period_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_membership_payment(uuid, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_membership_period_revenue(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recognise_due_membership_periods(uuid)       FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_membership_periods(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_membership_period_payment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_membership_payment(uuid, uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_membership_period_revenue(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recognise_due_membership_periods(uuid)       TO service_role;

-- The ones that were already there, hardened the same way.
REVOKE ALL ON FUNCTION public.post_ledger_entries(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_booking_if_available(uuid, uuid, date, date, integer, numeric, numeric, numeric, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_unit_reservation_if_available(uuid, uuid, timestamptz, timestamptz, integer, numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_booking_payment(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_booking_completion(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_booking_cancellation(uuid, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_consultation_payment(uuid, uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_consultation_completion(uuid, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_placement_payment(uuid, uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_placement_recorded(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_viewing_deposit(uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_viewing_attendance(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_viewing_no_show(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_viewing_refund(uuid, uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_unit_reservation_payment(uuid, uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_unit_reservation_completion(uuid, uuid)  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.post_ledger_entries(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_booking_if_available(uuid, uuid, date, date, integer, numeric, numeric, numeric, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_unit_reservation_if_available(uuid, uuid, timestamptz, timestamptz, integer, numeric, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_booking_payment(uuid, uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_booking_completion(uuid, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_booking_cancellation(uuid, uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_consultation_payment(uuid, uuid)         TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_consultation_completion(uuid, uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_placement_payment(uuid, uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_placement_recorded(uuid, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_viewing_deposit(uuid, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_viewing_attendance(uuid, uuid)           TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_viewing_no_show(uuid, uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_viewing_refund(uuid, uuid)               TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_unit_reservation_payment(uuid, uuid)     TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_unit_reservation_completion(uuid, uuid)  TO service_role;

-- ─── What this slice deliberately does NOT do ───────────────────────────────
--
-- Refunds. membership_refund_issued is in the event list because a cancelled
-- membership with months paid in advance has to give them back, and widening
-- that CHECK later is a migration of its own. There is no function for it:
-- what gets returned on cancellation is a policy nobody has written, and
-- guessing it would put a number in the books that no one agreed to.
--
-- Third-party site revenue sharing. As with reservations, every rupiah here
-- is recognised as Cosystem's own. A membership sold at a site whose owner_id
-- is not Cosystem's own owner record would credit us with someone else's
-- income. §20 material, same blocker.
