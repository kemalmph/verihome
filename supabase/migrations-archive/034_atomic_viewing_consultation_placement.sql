-- 034: the remaining financial transitions, each in one transaction.
--
-- Same change as 033, applied to viewings, consultations and placements. After
-- this, every event in the §2 audit either lives inside a settlement function
-- or has no business row to diverge from (expenses and drawings).
--
-- Each is idempotent by prior state: a replay returns without posting.

-- ── Viewing deposit verified ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION settle_viewing_deposit(
  p_viewing_id   uuid,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_actor        uuid DEFAULT NULL
)
RETURNS viewings
LANGUAGE plpgsql
AS $$
DECLARE v_v viewings; v_amt numeric;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.deposit_paid THEN RETURN v_v; END IF;

  UPDATE viewings
     SET status          = 'confirmed',
         deposit_paid    = true,
         deposit_paid_at = now(),
         scheduled_at    = COALESCE(p_scheduled_at, scheduled_at),
         confirmed_at    = now()
   WHERE id = p_viewing_id
  RETURNING * INTO v_v;

  v_amt := COALESCE(v_v.deposit_amount, 0);
  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_received','account','cash','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Viewing deposit received'),
      jsonb_build_object('event_type','viewing_deposit_received','account','deposits_held','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Refundable viewing deposit')
    ));
  END IF;

  RETURN v_v;
END;
$$;

-- ── Attendance: deposit becomes credit ──────────────────────────────────────
-- Three writes used to happen separately here — attendance, the credit RPC,
-- then the ledger — so this transition had two divergence windows rather than
-- one. It was the worst of the twelve.
CREATE OR REPLACE FUNCTION settle_viewing_attendance(
  p_viewing_id uuid,
  p_actor      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_v viewings; v_amt numeric; v_credit_id uuid;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.credit_issued THEN
    RETURN jsonb_build_object('attended', true, 'credit_issued', false, 'reason','already_issued');
  END IF;
  IF v_v.status <> 'confirmed' THEN
    RAISE EXCEPTION 'viewing_not_confirmed' USING ERRCODE='P0001';
  END IF;
  -- An upload is a claim; only a verified deposit can mint credit.
  IF NOT v_v.deposit_paid THEN
    RAISE EXCEPTION 'deposit_not_confirmed' USING ERRCODE='P0001';
  END IF;

  v_amt := COALESCE(v_v.deposit_amount, 0);

  UPDATE viewings
     SET attended = true, attended_at = now(), status = 'attended',
         credit_issued = true, credit_issued_at = now()
   WHERE id = p_viewing_id
  RETURNING * INTO v_v;

  INSERT INTO user_credits(user_id, amount, reason, viewing_id, expires_at, status)
  VALUES (v_v.user_id, v_amt, 'viewing_attendance', v_v.id, now() + interval '6 months', 'active')
  RETURNING id INTO v_credit_id;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_converted_to_credit','account','deposits_held','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Deposit converted on attendance'),
      jsonb_build_object('event_type','viewing_deposit_converted_to_credit','account','credits_outstanding','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Credit issued to guest')
    ));
  END IF;

  RETURN jsonb_build_object('attended', true, 'credit_issued', true,
                            'credit_id', v_credit_id, 'amount', v_amt);
END;
$$;

-- ── No-show: the deposit is forfeited ───────────────────────────────────────
CREATE OR REPLACE FUNCTION settle_viewing_no_show(
  p_viewing_id uuid,
  p_actor      uuid DEFAULT NULL
)
RETURNS viewings
LANGUAGE plpgsql
AS $$
DECLARE v_v viewings; v_amt numeric; v_was_paid boolean;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.status = 'no_show' THEN RETURN v_v; END IF;

  v_was_paid := v_v.deposit_paid;
  v_amt := COALESCE(v_v.deposit_amount, 0);

  UPDATE viewings
     SET attended = false, attended_at = now(), status = 'no_show'
   WHERE id = p_viewing_id
  RETURNING * INTO v_v;

  IF v_was_paid AND v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_forfeited','account','deposits_held','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Deposit forfeited on no-show'),
      jsonb_build_object('event_type','viewing_deposit_forfeited','account','revenue_forfeited_deposit','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Forfeited viewing deposit')
    ));
  END IF;

  RETURN v_v;
END;
$$;

-- ── Deposit refund confirmed (stage 2 of the existing two-step flow) ────────
CREATE OR REPLACE FUNCTION settle_viewing_refund(
  p_viewing_id uuid,
  p_actor      uuid DEFAULT NULL
)
RETURNS viewings
LANGUAGE plpgsql
AS $$
DECLARE v_v viewings; v_amt numeric;
BEGIN
  SELECT * INTO v_v FROM viewings WHERE id = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE='P0001'; END IF;
  IF v_v.deposit_refunded THEN RETURN v_v; END IF;
  IF v_v.deposit_refund_requested_at IS NULL THEN
    RAISE EXCEPTION 'no_refund_request' USING ERRCODE='P0001';
  END IF;

  v_amt := COALESCE(v_v.deposit_amount, 0);

  UPDATE viewings
     SET deposit_refunded = true, deposit_refunded_at = now(), status = 'refunded'
   WHERE id = p_viewing_id
  RETURNING * INTO v_v;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','viewing_deposit_refunded','account','deposits_held','direction','debit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Viewing deposit refunded'),
      jsonb_build_object('event_type','viewing_deposit_refunded','account','cash','direction','credit',
        'amount',v_amt,'viewing_id',v_v.id,'property_id',v_v.property_id,'user_id',v_v.user_id,
        'created_by',p_actor,'description','Refund paid out')
    ));
  END IF;

  RETURN v_v;
