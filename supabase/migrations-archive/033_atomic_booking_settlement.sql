-- 033: booking state changes and their ledger entries, in one transaction.
--
-- Every financial transition so far has been two steps: a route updates the
-- row, then posts to the ledger. If the post fails the booking is marked paid
-- with nothing behind it, and the error is returned to an admin who has no way
-- to retry just the missing half. The integrity checks exist precisely because
-- this could happen.
--
-- These functions take the state change INSIDE the posting transaction. Either
-- the booking moves and the entries exist, or neither happened.
--
-- All three are idempotent by prior state: a replay returns the row unchanged
-- rather than posting again. The partial unique indexes from migration 023 are
-- the second line of defence, not the first.

-- ── Payment verified ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION settle_booking_payment(
  p_booking_id uuid,
  p_actor      uuid DEFAULT NULL
)
RETURNS bookings
LANGUAGE plpgsql
AS $$
DECLARE
  v_b       bookings;
  v_stay    numeric;
  v_deposit numeric;
  v_entries jsonb;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Already settled: return as-is rather than posting a second time.
  IF v_b.payment_status = 'paid' THEN
    RETURN v_b;
  END IF;

  UPDATE bookings
     SET payment_status = 'paid',
         -- A verified payment is a confirmation (migration 028). Closed
         -- bookings keep their status: paid arriving on a cancelled booking
         -- must not resurrect it.
         status       = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
         confirmed_at = CASE WHEN status = 'pending' THEN now() ELSE confirmed_at END,
         updated_at   = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_b;

  -- total_price is already net of credit; the credit half was posted when the
  -- booking was created.
  v_stay    := COALESCE(v_b.total_price, 0);
  v_deposit := COALESCE(v_b.security_deposit, 0);

  IF v_stay + v_deposit > 0 THEN
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'event_type','booking_payment_received','account','cash','direction','debit',
        'amount', v_stay + v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Guest payment received')
    );
    IF v_stay > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_payment_received','account','unearned_revenue','direction','credit',
        'amount', v_stay, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Stay not yet delivered');
    END IF;
    IF v_deposit > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_payment_received','account','deposits_held','direction','credit',
        'amount', v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Refundable security deposit');
    END IF;

    PERFORM post_ledger_entries(v_entries);
  END IF;

  RETURN v_b;
END;
$$;

-- ── Cancellation, with refund when cash was held ────────────────────────────
CREATE OR REPLACE FUNCTION settle_booking_cancellation(
  p_booking_id uuid,
  p_actor      uuid DEFAULT NULL
)
RETURNS bookings
LANGUAGE plpgsql
AS $$
DECLARE
  v_b       bookings;
  v_was_paid boolean;
  v_stay    numeric;
  v_deposit numeric;
  v_entries jsonb;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_b.status = 'cancelled' THEN
    RETURN v_b;
  END IF;

  v_was_paid := (v_b.payment_status = 'paid');
  -- Cash back is the cash paid. total_price is already net of credit, and the
  -- credit half returns as credit through restore_booking_credits.
  v_stay     := COALESCE(v_b.total_price, 0);
  v_deposit  := COALESCE(v_b.security_deposit, 0);

  UPDATE bookings
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_b;

  IF v_was_paid AND (v_stay + v_deposit) > 0 THEN
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'event_type','booking_refund_issued','account','cash','direction','credit',
        'amount', v_stay + v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Refund paid to guest')
    );
    IF v_stay > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_refund_issued','account','unearned_revenue','direction','debit',
        'amount', v_stay, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Stay will not be delivered');
    END IF;
    IF v_deposit > 0 THEN
      v_entries := v_entries || jsonb_build_object(
        'event_type','booking_refund_issued','account','deposits_held','direction','debit',
        'amount', v_deposit, 'booking_id', v_b.id, 'property_id', v_b.property_id,
        'user_id', v_b.user_id, 'created_by', p_actor,
        'description','Security deposit returned');
    END IF;

    PERFORM post_ledger_entries(v_entries);
  END IF;

  -- Credit spent on this booking goes back to the guest, in the same
  -- transaction as the cancellation that entitles them to it.
  PERFORM restore_booking_credits(p_booking_id);

  RETURN v_b;
END;
$$;

-- ── Stay delivered: the only event that creates booking revenue ─────────────
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

  SELECT owner_id, cleaning_fee_goes_to INTO v_owner, v_dest
    FROM properties WHERE id = v_b.property_id;

  -- The rate frozen on the booking wins; the property is read only for
  -- bookings taken before migration 028 added the snapshot.
  v_pct := COALESCE(v_b.commission_pct,
                    (SELECT platform_commission_pct FROM properties WHERE id = v_b.property_id));

  -- Unpaid bookings have no unearned_revenue to release. Completing one would
  -- debit a liability that was never credited.
  IF v_b.payment_status <> 'paid' THEN
    UPDATE bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
    RETURN jsonb_build_object('completed', true, 'posted', false, 'reason', 'unpaid');
  END IF;

  -- Delivered in full regardless of how it was paid for: unearned_revenue was
  -- credited from cash (total_price) and credit (credit_applied) both.
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
    -- No rate anywhere. Post the whole rent to the owner and say so, rather
    -- than guessing: underpaying VeriHome is recoverable, underpaying an owner
    -- silently is not.
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
