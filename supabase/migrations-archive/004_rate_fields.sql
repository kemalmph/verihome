-- Migration 004: extended short_stay_rates fields
-- buffer_days: days blocked after each checkout for cleaning / prep

ALTER TABLE short_stay_rates
  ADD COLUMN IF NOT EXISTS price_per_week    NUMERIC(12,2),        -- nil = no weekly discount
  ADD COLUMN IF NOT EXISTS price_per_month   NUMERIC(12,2),        -- nil = no monthly discount
  ADD COLUMN IF NOT EXISTS security_deposit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS check_in_time     TEXT          NOT NULL DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time    TEXT          NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS buffer_days       INT           NOT NULL DEFAULT 0;
