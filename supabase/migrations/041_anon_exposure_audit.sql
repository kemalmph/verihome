-- 041: findings from the anon/authenticated exposure audit.
--
-- Method is §19.12's: ask the database what it will answer, as the two roles
-- any visitor can obtain. The anon key ships in the client bundle; an
-- authenticated session is one sign-up away. scripts/audit-anon-exposure.js
-- issues a real select=* against every table and records what comes back.
--
-- The audit found the exposure in one direction and a silent loss in the other.

-- ── A. availability_blocks was world-readable ───────────────────────────────
--
-- policy public_read_blocks was USING (true) — no condition at all. Anyone with
-- the anon key could read every block: which property, which dates, and the
-- booking_id behind it.
--
-- That is occupancy data. It says when a specific home is occupied and, by
-- inversion, when it is empty. The booking_id is a live identifier handed to
-- strangers on top.
--
-- Nothing legitimate breaks. Every reader of this table goes through the
-- SERVICE ROLE: lib/availability.ts (the public date picker's own API route),
-- the admin inventory page, and lib/guest/unit.ts. Checked one by one, not
-- assumed.
DROP POLICY IF EXISTS public_read_blocks ON public.availability_blocks;
REVOKE SELECT ON public.availability_blocks FROM anon, authenticated;

COMMENT ON TABLE public.availability_blocks IS
  'Occupancy. Never readable by anon or authenticated — it says when a home is empty. The public date picker reads it through /api/availability, which uses the service role.';

-- ── B. The public listing page had silently lost its content ────────────────
--
-- rla_assessments, area_overviews, property_details and property_media all had
-- RLS enabled with ZERO policies, which denies everything. They are embedded in
-- the public listing query, so those embeds have been returning empty for the
-- anon role — the page rendered with no assessment, no area overview and no
-- facilities.
--
-- Confirmed against real rows: Garden Terrace Suite has an RLA score of 4.5,
-- "Gondangdia KRL" as its nearest transit and five facilities, and the public
-- page showed none of them. The assessment is the reason a VeriHome listing is
-- worth more than the owner's own photos (§4), and it was not reaching anybody.
--
-- Scoped to LIVE parents only. A draft property's assessment stays private,
-- which is what the properties policy already says for the parent row.
CREATE POLICY public_read_live_rla ON public.rla_assessments
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.status = 'live'));

CREATE POLICY public_read_live_area ON public.area_overviews
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.status = 'live'));

CREATE POLICY public_read_live_details ON public.property_details
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.status = 'live'));

CREATE POLICY public_read_live_media ON public.property_media
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.status = 'live'));

-- property_surveys is deliberately NOT given a policy. It holds surveyor_name,
-- pic_name and pic_whatsapp — real people's contact details — and appears in no
-- public query.

-- ── C. short_stay_rates was readable for every property, live or not ────────
--
-- Rates themselves are public: a guest has to see the nightly price and the
-- security deposit before booking, so those are disclosure, not leakage. But
-- USING (true) also published the pricing of drafts and archived listings.
-- Scoped to live parents, matching every other public read.
DROP POLICY IF EXISTS public_read_rates ON public.short_stay_rates;
CREATE POLICY public_read_live_rates ON public.short_stay_rates
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.status = 'live'));

-- ── Not changed, and why ────────────────────────────────────────────────────
--
-- users             the policy is auth.uid() = id. The audit's select=* with
--                   limit=1 returned a row and looked like a leak; probing
--                   properly showed a guest sees 1 of 21 rows — their own — and
--                   enumerating is_admin=true returns zero. Correct as it
--                   stands. The audit script was wrong, and was fixed.
-- bookings,
-- saved_listings,
-- user_credits      own-row policies, verified the same way.
-- everything else   RLS on with no policies: denies by default.
