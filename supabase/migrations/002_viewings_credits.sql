-- ============================================================
-- Migration 002: Viewings deposit columns + user_credits
-- Run AFTER 001_booking_system.sql
-- ============================================================

-- ── 1. Update viewings table ──────────────────────────────────

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS deposit_amount      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS deposit_paid        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_paid_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_refunded    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_proof_url   TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_code  TEXT,
  ADD COLUMN IF NOT EXISTS attended            BOOLEAN,  -- null = not yet, true/false = outcome
  ADD COLUMN IF NOT EXISTS attended_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_issued       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_issued_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason       TEXT;

-- ── 2. user_credits ──────────────────────────────────────────
-- Credits earned by attending viewings; redeemable against consultation fees.

CREATE TABLE IF NOT EXISTS user_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,   -- positive = earned, negative = spent
  reason          TEXT NOT NULL,            -- 'viewing_attended', 'consultation_applied', 'manual_adjustment'
  viewing_id      UUID REFERENCES viewings(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_credits_user_id_idx ON user_credits (user_id);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_credits" ON user_credits FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "admin_write_credits" ON user_credits FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- ── 3. Consultations: add credit_applied column ───────────────

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS credit_applied    NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_price       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_status    TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending_verification', 'paid', 'complimentary')),
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_code TEXT;

-- ── 4. Helper: get user credit balance ───────────────────────

CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(amount), 0) FROM user_credits WHERE user_id = p_user_id;
$$;
