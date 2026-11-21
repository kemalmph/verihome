-- Migration 020: append-only double-entry ledger.
--
-- Money in the platform bank account belongs to several parties at once:
-- VeriHome's earned revenue, owner payouts not yet disbursed, refundable
-- deposits, and cash received for stays that have not happened. Nothing in the
-- schema separated those, so "how much of this is ours" had no answer.
--
-- Every financial event writes a balanced pair of rows here, and every report
-- derives from this table rather than recomputing from bookings/viewings.

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date timestamptz not null default now(),

  event_type text not null check (event_type in (
    'booking_payment_received',
    'booking_revenue_earned',
    'booking_refund_issued',
    'consultation_payment_received',
    'consultation_revenue_earned',
    'viewing_deposit_received',
    'viewing_deposit_refunded',
    'viewing_deposit_forfeited',
    'viewing_deposit_converted_to_credit',
    'security_deposit_received',
    'security_deposit_refunded',
    'security_deposit_claimed',
    'credit_issued',
    'credit_redeemed',
    'credit_expired',
    'owner_payout_due',
    'owner_payout_paid',
    'placement_commission_earned',
    'placement_commission_received',
    'cleaning_fee_received'
  )),

  account text not null check (account in (
    'cash',                     -- asset
    'commission_receivable',    -- asset
    'owner_payable',            -- liability
    'deposits_held',            -- liability, returned to payer
    'credits_outstanding',      -- liability, returned to payer
    'unearned_revenue',         -- liability, becomes revenue
    'revenue_booking_margin',   -- income
    'revenue_consultation',     -- income
    'revenue_cleaning',         -- income
    'revenue_commission',       -- income
    'revenue_forfeited_deposit' -- income
  )),

  direction text not null check (direction in ('debit','credit')),
  amount numeric(12,0) not null check (amount >= 0),

  booking_id uuid references bookings(id),
  viewing_id uuid references viewings(id),
  consultation_id uuid references consultations(id),
  property_id uuid references properties(id),
  user_id uuid references users(id),
  owner_id uuid references owners(id),

  description text,
  created_by uuid references users(id),
  -- Points BACKWARD: set on a correcting entry to name the entry it reverses.
  -- The original is never touched, which is what keeps the table append-only.
  reversed_by uuid references ledger_entries(id),

  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_date    ON ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_booking ON ledger_entries(booking_id);
CREATE INDEX IF NOT EXISTS idx_ledger_owner   ON ledger_entries(owner_id);

COMMENT ON TABLE ledger_entries IS
  'Append-only double-entry ledger. Never UPDATE or DELETE: correct a mistake by posting a reversing entry whose reversed_by names the original.';

-- ── Immutability ─────────────────────────────────────────────────────────────
-- Enforced in the database, not the application. An audit trail that the app
-- could rewrite is not an audit trail.

CREATE OR REPLACE FUNCTION ledger_entries_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'ledger_entries is append-only — % is not permitted. Correct a mistake by posting a reversing entry whose reversed_by references the original.',
    TG_OP
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries;
CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

DROP TRIGGER IF EXISTS ledger_entries_no_delete ON ledger_entries;
CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

-- ── Access ───────────────────────────────────────────────────────────────────
-- RLS on with no policies: unreachable by anon or authenticated, and the
-- service-role client bypasses RLS. Financial records are service-role only.

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- ── Which side increases an account ──────────────────────────────────────────
-- Assets rise on the debit side; liabilities and income rise on the credit
-- side. Reports must not each re-derive this.

CREATE OR REPLACE FUNCTION ledger_account_kind(p_account text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_account IN ('cash','commission_receivable') THEN 'asset'
    WHEN p_account IN ('owner_payable','deposits_held','credits_outstanding','unearned_revenue') THEN 'liability'
    ELSE 'income'
  END;
$$;

-- ── Posting ──────────────────────────────────────────────────────────────────
-- The only way entries are written. A plpgsql body is one transaction, so the
-- balance check and every insert commit together or not at all.

CREATE OR REPLACE FUNCTION post_ledger_entries(p_entries jsonb)
RETURNS SETOF ledger_entries
LANGUAGE plpgsql AS $$
DECLARE
  v_debits  numeric;
  v_credits numeric;
  v_count   int;
BEGIN
  v_count := jsonb_array_length(p_entries);
  IF v_count IS NULL OR v_count < 2 THEN
    RAISE EXCEPTION 'ledger_incomplete: a financial event needs at least two entries, got %', COALESCE(v_count, 0)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM((e->>'amount')::numeric) FILTER (WHERE e->>'direction' = 'debit'),  0),
    COALESCE(SUM((e->>'amount')::numeric) FILTER (WHERE e->>'direction' = 'credit'), 0)
  INTO v_debits, v_credits
  FROM jsonb_array_elements(p_entries) e;

  IF v_debits <> v_credits THEN
    RAISE EXCEPTION 'ledger_unbalanced: debits=% credits=% (difference %)',
      v_debits, v_credits, v_debits - v_credits
      USING ERRCODE = 'P0001';
  END IF;

  IF v_debits = 0 THEN
    RAISE EXCEPTION 'ledger_zero_value: an event that moves no money should not be posted'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  INSERT INTO ledger_entries (
    entry_date, event_type, account, direction, amount,
    booking_id, viewing_id, consultation_id, property_id, user_id, owner_id,
    description, created_by, reversed_by
  )
  SELECT
    COALESCE((e->>'entry_date')::timestamptz, now()),
    e->>'event_type',
    e->>'account',
    e->>'direction',
    (e->>'amount')::numeric,
    (e->>'booking_id')::uuid,
    (e->>'viewing_id')::uuid,
    (e->>'consultation_id')::uuid,
    (e->>'property_id')::uuid,
    (e->>'user_id')::uuid,
    (e->>'owner_id')::uuid,
    e->>'description',
    (e->>'created_by')::uuid,
    (e->>'reversed_by')::uuid
  FROM jsonb_array_elements(p_entries) e
  RETURNING *;
END;
$$;

-- ── Reading ──────────────────────────────────────────────────────────────────
-- Every report goes through this rather than summing the table ad hoc, so the
-- sign convention is applied in exactly one place.

CREATE OR REPLACE FUNCTION ledger_balances(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (account text, kind text, debits numeric, credits numeric, balance numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    l.account,
    ledger_account_kind(l.account) AS kind,
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0) AS debits,
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0) AS credits,
    CASE WHEN ledger_account_kind(l.account) = 'asset'
      THEN COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
         - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
      ELSE COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
         - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
    END AS balance
  FROM ledger_entries l
  WHERE (p_from IS NULL OR l.entry_date >= p_from)
    AND (p_to   IS NULL OR l.entry_date <  p_to)
  GROUP BY l.account;
$$;
