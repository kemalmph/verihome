-- 028: a platform-wide default commission rate, and a per-booking snapshot.
--
-- Until now platform_commission_pct had to be set on every property by hand.
-- A property with NULL posts its whole rent to owner_payable and VeriHome
-- recognises nothing, so an unset rate is silent lost revenue. A default makes
-- the common case correct without touching each listing.
--
-- WHY THE RATE IS SNAPSHOT ONTO THE BOOKING
--
-- Revenue is recognised at check-out, which can be months after the booking is
-- made. If posting read the default live, changing the default would reprice
-- every booking still in flight — a stay sold under 15% would be settled at
-- 20% and the owner would be paid less than was agreed. The commission rate is
-- a contract term fixed when the booking is taken, not when the stay ends.
--
-- Resolution order at INSERT, frozen from then on:
--   properties.platform_commission_pct  (explicit per-property rate)
--   platform_settings.default_commission_pct
--   NULL, which still posts everything to the owner and flags the booking.
--
-- A trigger does this rather than the two create_booking_* RPCs, so it also
-- covers any path added later — and avoids widening those signatures, which is
-- what produced the overload collision repaired in migration 015.

-- ── Platform settings, a single row ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id                     int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_commission_pct numeric(5,2)
    CHECK (default_commission_pct IS NULL OR default_commission_pct BETWEEN 0 AND 100),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES users(id)
);

COMMENT ON TABLE platform_settings IS
  'Single-row platform configuration. The id = 1 check makes a second row impossible.';
COMMENT ON COLUMN platform_settings.default_commission_pct IS
  'VeriHome share of rent for properties with no explicit rate, percent. Applied when a booking is created and frozen onto it; changing this never reprices an existing booking.';

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- No policies: service role only, like ledger_entries. Reached through the
-- admin client behind requireAdmin().

INSERT INTO platform_settings (id, default_commission_pct)
VALUES (1, 15)
ON CONFLICT (id) DO NOTHING;

-- ── The snapshot column ─────────────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2)
    CHECK (commission_pct IS NULL OR commission_pct BETWEEN 0 AND 100);

COMMENT ON COLUMN bookings.commission_pct IS
  'Commission rate agreed when this booking was created, resolved from the property then the platform default. Frozen: later changes to either must not alter how this booking settles.';

CREATE OR REPLACE FUNCTION snapshot_booking_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_pct numeric(5,2);
BEGIN
  -- An explicit value passed by the caller always wins; this only fills a gap.
  IF NEW.commission_pct IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT platform_commission_pct INTO v_pct
    FROM properties WHERE id = NEW.property_id;

  IF v_pct IS NULL THEN
    SELECT default_commission_pct INTO v_pct
      FROM platform_settings WHERE id = 1;
  END IF;

  NEW.commission_pct := v_pct;   -- may still be NULL, which stays a flagged booking
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_booking_commission ON bookings;
CREATE TRIGGER trg_snapshot_booking_commission
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_booking_commission();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Existing bookings predate the column. Settling them has to use some rate, and
-- the resolution order above is the same one they would have got. Bookings
-- already completed are left alone: their entries are posted and immutable, so
-- writing a rate here would only disagree with the ledger.
UPDATE bookings b
   SET commission_pct = COALESCE(
         (SELECT platform_commission_pct FROM properties p WHERE p.id = b.property_id),
         (SELECT default_commission_pct  FROM platform_settings WHERE id = 1)
       )
 WHERE b.commission_pct IS NULL
   AND b.status <> 'completed';
