-- Migration 011: Viewing deposit flow + user credits
--
-- 1. Adds scheduled_at to viewings (confirmed slot datetime)
-- 2. Creates user_credits table (viewing deposit → credit on attendance)
-- 3. Creates issue_viewing_credit() RPC (atomic, idempotent)

-- ── 1. viewings: add confirmed slot column ────────────────────

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- ── 2. user_credits ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_credits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewing_id  uuid        REFERENCES viewings(id) ON DELETE SET NULL,
  amount      numeric(12,0) NOT NULL CHECK (amount > 0),
  reason      text        NOT NULL DEFAULT 'viewing_deposit',
  -- expires 6 months from issue; NULL = never
  expires_at  timestamptz,
  redeemed_at timestamptz,
  booking_id  uuid        REFERENCES bookings(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users can read their own credits
CREATE POLICY "users_read_own_credits"
  ON user_credits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only service role (admin) can insert/update/delete
CREATE POLICY "service_role_all_credits"
  ON user_credits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. issue_viewing_credit RPC ───────────────────────────────
--
-- Called by admin after marking attendance.
-- Idempotent: if credit already issued, returns existing row.
-- Acquires advisory lock on the viewing id to prevent double-issue.

CREATE OR REPLACE FUNCTION public.issue_viewing_credit(p_viewing_id uuid)
RETURNS user_credits
LANGUAGE plpgsql AS
$$
DECLARE
  v_viewing  viewings;
  v_credit   user_credits;
  v_hex      TEXT;
BEGIN
  -- Serialise concurrent calls for the same viewing
  v_hex := replace(p_viewing_id::text, '-', '');
  PERFORM pg_advisory_xact_lock(
    ('x' || left(v_hex,  8))::bit(32)::int,
    ('x' || right(v_hex, 8))::bit(32)::int
  );

  SELECT * INTO v_viewing FROM viewings WHERE id = p_viewing_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'viewing_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_viewing.attended IS NOT TRUE THEN
    RAISE EXCEPTION 'viewing_not_attended' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent: return existing credit if already issued
  IF v_viewing.credit_issued THEN
    SELECT * INTO v_credit FROM user_credits WHERE viewing_id = p_viewing_id LIMIT 1;
    RETURN v_credit;
  END IF;

  INSERT INTO user_credits (user_id, viewing_id, amount, reason, expires_at)
  VALUES (
    v_viewing.user_id,
    p_viewing_id,
    COALESCE(v_viewing.deposit_amount, 50000),
    'viewing_deposit',
    now() + interval '6 months'
  )
  RETURNING * INTO v_credit;

  UPDATE viewings
     SET credit_issued    = true,
         credit_issued_at = now()
   WHERE id = p_viewing_id;

  RETURN v_credit;
END;
$$;
