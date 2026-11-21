-- ============================================================================
-- Memberships, and an internal event calendar.
--
-- Two things that look alike and are not:
--
--   a reservation holds one unit for one period
--   a membership is an ongoing relationship with a SITE, carrying entitlements
--
-- The owner already sells memberships without calling them that: the Virtual
-- Office packages are annual, with Daily Pass 1x/bulan, Flex 2, Flex 5 /
-- Meeting Room, hot-seat access and a discount on events and meeting rooms.
-- The product exists; this is the model catching up.
--
-- "Assign a user to a site" was the obvious shape and the wrong one: no
-- period, no plan, no price, no end, and no way for one person to belong to
-- two sites once there is more than one.
-- ============================================================================

-- ─── Plans ──────────────────────────────────────────────────────────────────
--
-- Entitlements are named columns, not a key/value table. The list is small and
-- knowable — passes, hours, a discount, a few booleans — and a generic bag
-- would be a soft schema nothing validates, which is the failure §10 records
-- for copy and §19.9 for CHECK lists.

CREATE TABLE public.membership_plans (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- NULL means the plan is sold at every site. A plan tied to one building
  -- names it.
  site_id     uuid REFERENCES public.sites(id) ON DELETE CASCADE,

  name        text NOT NULL,
  price       numeric NOT NULL,
  period      text NOT NULL DEFAULT 'monthly',
  status      text NOT NULL DEFAULT 'active',

  -- What the member gets. Zero means none, which is different from NULL
  -- meaning unknown — so none of these is nullable.
  day_passes_per_month         integer NOT NULL DEFAULT 0,
  meeting_room_hours_per_month numeric NOT NULL DEFAULT 0,
  hot_desk_included            boolean NOT NULL DEFAULT false,
  discount_pct                 numeric NOT NULL DEFAULT 0,
  mail_handling                boolean NOT NULL DEFAULT false,
  address_use                  boolean NOT NULL DEFAULT false,

  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT membership_plans_price_check    CHECK (price >= 0),
  CONSTRAINT membership_plans_passes_check   CHECK (day_passes_per_month >= 0),
  CONSTRAINT membership_plans_hours_check    CHECK (meeting_room_hours_per_month >= 0),
  CONSTRAINT membership_plans_discount_check CHECK (discount_pct >= 0 AND discount_pct <= 100),
  CONSTRAINT membership_plans_period_check
    CHECK (period = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  CONSTRAINT membership_plans_status_check
    CHECK (status = ANY (ARRAY['active'::text, 'retired'::text]))
);

CREATE INDEX idx_membership_plans_site ON public.membership_plans USING btree (site_id);

-- ─── Memberships ────────────────────────────────────────────────────────────
--
-- The holder is a PERSON. The owner was explicit: a member is a person, while
-- a tenant on a lease may be a company. So there is one holder here, and
-- company_name is who the invoice goes to — not a second kind of member.
--
-- Same dual-holder pattern as unit_reservations, for the same reason: some
-- people have accounts and some are a name on a form.
--
-- The entitlements are COPIED from the plan at purchase, not read through it.
-- Editing a plan must not silently change what someone already bought — the
-- same rule that freezes commission_pct on a booking (§12) and unit_price on
-- a reservation.

CREATE TABLE public.memberships (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_code text NOT NULL,

  site_id         uuid NOT NULL REFERENCES public.sites(id)            ON DELETE RESTRICT,
  plan_id         uuid          REFERENCES public.membership_plans(id) ON DELETE SET NULL,

  user_id         uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  member_name     text,
  member_contact  text,
  /** Who it is billed to, when a company pays for a person's membership. */
  company_name    text,

  -- Day granularity: a membership runs from a date to a date. Hours belong to
  -- reservations, not to this.
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,

  price           numeric NOT NULL,
  period          text NOT NULL,

  -- Snapshot of the plan at purchase.
  day_passes_per_month         integer NOT NULL DEFAULT 0,
  meeting_room_hours_per_month numeric NOT NULL DEFAULT 0,
  hot_desk_included            boolean NOT NULL DEFAULT false,
  discount_pct                 numeric NOT NULL DEFAULT 0,
  mail_handling                boolean NOT NULL DEFAULT false,
  address_use                  boolean NOT NULL DEFAULT false,

  status          text NOT NULL DEFAULT 'pending',
  payment_status  text NOT NULL DEFAULT 'unpaid',
  auto_renew      boolean NOT NULL DEFAULT false,

  contract_ref    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT memberships_code_key UNIQUE (membership_code),

  CONSTRAINT memberships_has_a_holder_check
    CHECK (user_id IS NOT NULL OR nullif(btrim(coalesce(member_name, '')), '') IS NOT NULL),
  CONSTRAINT memberships_period_order_check CHECK (ends_on >= starts_on),
  CONSTRAINT memberships_price_check        CHECK (price >= 0),
  CONSTRAINT memberships_discount_check     CHECK (discount_pct >= 0 AND discount_pct <= 100),
  CONSTRAINT memberships_passes_check       CHECK (day_passes_per_month >= 0),
  CONSTRAINT memberships_hours_check        CHECK (meeting_room_hours_per_month >= 0),
  CONSTRAINT memberships_period_check
    CHECK (period = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  CONSTRAINT memberships_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'cancelled'::text])),
  CONSTRAINT memberships_payment_status_check
    CHECK (payment_status = ANY (ARRAY['unpaid'::text, 'pending_verification'::text, 'paid'::text, 'refunded'::text]))
);

