-- 036: freeze the cleaning destination, drop dead code, attribute surveys.
--
-- 3a — cleaning_fee_goes_to was the last unfrozen commercial term. Migration
-- 028 froze the commission rate onto the booking so a later change could not
-- reprice a stay already sold; the cleaning destination was left reading live
-- from the property, so flipping it between platform and owner still repriced
-- every stay not yet completed. Same bug, smaller number.
--
-- 3c — expire_unpaid_bookings() was superseded by expire_single_booking() in
-- migration 012 and never dropped. Nothing in the codebase or in any other
-- database function references it (both checked). Dropped with its exact
-- signature, which is zero arguments.
--
-- 3d — property_surveys.surveyor_name is free text prefilled from the session
-- but editable, so there was no way to tell which account produced an
-- assessment. That matters more now survey access is a grantable role.

-- ── 3a ──────────────────────────────────────────────────────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cleaning_fee_goes_to text;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_cleaning_fee_goes_to_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_cleaning_fee_goes_to_check
  CHECK (cleaning_fee_goes_to IS NULL OR cleaning_fee_goes_to IN ('platform','owner'));

COMMENT ON COLUMN bookings.cleaning_fee_goes_to IS
  'Who keeps the cleaning fee, frozen when the booking was taken. Changing the property must not alter how a stay already sold settles.';

-- The existing trigger already freezes commission_pct; extend it rather than
-- adding a second trigger, so there is one place that decides what is frozen.
CREATE OR REPLACE FUNCTION snapshot_booking_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_pct  numeric(5,2);
  v_dest text;
BEGIN
  SELECT platform_commission_pct, cleaning_fee_goes_to
    INTO v_pct, v_dest
    FROM properties WHERE id = NEW.property_id;

  IF NEW.commission_pct IS NULL THEN
    IF v_pct IS NULL THEN
      SELECT default_commission_pct INTO v_pct FROM platform_settings WHERE id = 1;
    END IF;
    NEW.commission_pct := v_pct;   -- may stay NULL, which flags the booking
  END IF;

  IF NEW.cleaning_fee_goes_to IS NULL THEN
    NEW.cleaning_fee_goes_to := COALESCE(v_dest, 'platform');
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill from the property's current value, for bookings that can still
-- settle. Completed ones are left alone: their entries are posted and
-- immutable, so a value written now could only disagree with the ledger.
UPDATE bookings b
   SET cleaning_fee_goes_to = COALESCE(
         (SELECT cleaning_fee_goes_to FROM properties p WHERE p.id = b.property_id),
         'platform')
 WHERE b.cleaning_fee_goes_to IS NULL
   AND b.status <> 'completed';

-- Settlement reads the frozen value, falling back to the property only for
-- bookings taken before this migration.
CREATE OR REPLACE FUNCTION settle_booking_completion(
  p_booking_id uuid,
  p_actor      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_b        bookings;
  v_owner    uuid;
  v_pct      numeric;
  v_dest     text;
  v_stay     numeric;
  v_cleaning numeric;
  v_rent     numeric;
  v_margin   numeric;
  v_entries  jsonb;
  v_split    boolean := true;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status = 'completed' THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'already_completed');
  END IF;
  IF v_b.status <> 'confirmed' THEN
    RETURN jsonb_build_object('completed', false, 'reason', 'not_confirmed');
  END IF;

  SELECT owner_id INTO v_owner FROM properties WHERE id = v_b.property_id;

  v_pct  := COALESCE(v_b.commission_pct,
                     (SELECT platform_commission_pct FROM properties WHERE id = v_b.property_id));
  v_dest := COALESCE(v_b.cleaning_fee_goes_to,
                     (SELECT cleaning_fee_goes_to FROM properties WHERE id = v_b.property_id),
                     'platform');

  IF v_b.payment_status <> 'paid' THEN
    UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
    RETURN jsonb_build_object('completed', true, 'posted', false, 'reason', 'unpaid');
  END IF;

  v_stay     := COALESCE(v_b.total_price,0) + COALESCE(v_b.credit_applied,0);
  v_cleaning := LEAST(COALESCE(v_b.cleaning_fee,0), v_stay);
  v_rent     := v_stay - v_cleaning;

  IF v_stay <= 0 THEN
    UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
    RETURN jsonb_build_object('completed', true, 'posted', false, 'reason', 'zero_value');
  END IF;

  v_entries := jsonb_build_array(
    jsonb_build_object(
      'event_type','booking_revenue_earned','account','unearned_revenue','direction','debit',
      'amount', v_stay, 'booking_id', v_b.id, 'property_id', v_b.property_id,
      'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
      'description','Stay delivered')
  );

  IF v_cleaning > 0 THEN
    v_entries := v_entries || jsonb_build_object(
      'event_type','booking_revenue_earned',
      'account', CASE WHEN v_dest = 'owner' THEN 'owner_payable' ELSE 'revenue_cleaning' END,
      'direction','credit','amount', v_cleaning, 'booking_id', v_b.id,
      'property_id', v_b.property_id, 'user_id', v_b.user_id, 'owner_id', v_owner,
      'created_by', p_actor,
      'description', CASE WHEN v_dest = 'owner' THEN 'Cleaning fee due to owner' ELSE 'Cleaning fee' END);
  END IF;

  IF v_rent > 0 AND v_pct IS NULL THEN
    v_split := false;
    v_entries := v_entries || jsonb_build_object(
      'event_type','booking_revenue_earned','account','owner_payable','direction','credit',
      'amount', v_rent, 'booking_id', v_b.id, 'property_id', v_b.property_id,
      'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
      'description','No commission rate configured - full rent to owner pending split');
  ELSIF v_rent > 0 THEN
    v_margin := round(v_rent * v_pct / 100);
    IF v_margin > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_revenue_earned','account','revenue_booking_margin','direction','credit',
        'amount', v_margin, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
        'description', 'Platform margin at ' || v_pct || '%');
    END IF;
    IF v_rent - v_margin > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_revenue_earned','account','owner_payable','direction','credit',
        'amount', v_rent - v_margin, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'owner_id', v_owner, 'created_by', p_actor,
        'description','Owner share of rent');
    END IF;
  END IF;

  PERFORM post_ledger_entries(v_entries);

  UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;

  RETURN jsonb_build_object('completed', true, 'posted', true, 'split', v_split, 'rate', v_pct);
END;
$$;

-- ── 3c ──────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.expire_unpaid_bookings();

-- ── 3d ──────────────────────────────────────────────────────────────────────
ALTER TABLE property_surveys
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES users(id);

COMMENT ON COLUMN property_surveys.submitted_by IS
  'The account that submitted this survey, taken from the session and not editable. surveyor_name stays free text for display.';

CREATE INDEX IF NOT EXISTS idx_property_surveys_submitted_by
  ON property_surveys (submitted_by);
