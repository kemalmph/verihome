-- Migration 016: Add the user_credits columns migration 011 never created.
--
-- Migration 002 created user_credits as
--   (id, user_id, amount, reason, viewing_id, created_at).
-- Migration 011 re-declared the table with CREATE TABLE IF NOT EXISTS in order
-- to introduce expires_at / redeemed_at / booking_id. The table already existed,
-- so the IF NOT EXISTS guard made that entire CREATE a silent no-op and the three
-- new columns were never added. The rest of 011 -- RLS, policies, the RPC -- ran
-- normally, which is why nothing looked wrong.
--
-- plpgsql function bodies are not validated until execution, so all three credit
-- RPCs were created successfully while referencing columns that do not exist,
-- and failed only when first called:
--
--   issue_viewing_credit        -> expires_at
--   create_booking_with_credits -> redeemed_at, expires_at, booking_id
--   restore_booking_credits     -> redeemed_at, expires_at, booking_id
--
-- Additive and safe: the table holds no rows, and all three columns are nullable.
-- NULL is already the correct resting state for each -- an unredeemed credit has
-- no redeemed_at and no booking_id, and a non-expiring credit has no expires_at.

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_id  uuid REFERENCES bookings(id) ON DELETE SET NULL;