END;
$$;

-- ── Consultation paid ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION settle_consultation_payment(
  p_consultation_id uuid,
  p_actor           uuid DEFAULT NULL
)
RETURNS consultations
LANGUAGE plpgsql
AS $$
DECLARE v_c consultations; v_cash numeric;
BEGIN
  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consultation_not_found' USING ERRCODE='P0001'; END IF;
  IF v_c.payment_status = 'paid' THEN RETURN v_c; END IF;

  -- final_price is already net of credit; the credit half was posted when it
  -- was applied. A session fully covered by credit has no cash event at all.
  v_cash := COALESCE(v_c.final_price, v_c.price, 0);

  UPDATE consultations
     SET payment_status = 'paid', status = 'paid'
   WHERE id = p_consultation_id
  RETURNING * INTO v_c;

  IF v_cash > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','consultation_payment_received','account','cash','direction','debit',
        'amount',v_cash,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Consultation payment received'),
      jsonb_build_object('event_type','consultation_payment_received','account','unearned_revenue','direction','credit',
        'amount',v_cash,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Session not yet delivered')
    ));
  END IF;

  RETURN v_c;
END;
$$;

-- ── Consultation delivered ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION settle_consultation_completion(
  p_consultation_id uuid,
  p_actor           uuid DEFAULT NULL
)
RETURNS consultations
LANGUAGE plpgsql
AS $$
DECLARE v_c consultations; v_value numeric;
BEGIN
  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'consultation_not_found' USING ERRCODE='P0001'; END IF;
  IF v_c.status = 'completed' THEN RETURN v_c; END IF;

  -- The whole package value is delivered regardless of how it was paid for.
  -- unearned_revenue was credited from cash and credit both, so both are
  -- released; recognising only the cash half would strand the rest forever.
  v_value := COALESCE(v_c.final_price, v_c.price, 0) + COALESCE(v_c.credit_applied, 0);

  UPDATE consultations
     SET status = 'completed', completed_at = now()
   WHERE id = p_consultation_id
  RETURNING * INTO v_c;

  IF v_value > 0 AND v_c.payment_status = 'paid' THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','consultation_revenue_earned','account','unearned_revenue','direction','debit',
        'amount',v_value,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Session delivered'),
      jsonb_build_object('event_type','consultation_revenue_earned','account','revenue_consultation','direction','credit',
        'amount',v_value,'consultation_id',v_c.id,'user_id',v_c.user_id,
        'created_by',p_actor,'description','Consultation fee earned')
    ));
  END IF;

  RETURN v_c;
END;
$$;

-- ── Placement commission recorded, then received ────────────────────────────
CREATE OR REPLACE FUNCTION settle_placement_recorded(
  p_placement_id uuid,
  p_actor        uuid DEFAULT NULL
)
RETURNS placements
LANGUAGE plpgsql
AS $$
DECLARE v_p placements; v_amt numeric; v_owner uuid;
BEGIN
  SELECT * INTO v_p FROM placements WHERE id = p_placement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'placement_not_found' USING ERRCODE='P0001'; END IF;

  v_amt := COALESCE(v_p.commission_amount, 0);
  SELECT owner_id INTO v_owner FROM properties WHERE id = v_p.property_id;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','placement_commission_earned','account','commission_receivable','direction','debit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Placement commission invoiced'),
      jsonb_build_object('event_type','placement_commission_earned','account','revenue_commission','direction','credit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Placement commission earned')
    ));
  END IF;

  RETURN v_p;
END;
$$;

CREATE OR REPLACE FUNCTION settle_placement_payment(
  p_placement_id uuid,
  p_actor        uuid DEFAULT NULL
)
RETURNS placements
LANGUAGE plpgsql
AS $$
DECLARE v_p placements; v_amt numeric; v_owner uuid;
BEGIN
  SELECT * INTO v_p FROM placements WHERE id = p_placement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'placement_not_found' USING ERRCODE='P0001'; END IF;
  IF v_p.status = 'paid' THEN RETURN v_p; END IF;

  v_amt := COALESCE(v_p.commission_amount, 0);
  SELECT owner_id INTO v_owner FROM properties WHERE id = v_p.property_id;

  UPDATE placements SET status = 'paid' WHERE id = p_placement_id RETURNING * INTO v_p;

  IF v_amt > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','placement_commission_received','account','cash','direction','debit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Placement commission paid by owner'),
      jsonb_build_object('event_type','placement_commission_received','account','commission_receivable','direction','credit',
        'amount',v_amt,'property_id',v_p.property_id,'user_id',v_p.user_id,'owner_id',v_owner,
        'created_by',p_actor,'description','Receivable settled')
    ));
  END IF;

  RETURN v_p;
END;
$$;
