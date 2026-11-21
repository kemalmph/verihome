-- ============================================================================
-- Coworking, slice 1: sites and the things inside them that earn money.
--
-- A site is a building. It has no price and cannot be booked. What earns money
-- is a lettable unit inside it — a hot desk, a meeting room, a retail lot, or
-- the café's own floor space.
--
-- WHY THESE ARE NOT `properties`
-- `properties` carries the rental pipeline: nine statuses from new_lead to
-- archived, an eight-item publish_checklist, an eight-dimension RLA, a
-- rental_mode and a min_stay_months. A coworking site passes through none of
-- it, and a building is not a listing — it is a container for many of them.
-- Sharing the table would mean every rental query learning to filter out rows
-- that are not rentals, and the publish checklist becoming meaningless for
-- half the table. The seven existing rental properties stay exactly where they
-- are.
--
-- WHAT IS SHARED, deliberately: owners, users and the ledger. That is what
-- makes this one system rather than two applications in one repository.
--
-- NOT IN THIS MIGRATION
--   * Bookings of units. Hourly booking needs check_in_date/check_out_date to
--     become timestamps, which touches the live booking RPCs — its own slice.
--   * Retail / point of sale (food, tickets, merchandise, printing,
--     consignment). A separate subsystem: it needs stock, cost of goods, and
--     consignment splits. Note for whoever builds it: consignment income is
--     NOT revenue — it follows the owner_payable pattern already in the
--     ledger, and ledger_entries.account is a closed CHECK list that will need
--     widening (see §19.9 for how that goes wrong quietly).
-- ============================================================================

-- ─── sites ──────────────────────────────────────────────────────────────────

CREATE TABLE public.sites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  owner_id uuid,
  area text,
  address text,
  google_maps_url text,
  status text NOT NULL DEFAULT 'draft',
  -- NULL opening/closing means the site is open around the clock. Stored as
  -- local wall-clock time: everything here is WIB and a site's opening hour
  -- does not shift with the clock elsewhere.
  opening_time time without time zone,
  closing_time time without time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ADD CONSTRAINT sites_pkey PRIMARY KEY (id);
ALTER TABLE public.sites ADD CONSTRAINT sites_slug_key UNIQUE (slug);
ALTER TABLE public.sites ADD CONSTRAINT sites_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES owners(id);
ALTER TABLE public.sites ADD CONSTRAINT sites_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text]));
ALTER TABLE public.sites ADD CONSTRAINT sites_hours_check
  CHECK (
    (opening_time IS NULL AND closing_time IS NULL)
    OR (opening_time IS NOT NULL AND closing_time IS NOT NULL)
  );

CREATE INDEX idx_sites_owner ON public.sites USING btree (owner_id);
CREATE INDEX idx_sites_status ON public.sites USING btree (status);

COMMENT ON TABLE public.sites IS
  'A coworking building. Not priced and not bookable; lettable_units inside it are.';

-- ─── lettable_units ─────────────────────────────────────────────────────────
--
-- unit_type says what it is. letting_mode says how it is let, and that is the
-- axis that actually changes behaviour: an hourly meeting room and a retail
-- lot on a three-year lease are far further apart than two rooms are.

CREATE TABLE public.lettable_units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  name text NOT NULL,
  unit_type text NOT NULL,
  letting_mode text NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  floor text,
  size_sqm numeric,
  -- IDR, per the letting_mode's period. numeric(12,0) like every other money
  -- column here: the rupiah has no circulating sub-unit (§2).
  -- NULL means not priced yet, which is why this is not NOT NULL.
  price numeric(12,0),
  -- Whether the unit can be let at all. Deliberately NOT whether someone is in
  -- it right now: occupancy is derived from bookings, and a stored copy of it
  -- would drift the first time a booking was cancelled outside this column's
  -- knowledge. The dashboard computes occupancy; it does not read it.
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_pkey PRIMARY KEY (id);
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_site_name_key
  UNIQUE (site_id, name);
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_unit_type_check
  CHECK (unit_type = ANY (ARRAY[
    'hot_desk'::text, 'dedicated_desk'::text, 'private_room'::text,
    'meeting_room'::text, 'event_space'::text, 'retail_lot'::text,
    'cafe'::text, 'storage'::text
  ]));
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_letting_mode_check
  CHECK (letting_mode = ANY (ARRAY[
    'hourly'::text, 'daily'::text, 'monthly'::text, 'lease'::text
  ]));
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_status_check
  CHECK (status = ANY (ARRAY[
    'available'::text, 'maintenance'::text, 'retired'::text
  ]));
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_capacity_check
  CHECK (capacity > 0);
ALTER TABLE public.lettable_units ADD CONSTRAINT lettable_units_price_check
  CHECK (price IS NULL OR price >= 0);

CREATE INDEX idx_lettable_units_site ON public.lettable_units USING btree (site_id);
CREATE INDEX idx_lettable_units_type ON public.lettable_units USING btree (site_id, unit_type);
-- Partial: the dashboard's capacity figures only ever count lettable stock,
-- and retired units accumulate forever.
CREATE INDEX idx_lettable_units_available ON public.lettable_units USING btree (site_id)
  WHERE (status = 'available'::text);

COMMENT ON TABLE public.lettable_units IS
  'Anything inside a site that earns money from space. status is lettability, not occupancy.';
COMMENT ON COLUMN public.lettable_units.status IS
  'available | maintenance | retired. Occupancy is derived from bookings, never stored here.';

-- ─── updated_at ─────────────────────────────────────────────────────────────
-- Reuses the existing set_updated_at() rather than declaring another.

CREATE TRIGGER sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER lettable_units_updated_at
  BEFORE UPDATE ON public.lettable_units
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Security ───────────────────────────────────────────────────────────────
-- RLS on with no policies: the service role is the only reader and writer,
-- which is the posture of every internal table here (§2). Nothing coworking is
-- public yet. When a site listing does go public, add a read policy then —
-- and check what `select=*` returns as anon before believing it (§19.12).

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lettable_units ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.sites TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lettable_units TO anon, authenticated, service_role;
