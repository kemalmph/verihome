-- ============================================================================
-- A rate is a whole number of rupiah.
--
-- lettable_units.price is numeric(12,0), so writing Rp4.166.666,67 into it
-- stores 4166667. unit_reservations.unit_price had no scale, so the same
-- division stored 4166666.6666666665.
--
-- The two are the same kind of number — a rate, in rupiah — and they came out
-- two-thirds of a rupiah apart. The booking page compares the agreed rate to
-- the price list, so RO6 reported "di bawah price list" for a contract priced
-- at exactly the list. A difference of Rp0,67 presented as a discount.
--
-- Scale 0 on both. Indonesia does not transact in sen, and a rate carrying
-- fifteen decimal places is not precision, it is a floating-point artifact
-- wearing a currency symbol.
--
-- WHAT IS NOT ROUNDED: total_price, the contract value. RO6 is worth
-- Rp50.000.000 over the year; the monthly rate is the derived, displayed
-- figure and 12 x 4.166.667 = Rp50.000.004 is not the contract. The
-- authoritative number keeps its own column and its own precision.
-- ============================================================================

ALTER TABLE public.unit_reservations
  ALTER COLUMN unit_price TYPE numeric(12,0) USING round(unit_price);

COMMENT ON COLUMN public.unit_reservations.unit_price IS
  'The rate actually agreed in this contract, in whole rupiah, in the same period as the unit''s price list. Derived and rounded: total_price is the authoritative contract value, not this times the term.';
