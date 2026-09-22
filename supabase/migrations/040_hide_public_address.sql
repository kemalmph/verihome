-- 040: the exact location of a property is not public.
--
-- The public listing page rendered the full street address, and `address` was
-- in the public select. Removing it from that query would have been cosmetic:
-- the anon key ships in the client bundle by design, RLS grants public read on
-- every LIVE property, and a table-level SELECT covers every column. Anyone
-- could read the lot straight from PostgREST:
--
--   GET /rest/v1/properties?select=name,address&status=eq.live
--   [{"name":"Heritage Townhouse – Menteng",
--     "address":"Jl. Imam Bonjol No. 15, Jakarta Pusat"}, ...]
--
-- So the fix is a column grant, not a narrower query. PostgreSQL has no
-- "revoke one column" when table-level SELECT is held — table-level implies all
-- columns — so the grant is dropped and re-issued column by column, omitting
-- the two that pin a building.
--
-- google_maps_url goes with it. It is not rendered on any public page today,
-- but a precise map link discloses exactly what the address does; leaving it
-- readable would undo this the first time somebody filled the field in.
--
-- Nothing legitimate loses access. Every surface that genuinely needs the
-- address — the admin console, the owner portal, the guest unit page after a
-- booking is confirmed — reads through the SERVICE ROLE client, which these
-- grants do not touch.

REVOKE SELECT ON public.properties FROM anon, authenticated;

GRANT SELECT (
  id, name, slug, property_type, status, submission_type,
  price_monthly, area, size_sqm, bedrooms, bathrooms,
  available_from, min_stay_months, owner_id,
  approved_at, published_at, created_at, updated_at,
  photo_urls, rejection_reason,
  rental_mode, is_furnished, is_instant_bookable,
  platform_commission_pct, cleaning_fee_goes_to
) ON public.properties TO anon, authenticated;

COMMENT ON COLUMN public.properties.address IS
  'Exact street address. NOT readable by anon or authenticated: see migration 040. Revealed only through the service role, after a booking is confirmed (guest), or to the property owner and admins.';

COMMENT ON COLUMN public.properties.google_maps_url IS
  'Precise map pin. Withheld from public roles for the same reason as address.';
