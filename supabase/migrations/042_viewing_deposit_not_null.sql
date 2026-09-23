-- 042: a viewing deposit must have an amount.
--
-- The brief asked to fix a 200.000 default. There was none to fix: the column
-- has NO default (NULL), no migration ever set one, and every code path already
-- reads `VIEWING_DEPOSIT_AMOUNT ?? 50000`. The amount has come from the
-- application since migration 029's release.
--
-- What is actually wrong is the nullability. deposit_amount is nullable with no
-- default, and settle_viewing_deposit does COALESCE(deposit_amount, 0). So an
-- insert path that forgot the amount would create a viewing, take no money,
-- post nothing to the ledger, and look completely normal — the silent-failure
-- shape this codebase keeps producing (§19.9, §19.10, §19.11).
--
-- NOT NULL makes that loud at the moment it happens.
--
-- Deliberately NOT adding a column default. A default of 50.000 would be a
-- second place the price lives, free to drift from VIEWING_DEPOSIT_AMOUNT, and
-- the disagreement would surface as a guest quoted one figure and charged
-- another. One source of truth, and it is the application.

ALTER TABLE viewings
  ALTER COLUMN deposit_amount SET NOT NULL;

ALTER TABLE viewings DROP CONSTRAINT IF EXISTS viewings_deposit_amount_check;
ALTER TABLE viewings ADD CONSTRAINT viewings_deposit_amount_check
  CHECK (deposit_amount > 0);

COMMENT ON COLUMN viewings.deposit_amount IS
  'Set by the application from VIEWING_DEPOSIT_AMOUNT (default 50000). No column default on purpose: a second source for the price would be free to drift from the one the guest was quoted.';
