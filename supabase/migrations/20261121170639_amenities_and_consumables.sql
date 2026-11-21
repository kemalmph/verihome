-- ============================================================================
-- Amenities, consumables, and who pays the electricity.
--
-- The owner asked where "COGS or amenities — internet, AC, and a meeting room
-- has aqua" belongs. That is three different things wearing one word, and
-- putting them in one table would make all three useless:
--
--   AMENITY     AC, WiFi, projector, whiteboard.
--               Attached to the room. Not consumed. No quantity, no per-use
--               cost. It describes what you are renting.
--
--   CONSUMABLE  Aqua, coffee, snacks, printing.
--               Consumed per booking. Has a quantity and a cost, sometimes
--               charged on and sometimes bundled into the room rate. It is
--               the thing that decides whether a booking made money.
--
--   FIXED COST  The internet subscription, the electricity bill, cleaning.
--               Monthly, per site, already expressible as expense_operating
--               in the ledger. NOT modelled per room here: splitting a site's
--               electricity across rooms is an allocation, not a measurement,
--               and without sub-meters any per-room figure would be a guess
--               wearing the costume of data. Allocate by area when asked, in
--               a report, where it can be labelled as an estimate.
-- ============================================================================

-- ─── Amenities: what a space has ────────────────────────────────────────────
--
-- A reference table rather than a text[] column, because these will drive
-- filters on a public listing page eventually, and "AC" / "A/C" / "ac" as
-- three different facilities is exactly the mess §10 records for copy that
-- exists more than once. properties.facilities already took the loose route;
-- this does not repeat it.

CREATE TABLE public.amenities (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       text NOT NULL,
  label      text NOT NULL,
  category   text NOT NULL DEFAULT 'other',
  icon       text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT amenities_code_key UNIQUE (code),
  CONSTRAINT amenities_category_check
    CHECK (category = ANY (ARRAY['comfort'::text, 'tech'::text, 'service'::text, 'safety'::text, 'other'::text]))
);

-- Amenities belong to a unit, and some belong to the whole building — a
-- mushola, parking and a pantry are not features of one meeting room. Two
-- join tables rather than one with a nullable key, so neither can point at
-- both or at nothing.
CREATE TABLE public.unit_amenities (
  unit_id    uuid NOT NULL REFERENCES public.lettable_units(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id)      ON DELETE CASCADE,
  notes      text,
  PRIMARY KEY (unit_id, amenity_id)
);

CREATE TABLE public.site_amenities (
  site_id    uuid NOT NULL REFERENCES public.sites(id)     ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  notes      text,
  PRIMARY KEY (site_id, amenity_id)
);

-- The starting vocabulary. Reference data, not anyone's business data, so it
-- belongs in a migration. ON CONFLICT so this migration can be replayed.
INSERT INTO public.amenities (code, label, category, icon) VALUES
  ('ac',             'AC',                    'comfort', 'ac_unit'),
  ('wifi',           'WiFi',                  'tech',    'wifi'),
  ('ethernet',       'LAN / kabel',           'tech',    'settings_ethernet'),
  ('projector',      'Proyektor',             'tech',    'videocam'),
  ('tv_screen',      'TV / layar',            'tech',    'tv'),
  ('whiteboard',     'Whiteboard',            'tech',    'edit_square'),
  ('sound_system',   'Sound system',          'tech',    'speaker'),
  ('power_outlets',  'Stopkontak memadai',    'tech',    'power'),
  ('natural_light',  'Cahaya alami',          'comfort', 'light_mode'),
  ('window',         'Jendela',               'comfort', 'window'),
  ('ergonomic_chair','Kursi ergonomis',       'comfort', 'chair'),
  ('lockable',       'Pintu bisa dikunci',    'safety',  'lock'),
  ('cctv',           'CCTV',                  'safety',  'videocam'),
  ('private_pantry', 'Pantry di dalam',       'service', 'coffee'),
  ('phone_booth',    'Phone booth',           'service', 'call'),
  ('storage',        'Lemari / penyimpanan',  'service', 'inventory_2'),
  ('parking',        'Parkir',                'service', 'local_parking'),
  ('mushola',        'Mushola',               'service', 'mosque'),
  ('pantry',         'Pantry bersama',        'service', 'local_cafe'),
  ('reception',      'Resepsionis',           'service', 'support_agent'),
  ('mail_handling',  'Terima surat & paket',  'service', 'mail'),
  ('printing',       'Printer & scanner',     'service', 'print'),
  ('cleaning',       'Cleaning service',      'service', 'cleaning_services'),
  ('disabled_access','Akses difabel',         'safety',  'accessible')