CREATE UNIQUE INDEX memberships_contract_ref_key
  ON public.memberships USING btree (contract_ref) WHERE (contract_ref IS NOT NULL);
CREATE INDEX idx_memberships_site   ON public.memberships USING btree (site_id, status);
CREATE INDEX idx_memberships_user   ON public.memberships USING btree (user_id);
CREATE INDEX idx_memberships_period ON public.memberships USING btree (starts_on, ends_on);

COMMENT ON TABLE public.memberships IS
  'An ongoing relationship with a site. Holder is a person; company_name is who pays. Entitlements are copied from the plan at purchase so a plan edit cannot change what someone bought.';

-- Two active memberships for the same person at the same site overlapping in
-- time is almost certainly a mistake, but not always — an upgrade can overlap
-- by a day. Left unconstrained ON PURPOSE rather than guessed at; the admin
-- action warns. Recorded here so the next person knows it was a decision.

-- ─── Events: an internal calendar ───────────────────────────────────────────
--
-- AN EVENT DOES NOT BLOCK A ROOM. It books one through unit_reservations.
--
-- If events had their own schedule as well, two tables would each claim the
-- same room and would eventually disagree. The exclusion constraint on
-- unit_reservations only defends unit_reservations, so every hold on a space
-- has to pass through it. An event with no reservation is a note in a
-- calendar; an event with reservations actually holds the space.
--
-- No ticketing, no registrations: the owner asked for an internal calendar
-- first, and the smaller thing that works beats the larger one that is half
-- finished.

CREATE TABLE public.events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id     uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,

  title       text NOT NULL,
  description text,

  -- The public-facing window. Deliberately allowed to differ from the
  -- reservations that hold the space: the hall is booked 17:00–22:00 so that
  -- an event can run 18:00–21:00 with setup and teardown around it. That is
  -- information, not drift — but it does mean the event window must sit
  -- inside the booked time, which event_space_gaps() below checks.
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,

  -- Who is running it. A member, the operator, or an outside party.
  host_name       text,
  host_user_id    uuid REFERENCES public.users(id)       ON DELETE SET NULL,
  host_membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,

  expected_attendees integer,
  status      text NOT NULL DEFAULT 'draft',
  visibility  text NOT NULL DEFAULT 'internal',
  notes       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT events_time_order_check CHECK (ends_at > starts_at),
  CONSTRAINT events_attendees_check  CHECK (expected_attendees IS NULL OR expected_attendees >= 0),
  CONSTRAINT events_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'cancelled'::text, 'done'::text])),
  CONSTRAINT events_visibility_check
    CHECK (visibility = ANY (ARRAY['internal'::text, 'members'::text, 'public'::text]))
);

CREATE INDEX idx_events_site_time ON public.events USING btree (site_id, starts_at);

COMMENT ON TABLE public.events IS
  'Internal calendar. An event holds space only through unit_reservations.event_id — it has no schedule of its own that blocks a room.';

-- ─── Tying reservations to events and memberships ───────────────────────────

ALTER TABLE public.unit_reservations
  ADD COLUMN event_id      uuid REFERENCES public.events(id)      ON DELETE SET NULL,
  ADD COLUMN membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL;

