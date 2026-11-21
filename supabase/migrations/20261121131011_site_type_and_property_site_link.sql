-- ============================================================================
-- Two additions. Both are additive: no existing column changes, no data moves.
--
-- 1. sites.site_type — what kind of building this is.
-- 2. properties.site_id — an optional link from a rental listing to the
--    building it sits in.
-- ============================================================================

-- ─── 1. sites.site_type ─────────────────────────────────────────────────────
--
-- One value today: 'coworking'. Kosan, hostel and event space are on the
-- roadmap, and they are deliberately NOT in this list yet — a dropdown
-- offering a business line that does not exist is a promise the product
-- cannot keep.
--
-- ADDING A TYPE LATER IS A DROP-THEN-ADD, NEVER AN ALTER:
--
--   ALTER TABLE public.sites DROP CONSTRAINT sites_site_type_check;
--   ALTER TABLE public.sites ADD  CONSTRAINT sites_site_type_check
--     CHECK (site_type = ANY (ARRAY['coworking','kosan','hostel','event_space']));
--
-- and prove the new value by writing a row with it, not by reading the
-- constraint definition back. §19.9 is this project's own account of a CHECK
-- that two migrations wrote code for and neither widened — every write failed,
-- silently, for months. The same list lives in src/lib/coworking/taxonomy.ts
-- and the two have to change together.

ALTER TABLE public.sites ADD COLUMN site_type text NOT NULL DEFAULT 'coworking';

ALTER TABLE public.sites ADD CONSTRAINT sites_site_type_check
  CHECK (site_type = ANY (ARRAY['coworking'::text]));

CREATE INDEX idx_sites_type ON public.sites USING btree (site_type);

COMMENT ON COLUMN public.sites.site_type IS
  'What kind of building. Widening this CHECK is a DROP then ADD, and the new value must be proven by writing it.';

-- ─── 2. properties.site_id ──────────────────────────────────────────────────
--
-- A property is still a property when it happens to sit inside a building we
-- also run: a kost room above a coworking floor is a dwelling, with bedrooms,
-- rules, utilities and an area overview. lettable_units holds none of that, so
-- pushing dwellings into it would mean rebuilding half of property_details
-- inside the coworking module — the mirror of the mistake avoided when sites
-- were kept out of properties.
--
-- Self-management is expressed through ownership, not through which table a
-- row lives in: point owner_id at the Cosystem owner record and set
-- platform_commission_pct = 100. settle_booking_completion then computes
-- margin = rent × 100 / 100 and posts nothing to owner_payable, which is
-- exactly right for an asset we own, with no special case in the ledger.
--
-- NULL is the normal state. Most properties are standalone and always will be.
--
-- ON DELETE SET NULL, not CASCADE: a property carries bookings and ledger
-- entries. Deleting a building must never take a rented home with it — the
-- home simply stops being in a building.

ALTER TABLE public.properties ADD COLUMN site_id uuid;

ALTER TABLE public.properties ADD CONSTRAINT properties_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;

-- Partial: almost every property has site_id NULL, and those rows are not
-- worth indexing.
CREATE INDEX idx_properties_site ON public.properties USING btree (site_id)
  WHERE (site_id IS NOT NULL);

COMMENT ON COLUMN public.properties.site_id IS
  'Optional building this property sits in. NULL for standalone properties, which is most of them.';

-- ─── Grants: deliberately none for site_id ──────────────────────────────────
--
-- properties holds no table-level SELECT for anon or authenticated — it holds
-- a list of columns (§19.12). A column added later is not on that list, so it
-- is unreadable, and that is the behaviour we want here: which building a
-- property sits in is not something the public page asks for.
--
-- Per §19.13 this is the "adding a private column" case: do nothing. If a
-- public page ever needs it, grant it in the same migration that teaches the
-- page to select it:
--
--   GRANT SELECT (site_id) ON public.properties TO anon, authenticated;
--
-- Nothing breaks today: the public selects name their columns, and `select=*`
-- already fails for these roles by design.
