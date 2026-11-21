-- 039: remember what a saved unit cost when it was saved.
--
-- A saved list that only shows today's price cannot answer the question people
-- actually save things for: has this got cheaper? saved_at already existed;
-- the price it was saved at did not, so every existing row is backfilled from
-- the current rate — the only figure available retrospectively, and marked as
-- such by the fact that it will show zero change.

ALTER TABLE saved_listings
  ADD COLUMN IF NOT EXISTS saved_price numeric(12,0);

-- saved_at exists already but has no default on older rows.
ALTER TABLE saved_listings
  ALTER COLUMN saved_at SET DEFAULT now();

COMMENT ON COLUMN saved_listings.saved_price IS
  'Price at the moment of saving. For short-stay units the nightly rate, otherwise the monthly price. Backfilled from the current rate for rows that predate this column.';

UPDATE saved_listings s
   SET saved_price = COALESCE(
         (SELECT r.price_per_night FROM short_stay_rates r WHERE r.property_id = s.property_id),
         (SELECT p.price_monthly   FROM properties p       WHERE p.id = s.property_id)
       )
 WHERE s.saved_price IS NULL;

UPDATE saved_listings SET saved_at = now() WHERE saved_at IS NULL;
