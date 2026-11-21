-- 029: record that the guest saw the deposit terms before paying.
--
-- The deposit does not come back as cash when a viewing is attended — it
-- becomes credit. The flow described it as "refundable" right up to the payment
-- step, which is a disclosure problem, not a wording problem: the guest was
-- agreeing to terms they had not been shown.
--
-- Storing the timestamp AND the version matters. A timestamp alone says someone
-- ticked a box; it does not say what the box said. If the terms are ever
-- revised, only the version tells you which set a given guest accepted.
--
-- ALTER TABLE, never a re-declared CREATE TABLE IF NOT EXISTS — see migration
-- 016 and section 18.3 of the system reference, where exactly that guard turned
-- a column addition into a silent no-op.

ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS policy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS policy_version         text;

COMMENT ON COLUMN viewings.policy_acknowledged_at IS
  'When the guest ticked the deposit-terms acknowledgement. NULL means the viewing predates the requirement; it is set before the deposit is ever requested.';
COMMENT ON COLUMN viewings.policy_version IS
  'VIEWING_POLICY_VERSION shown at that moment. Without it the timestamp cannot say which terms were agreed.';
