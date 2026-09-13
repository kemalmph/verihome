-- Migration 007: Tighten all IDR monetary columns to numeric(12,0)
-- IDR has no sub-unit in circulation. Fractional rupiah cannot be transferred
-- and breaks the manual payment matching flow.

-- bookings
ALTER TABLE bookings
  ALTER COLUMN total_price     TYPE numeric(12,0),
  ALTER COLUMN price_per_night TYPE numeric(12,0),
  ALTER COLUMN cleaning_fee    TYPE numeric(12,0);

-- short_stay_rates
ALTER TABLE short_stay_rates
  ALTER COLUMN price_per_night         TYPE numeric(12,0),
  ALTER COLUMN price_per_night_weekend TYPE numeric(12,0),
  ALTER COLUMN price_per_week          TYPE numeric(12,0),
  ALTER COLUMN price_per_month         TYPE numeric(12,0),
  ALTER COLUMN cleaning_fee            TYPE numeric(12,0),
  ALTER COLUMN security_deposit        TYPE numeric(12,0);

-- viewings
ALTER TABLE viewings
  ALTER COLUMN deposit_amount TYPE numeric(12,0);

-- user_credits
ALTER TABLE user_credits
  ALTER COLUMN amount TYPE numeric(12,0);
