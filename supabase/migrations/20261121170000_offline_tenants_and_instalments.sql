-- ============================================================================
-- Two gaps the first real data exposed, within an hour of the table existing.
--
-- 1. A reservation required a signed-up app user. Both of Co&co Lokalima's
--    tenants are paper contracts — a radio company and a private consultant,
--    neither of whom has an account. Forcing them in means fabricating auth
--    users for people who never signed up.
--
-- 2. There was nowhere to put the payment schedule. The register has a real
--    unpaid instalment: Rp25.000.000 due 2026-12-28. An operator dashboard
--    that cannot show that is decoration.
-- ============================================================================

-- ─── 1. Tenants who are not users ───────────────────────────────────────────
--
-- Two ways a unit gets held, and the model has to admit both:
--
--   a self-serve booking -> user_id, the account that made it
--   a signed contract    -> tenant_name, and whatever contact exists on paper
--
-- user_id becomes nullable, and a CHECK requires one or the other. Nullable
-- without that check would let a reservation exist belonging to nobody, which
-- is worse than the problem being fixed.

ALTER TABLE public.unit_reservations ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.unit_reservations ADD COLUMN tenant_name    text;
ALTER TABLE public.unit_reservations ADD COLUMN tenant_contact text;
ALTER TABLE public.unit_reservations ADD COLUMN contract_ref   text;

ALTER TABLE public.unit_reservations
  ADD CONSTRAINT unit_reservations_has_a_holder_check
  CHECK (user_id IS NOT NULL OR nullif(btrim(coalesce(tenant_name, '')), '') IS NOT NULL);

COMMENT ON COLUMN public.unit_reservations.tenant_name IS
  'Who holds the unit when it is a signed contract rather than an account. One of this or user_id must be present.';
COMMENT ON COLUMN public.unit_reservations.contract_ref IS
  'The operator''s own contract number, e.g. 006/PMK/OPS/SK-DU/XI/2026. Not generated here; it comes from their paperwork.';

-- ─── 2. The payment schedule ────────────────────────────────────────────────
--
-- A year's rent paid in two instalments is two obligations with two dates, and
-- flattening them into one total_price loses the only thing an operator needs
-- to act on: what is owed, and when.
--
-- DELIBERATELY NOT WIRED TO THE LEDGER YET. settle_unit_reservation_payment
-- posts the whole total_price at once; an instalment is a part of it. Whether
-- unearned_revenue is released per instalment or per period of occupancy is an
-- accounting decision, not one to infer from a spreadsheet — so marking an
-- instalment paid here records the fact and posts nothing. The money is still
-- recognised through the settle_* functions when that decision is made.
--
-- Saying so here rather than quietly double-counting it later.

CREATE TABLE public.reservation_instalments (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES public.unit_reservations(id) ON DELETE CASCADE,

  -- 1 of 2, 2 of 2. Ordering is the operator's, not derived from dates, since
  -- a rescheduled instalment keeps its place in the agreement.
  seq            integer NOT NULL,
  due_date       date    NOT NULL,
  amount         numeric NOT NULL,

  paid_at        date,
  status         text NOT NULL DEFAULT 'due',
  notes          text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservation_instalments_seq_key    UNIQUE (reservation_id, seq),
  CONSTRAINT reservation_instalments_seq_check  CHECK (seq > 0),
  CONSTRAINT reservation_instalments_amount_check CHECK (amount > 0),
  CONSTRAINT reservation_instalments_status_check
    CHECK (status = ANY (ARRAY['due'::text, 'paid'::text, 'waived'::text, 'cancelled'::text])),

  -- Paid means a date. The two cannot drift apart into "paid, we think".
  CONSTRAINT reservation_instalments_paid_has_date_check
    CHECK ((status = 'paid') = (paid_at IS NOT NULL))
);

CREATE INDEX idx_instalments_reservation ON public.reservation_instalments USING btree (reservation_id);
CREATE INDEX idx_instalments_due         ON public.reservation_instalments USING btree (due_date) WHERE (status = 'due');

CREATE TRIGGER reservation_instalments_set_updated_at
  BEFORE UPDATE ON public.reservation_instalments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.reservation_instalments IS
  'What is owed on a reservation and when. Records payment; does not post to the ledger — see the comment in this migration.';

-- Same reasoning as unit_reservations: a payment schedule names a tenant and
-- what they owe. No grant to anon or authenticated.
ALTER TABLE public.reservation_instalments ENABLE ROW LEVEL SECURITY;