ON CONFLICT (code) DO NOTHING;

-- ─── Items: one catalogue, used twice ───────────────────────────────────────
--
-- The aqua in a meeting room and the coffee sold at the café are the same
-- kind of thing: a named item with a cost and a price. The owner has already
-- described a café, printing, merchandise and consignment goods as coming
-- later. Building a consumables table now and a POS catalogue later means
-- maintaining the same list twice and watching the two disagree about what a
-- bottle of water costs.
--
-- So: one catalogue, with a `kind` saying how it is used. The café is not
-- built; it will not need a second catalogue when it is.

CREATE TABLE public.items (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id     uuid REFERENCES public.sites(id) ON DELETE CASCADE,  -- NULL = every site

  sku         text,
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'consumable',

  -- "botol", "orang", "lembar", "jam". Free text on purpose: the unit of a
  -- thing is not a closed set, and a wrong guess here forces people to lie.
  unit        text NOT NULL DEFAULT 'pcs',

  cost_price  numeric NOT NULL DEFAULT 0,
  sell_price  numeric NOT NULL DEFAULT 0,

  status      text NOT NULL DEFAULT 'active',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT items_cost_check CHECK (cost_price >= 0),
  CONSTRAINT items_sell_check CHECK (sell_price >= 0),
  CONSTRAINT items_kind_check
    CHECK (kind = ANY (ARRAY['consumable'::text, 'service'::text, 'merchandise'::text])),
  CONSTRAINT items_status_check
    CHECK (status = ANY (ARRAY['active'::text, 'retired'::text]))
);

CREATE UNIQUE INDEX items_site_sku_key ON public.items USING btree (site_id, sku) WHERE (sku IS NOT NULL);
CREATE INDEX idx_items_site ON public.items USING btree (site_id, status);

COMMENT ON TABLE public.items IS
  'One catalogue for anything with a cost and a price: meeting-room consumables now, cafe and merchandise later. sell_price 0 means bundled, not free to the business — cost_price still applies.';

-- ─── What a booking actually consumed ───────────────────────────────────────
--
-- Prices are snapshotted, like everywhere else here: what a booking cost in
-- March must not change when the supplier raises the price of water in April.
--
-- `included` is the distinction that makes this worth having. Two bottles
-- bundled into the room rate and two bottles charged on both cost the
-- business the same and earn it differently, and a margin that cannot tell
-- them apart is not a margin.

CREATE TABLE public.reservation_items (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES public.unit_reservations(id) ON DELETE CASCADE,
  item_id        uuid          REFERENCES public.items(id)             ON DELETE RESTRICT,

  -- Kept even when item_id is set, so a line survives a catalogue tidy-up
  -- with its name intact.
  name           text NOT NULL,
  qty            numeric NOT NULL DEFAULT 1,
  cost_price     numeric NOT NULL DEFAULT 0,
  sell_price     numeric NOT NULL DEFAULT 0,
  included       boolean NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservation_items_qty_check  CHECK (qty > 0),
  CONSTRAINT reservation_items_cost_check CHECK (cost_price >= 0),
  CONSTRAINT reservation_items_sell_check CHECK (sell_price >= 0),
  -- Bundled means not charged. Allowing a price on an included line would let
  -- the same amount be both given away and billed.
  CONSTRAINT reservation_items_included_is_free_check
    CHECK (NOT included OR sell_price = 0)
);

CREATE INDEX idx_reservation_items_reservation ON public.reservation_items USING btree (reservation_id);

-- ─── Who pays the electricity ───────────────────────────────────────────────
--
-- Contract 006 says the tenant pays their own electricity and wifi, with the
-- internet billed on the 20th and electricity on the 10th. Right now that
-- lives in a free-text note, which no report can read — so RO6 looks like
-- every other unit when working out what a let actually earns.
--
-- Default true because included is the normal case; RO6 is the exception and
-- is set below.

ALTER TABLE public.unit_reservations
  ADD COLUMN utilities_included boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.unit_reservations.utilities_included IS
  'False when the tenant pays their own electricity and internet, as contract 006/PMK/OPS/SK-DU/XI/2026 does. Changes what the let actually earns.';

-- ─── updated_at ─────────────────────────────────────────────────────────────

CREATE TRIGGER items_set_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Grants ─────────────────────────────────────────────────────────────────
--
-- Amenities are the only thing here a public listing page would ever want,
-- and it does not need them yet. Nothing is granted: a column granted before
-- a page selects it is a column exposed for no reason (§19.13).

ALTER TABLE public.amenities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_amenities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_amenities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_items ENABLE ROW LEVEL SECURITY;
