-- 032: let a guest exchange unused viewing credit back for cash.
--
-- The policy shown before payment (migration 029) promises this: credit issued
-- from a viewing deposit can be turned back into money within 14 days, while it
-- is still unspent. Without it, "deposit menjadi kredit" is a one-way door and
-- the disclosure would be false the moment anyone tried to use it.
--
-- Two stages, matching the viewing deposit refund already in the codebase:
--   request  -> status 'refund_requested'. Immediately unspendable, so the
--               guest cannot both spend it and be paid for it.
--   confirm  -> status 'refunded', and only then does the ledger record cash
--               leaving. Collapsing these would book a transfer before anyone
--               made one.
--
-- The event_type constraint is widened with DROP/ADD, never a re-declared
-- CREATE TABLE IF NOT EXISTS (§18.3). pg_constraint is queried after applying
-- to prove the new value is actually allowed rather than assumed.

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_event_type_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_event_type_check
  CHECK (event_type IN (
    'booking_payment_received','booking_revenue_earned','booking_refund_issued',
    'consultation_payment_received','consultation_revenue_earned',
    'viewing_deposit_received','viewing_deposit_refunded','viewing_deposit_forfeited',
    'viewing_deposit_converted_to_credit',
    'security_deposit_received','security_deposit_refunded','security_deposit_claimed',
    'credit_issued','credit_redeemed','credit_expired','credit_refunded',
    'owner_payout_due','owner_payout_paid',
    'placement_commission_earned','placement_commission_received',
    'cleaning_fee_received','operating_expense_paid','equity_drawing_paid'
  ));

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at         timestamptz;

COMMENT ON COLUMN user_credits.refund_requested_at IS
  'When the guest asked for cash back. The credit stops being spendable at this moment, not when the transfer is made.';

-- ── Stage 1: the guest asks ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_credit_refund(
  p_credit_id uuid,
  p_user_id   uuid
)
RETURNS user_credits
LANGUAGE plpgsql
AS $$
DECLARE
  v_hex text;
  v_credit user_credits%ROWTYPE;
BEGIN
  v_hex := replace(p_user_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_credit FROM user_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not_your_credit' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_spent' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.status <> 'active' THEN
    RAISE EXCEPTION 'not_refundable_status' USING ERRCODE = 'P0001';
  END IF;
  -- Only credit that came from a viewing deposit is cash-refundable: that is
  -- the guest's own money held back. Goodwill credit was never their cash.
  IF v_credit.viewing_id IS NULL THEN
    RAISE EXCEPTION 'not_from_viewing_deposit' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.created_at < now() - interval '14 days' THEN
    RAISE EXCEPTION 'refund_window_closed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE user_credits
     SET status = 'refund_requested', refund_requested_at = now()
   WHERE id = p_credit_id
  RETURNING * INTO v_credit;

  -- No ledger entry here. Nothing has moved yet; the credit is simply frozen.
  RETURN v_credit;
END;
$$;

-- ── Stage 2: the admin confirms the transfer ────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_credit_refund(
  p_credit_id uuid,
  p_admin_id  uuid
)
RETURNS user_credits
LANGUAGE plpgsql
AS $$
DECLARE
  v_credit user_credits%ROWTYPE;
  v_hex text;
BEGIN
  SELECT * INTO v_credit FROM user_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_credit.status <> 'refund_requested' THEN
    RAISE EXCEPTION 'no_refund_request' USING ERRCODE = 'P0001';
  END IF;

  v_hex := replace(v_credit.user_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  UPDATE user_credits
     SET status = 'refunded', refunded_at = now()
   WHERE id = p_credit_id
  RETURNING * INTO v_credit;

  -- Now money has actually left: the liability to the guest is discharged in
  -- cash. Same transaction as the status change, so the two cannot diverge.
  PERFORM post_ledger_entries(jsonb_build_array(
    jsonb_build_object(
      'event_type','credit_refunded','account','credits_outstanding','direction','debit',
      'amount',v_credit.amount,'user_id',v_credit.user_id,'viewing_id',v_credit.viewing_id,
      'created_by',p_admin_id,'description','Kredit ditukar kembali menjadi uang'),
    jsonb_build_object(
      'event_type','credit_refunded','account','cash','direction','credit',
      'amount',v_credit.amount,'user_id',v_credit.user_id,'viewing_id',v_credit.viewing_id,
      'created_by',p_admin_id,'description','Transfer pengembalian kredit')
  ));

  RETURN v_credit;
END;
$$;