CREATE INDEX idx_unit_reservations_event      ON public.unit_reservations USING btree (event_id)      WHERE (event_id IS NOT NULL);
CREATE INDEX idx_unit_reservations_membership ON public.unit_reservations USING btree (membership_id) WHERE (membership_id IS NOT NULL);

COMMENT ON COLUMN public.unit_reservations.event_id IS
  'The event this booking is holding space for. One event may hold several units (hall plus breakout rooms).';
COMMENT ON COLUMN public.unit_reservations.membership_id IS
  'The membership this booking draws entitlement from. Usage is computed from these rows, never stored as a balance.';

-- ─── Is the event actually inside the space it booked? ──────────────────────
--
-- Returns the parts of an event's window that no reservation of its own
-- covers. Empty means the event is fully inside booked time.
--
-- A function rather than a constraint because the answer depends on several
-- rows of another table at once, which a CHECK cannot see and a trigger could
-- only approximate. The admin action calls this and refuses to publish an
-- event with gaps; being honest that the enforcement lives there, not here.

CREATE OR REPLACE FUNCTION public.event_space_gaps(p_event_id uuid)
 RETURNS TABLE (gap_start timestamptz, gap_end timestamptz)
 LANGUAGE sql
 STABLE
AS $function$
  WITH e AS (
    SELECT starts_at, ends_at FROM public.events WHERE id = p_event_id
  ),
  booked AS (
    SELECT range_agg(tstzrange(r.starts_at, r.ends_at)) AS covered
      FROM public.unit_reservations r
     WHERE r.event_id = p_event_id
       AND r.status IN ('pending', 'confirmed')
  )
  SELECT lower(g), upper(g)
    FROM e,
         booked,
         unnest(
           multirange(tstzrange(e.starts_at, e.ends_at))
           - COALESCE(booked.covered, '{}'::tstzmultirange)
         ) AS g;
$function$;

COMMENT ON FUNCTION public.event_space_gaps(uuid) IS
  'Parts of an event window that none of its own reservations cover. Empty means the event is fully inside booked space.';

-- ─── How much of an entitlement has been used ───────────────────────────────
--
-- Derived, never stored. A stored "3 hours left" is a balance that can drift
-- from the bookings it claims to summarise, and there is no way to tell which
-- one is wrong afterwards. Same reasoning as the ledger: keep the events, read
-- the total.
--
-- The month is a Jakarta month. Using UTC would move every booking made after
-- 17:00 into the next month, which is a quiet way to give away free hours.

CREATE OR REPLACE FUNCTION public.membership_usage(p_membership_id uuid, p_month date)
 RETURNS TABLE (meeting_room_hours numeric, day_passes integer)
 LANGUAGE sql
 STABLE
AS $function$
  WITH bounds AS (
    SELECT (date_trunc('month', p_month::timestamp) AT TIME ZONE 'Asia/Jakarta')                       AS from_ts,
           ((date_trunc('month', p_month::timestamp) + interval '1 month') AT TIME ZONE 'Asia/Jakarta') AS to_ts
  ),
  used AS (
    SELECT u.letting_mode, r.starts_at, r.ends_at
      FROM public.unit_reservations r
      JOIN public.lettable_units u ON u.id = r.unit_id
         , bounds b
     WHERE r.membership_id = p_membership_id
       AND r.status IN ('pending', 'confirmed', 'completed')
       AND r.starts_at >= b.from_ts
       AND r.starts_at <  b.to_ts
  )
  SELECT
    COALESCE(SUM(EXTRACT(epoch FROM (ends_at - starts_at)) / 3600.0)
               FILTER (WHERE letting_mode = 'hourly'), 0)::numeric(10,2),
    COALESCE(COUNT(*) FILTER (WHERE letting_mode = 'daily'), 0)::integer
  FROM used;
$function$;

COMMENT ON FUNCTION public.membership_usage(uuid, date) IS
  'Entitlement consumed in a Jakarta calendar month, computed from reservations. Never stored as a balance.';

-- ─── updated_at ─────────────────────────────────────────────────────────────

CREATE TRIGGER membership_plans_set_updated_at BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER memberships_set_updated_at BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Grants: none ───────────────────────────────────────────────────────────
--
-- A membership names a person and what they pay. An internal event calendar
-- says who is in the building and when. Neither is public, and the exposure
-- audit carries all three tables.

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events           ENABLE ROW LEVEL SECURITY;
