-- ============================================================================
-- Prices become monthly, the two money columns get names, and contracts get
-- somewhere to keep their paperwork.
--
-- WHY MONTHLY, AND A BUG IT FIXES
--
-- lettable_units.price held an annual figure, while pricePeriodLabel() in
-- taxonomy.ts already rendered `lease` as "/bulan". So the unit manager has
-- been showing "IDR 42.000.000/bulan" for a room that costs Rp3.500.000 a
-- month — a number twelve times too large, with a confident unit on it.
--
-- The owner asked for monthly. That is also the period the business actually
-- quotes in, and it makes the displayed unit true instead of decorative.
-- ============================================================================

-- ─── 1. The conversion ──────────────────────────────────────────────────────
--
-- Only the modes whose price was annual. An hourly rate of Rp150.000 and a
-- daily rate are already per their own period and must not be touched —
-- dividing them by twelve would be the same mistake in the other direction.
--
-- No rounding here. RO6's contract is Rp50.000.000 a year, which is
-- Rp4.166.666,67 a month, and that is the real number: rounding money someone
-- has signed for is not tidying up, it is changing the figure. numeric holds
-- it exactly.

UPDATE public.lettable_units
   SET price = price / 12
 WHERE price IS NOT NULL
   AND letting_mode IN ('lease', 'monthly');

UPDATE public.unit_reservations
   SET unit_price = unit_price / 12
 WHERE unit_price IS NOT NULL
   AND letting_mode IN ('lease', 'monthly');

-- ─── 2. Naming the three numbers ────────────────────────────────────────────
--
-- They were all "price" and they are three different things. Written down
-- here because the next person to add a column near them needs to know which
-- is which, and because a column comment is the only documentation that
-- cannot drift away from the table.

COMMENT ON COLUMN public.lettable_units.price IS
  'PRICE LIST — the asking rate, per the unit''s own letting_mode period: per hour for hourly, per day for daily, PER MONTH for monthly and lease. Not what any particular tenant pays.';

COMMENT ON COLUMN public.unit_reservations.unit_price IS
  'The rate actually agreed in this contract, in the same period as the unit''s price list. May be below list after a discount; may be above it for a short let.';

COMMENT ON COLUMN public.unit_reservations.total_price IS
  'NILAI KONTRAK — what this contract is worth over its whole term, which is what the instalments add up to. Not a rate: a two-month let at Rp3,5 jt a month has a contract value of Rp7 jt.';

-- ─── 3. Documents ───────────────────────────────────────────────────────────
--
-- A signed contract, an ID card, a floor plan. One table rather than three,
-- with a CHECK that exactly one owner is set.
--
-- This is the opposite choice to unit_amenities / site_amenities, and the
-- difference is real: those two carry no payload and have different primary
-- keys, so separating them cost nothing. A document carries the same eight
-- columns whatever it hangs off, and three near-identical tables would mean
-- three upload routes and three places to forget a permission check.
--
-- STORES THE KEY, NOT THE URL. §11: payment proofs store keys and photos
-- store URLs, and the photos are the ones that break when the R2 public URL
-- changes. These are private documents in the private bucket; a URL is only
-- ever minted as a short-lived presigned link at the moment someone asks.

CREATE TABLE public.coworking_documents (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Exactly one of these. A contract belongs to a contract; a floor plan to a
  -- room; a building permit to the building.
  site_id        uuid REFERENCES public.sites(id)             ON DELETE CASCADE,
  unit_id        uuid REFERENCES public.lettable_units(id)    ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.unit_reservations(id) ON DELETE CASCADE,

  kind           text NOT NULL DEFAULT 'contract',
  title          text,

  -- The object key in the PRIVATE bucket. Never a URL.
  file_key       text NOT NULL,
  file_name      text NOT NULL,
  content_type   text NOT NULL,
  size_bytes     integer NOT NULL,

  uploaded_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT coworking_documents_key_unique UNIQUE (file_key),
  CONSTRAINT coworking_documents_size_check CHECK (size_bytes > 0),
  CONSTRAINT coworking_documents_kind_check
    CHECK (kind = ANY (ARRAY[
      'contract'::text, 'amendment'::text, 'invoice'::text, 'receipt'::text,
      'id_card'::text, 'floor_plan'::text, 'certificate'::text, 'other'::text
    ])),

  -- Exactly one owner. Zero would be an orphan nothing can find; two would be
  -- a document that appears in two places and is deleted from only one.
  CONSTRAINT coworking_documents_one_owner_check
    CHECK (num_nonnulls(site_id, unit_id, reservation_id) = 1)
);

CREATE INDEX idx_cwdocs_reservation ON public.coworking_documents USING btree (reservation_id) WHERE (reservation_id IS NOT NULL);
CREATE INDEX idx_cwdocs_unit        ON public.coworking_documents USING btree (unit_id)        WHERE (unit_id IS NOT NULL);
CREATE INDEX idx_cwdocs_site        ON public.coworking_documents USING btree (site_id)        WHERE (site_id IS NOT NULL);

COMMENT ON TABLE public.coworking_documents IS
  'Paperwork for a site, a unit or a contract. file_key is an object key in the private R2 bucket — never a URL, because a URL outlives the bucket config that made it valid.';

-- A signed contract names people and money. No grant to anon or
-- authenticated, and the exposure audit carries this table.
ALTER TABLE public.coworking_documents ENABLE ROW LEVEL SECURITY;
