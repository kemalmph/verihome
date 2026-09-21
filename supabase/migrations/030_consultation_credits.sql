-- 030: let credit pay for a consultation.
--
-- consultations.credit_applied and final_price have existed since the table was
-- created and have never been written by anything. Credit could only be spent
-- on a booking, which made the viewing deposit far less useful than the policy
-- implied — the guest is told the credit works for "konsultasi atau booking".
--
-- Two columns are added to user_credits:
--   consultation_id  the counterpart of the existing booking_id, so a redeemed
--                    credit says what it was spent on
--   status           active | refund_requested | refunded
--
-- status is introduced HERE rather than with the refund flow in 031 because
-- redemption has to respect it from the first moment it exists. Adding it later
-- would leave a window where a credit awaiting a cash refund could still be
-- spent, and the guest would be paid twice for the same money.
--
-- ALTER TABLE, not a re-declared CREATE TABLE IF NOT EXISTS — that guard is
-- what silently dropped this table's columns in migration 011 (§18.3).

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES consultations(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Drop-then-add, never a re-declared table constraint.
ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_status_check;
ALTER TABLE user_credits ADD CONSTRAINT user_credits_status_check
  CHECK (status IN ('active', 'refund_requested', 'refunded'));

COMMENT ON COLUMN user_credits.status IS
  'active = spendable. refund_requested = the guest asked for cash back and it is no longer spendable. refunded = cash has actually left.';
COMMENT ON COLUMN user_credits.consultation_id IS
  'Set when this credit was redeemed against a consultation, mirroring booking_id.';

-- A replayed credit application must not post twice. The per-booking index
-- already guards credit_redeemed; the per-consultation one did not.
DROP INDEX IF EXISTS ledger_once_per_consultation;
CREATE UNIQUE INDEX ledger_once_per_consultation
  ON ledger_entries (event_type, consultation_id, account, direction)
  WHERE consultation_id IS NOT NULL
    AND event_type IN ('consultation_payment_received',
                       'consultation_revenue_earned',
                       'credit_redeemed');

-- ── Applying credit ─────────────────────────────────────────────────────────
-- The amount is computed here and never taken from the caller. A client that
-- could name its own credit amount could name any amount.
CREATE OR REPLACE FUNCTION apply_consultation_credit(
  p_consultation_id uuid,
  p_user_id         uuid
)
RETURNS TABLE (applied numeric, final_price numeric, fully_covered boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_hex       text;
  v_c         consultations%ROWTYPE;
  v_credit    user_credits%ROWTYPE;
  v_applied   numeric := 0;
  v_remaining numeric;
  v_final     numeric;
BEGIN
  -- Serialise on the user, not the consultation: credit is one balance shared
  -- across every checkout the same person might have open at once. Locking the
  -- consultation would let two of their tabs spend the same credit twice.
  v_hex := replace(p_user_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'consultation_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_c.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_your_consultation' USING ERRCODE = 'P0001';
  END IF;
  IF v_c.payment_status = 'paid' THEN
    RAISE EXCEPTION 'already_paid' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_c.credit_applied, 0) > 0 THEN
    RAISE EXCEPTION 'credit_already_applied' USING ERRCODE = 'P0001';
  END IF;

  v_remaining := v_c.price;

  -- Oldest-expiring first, so the credit closest to being lost is used up.
  -- A credit is consumed only when its whole value fits inside what is still
  -- owed: redemption marks the row spent without splitting it, so applying a
  -- 50.000 credit to 10.000 of remaining price would destroy 40.000 of the
  -- guest's money.
  FOR v_credit IN
    SELECT * FROM user_credits
     WHERE user_id    = p_user_id
       AND redeemed_at IS NULL
       AND status     = 'active'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY expires_at ASC NULLS LAST, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    CONTINUE WHEN v_credit.amount > v_remaining;

    UPDATE user_credits
       SET redeemed_at     = now(),
           consultation_id = p_consultation_id
     WHERE id = v_credit.id;

    v_applied   := v_applied + v_credit.amount;
    v_remaining := v_remaining - v_credit.amount;
  END LOOP;

  IF v_applied = 0 THEN
    RETURN QUERY SELECT 0::numeric, v_c.price::numeric, false;
    RETURN;
  END IF;

  v_final := v_c.price - v_applied;

  UPDATE consultations
     SET credit_applied = v_applied,
         final_price    = v_final,
         -- Nothing left to pay means there is nothing to wait for.
         payment_status = CASE WHEN v_final = 0 THEN 'paid' ELSE payment_status END,
         status         = CASE WHEN v_final = 0 THEN 'paid' ELSE status END
   WHERE id = p_consultation_id;

  -- One liability becomes another: the credit VeriHome owed the guest turns
  -- into the obligation to deliver a session. No cash moves, so cash is not
  -- touched. Posted in this transaction, so the row and the books cannot part.
  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','credit_redeemed','account','credits_outstanding','direction','debit',
      'amount',v_applied,'consultation_id',p_consultation_id,'user_id',p_user_id,
      'description','Kredit dipakai untuk konsultasi'),
    jsonb_build_object(
      'event_type','credit_redeemed','account','unearned_revenue','direction','credit',
      'amount',v_applied,'consultation_id',p_consultation_id,'user_id',p_user_id,
      'description','Sesi belum diberikan')
  ));

  RETURN QUERY SELECT v_applied, v_final, (v_final = 0);
END;
$$;

COMMENT ON FUNCTION apply_consultation_credit(uuid, uuid) IS
  'Applies a users own credit to their consultation and posts credit_redeemed, in one transaction. The amount is computed server-side; callers cannot name it.';
