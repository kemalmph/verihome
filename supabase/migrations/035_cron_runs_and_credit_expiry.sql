-- 035: make the daily jobs observable, and give credit expiry a home.
--
-- WHY cron_runs EXISTS
--
-- expire-bookings reported `expired: 0` for months while failing on every
-- single row, because the endpoint counted successes and swallowed errors into
-- a log nobody reads. A run that fails completely and a run with nothing to do
-- produced byte-identical output (§18.9).
--
-- Recording candidates, succeeded and failed SEPARATELY is what makes those two
-- cases distinguishable. candidates=0 is a quiet night. candidates=8,
-- succeeded=0, failed=8 is an outage. No amount of log-reading discipline
-- substitutes for the numbers being different.

CREATE TABLE IF NOT EXISTS cron_runs (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  step        text not null,
  candidates  integer not null default 0,
  succeeded   integer not null default 0,
  failed      integer not null default 0,
  errors      jsonb default '[]'
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON cron_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_failed  ON cron_runs (started_at DESC) WHERE failed > 0;

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
-- No policies: service role only, like ledger_entries. Read through the admin
-- client behind requireAdmin().

COMMENT ON TABLE cron_runs IS
  'One row per step per run. candidates/succeeded/failed are separate so a total failure cannot look like an empty queue.';

-- ── Credit expiry ───────────────────────────────────────────────────────────
-- Credit that lapses unspent stops being a liability, and that has to be
-- recorded: credits_outstanding would otherwise carry money VeriHome no longer
-- owes anyone, overstating what it holds for other people.
--
-- One transaction per credit, like expire_single_booking, so one bad row cannot
-- take the sweep down with it.
CREATE OR REPLACE FUNCTION expire_single_credit(p_credit_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE v_c user_credits%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM user_credits WHERE id = p_credit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Re-checked under the lock: the guest may have spent it, or asked for it
  -- back, between the sweep's SELECT and this call.
  IF v_c.redeemed_at IS NOT NULL
     OR v_c.status <> 'active'
     OR v_c.expires_at IS NULL
     OR v_c.expires_at > now() THEN
    RETURN false;
  END IF;

  UPDATE user_credits SET status = 'expired' WHERE id = p_credit_id;

  IF COALESCE(v_c.amount, 0) > 0 THEN
    PERFORM post_ledger_entries(jsonb_build_array(
      jsonb_build_object('event_type','credit_expired','account','credits_outstanding','direction','debit',
        'amount',v_c.amount,'user_id',v_c.user_id,'viewing_id',v_c.viewing_id,
        'description','Credit expired'),
      jsonb_build_object('event_type','credit_expired','account','revenue_forfeited_deposit','direction','credit',
        'amount',v_c.amount,'user_id',v_c.user_id,'viewing_id',v_c.viewing_id,
        'description','Unspent credit lapsed')
    ));
  END IF;

  RETURN true;
END;
$$;

-- 'expired' has to be an allowed status before the function above can write it.
-- Widened with DROP/ADD, and proven by insert rather than by reading the
-- definition — this is the exact shape of the bug in §18.9, where code wrote a
-- status its own CHECK constraint rejected.
ALTER TABLE user_credits DROP CONSTRAINT IF EXISTS user_credits_status_check;
ALTER TABLE user_credits ADD CONSTRAINT user_credits_status_check
  CHECK (status IN ('active', 'refund_requested', 'refunded', 'expired'));
