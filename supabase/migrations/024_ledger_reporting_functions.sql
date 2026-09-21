-- Migration 024: reporting aggregates.
--
-- These live in SQL so every report shares one definition of each figure --
-- particularly GBV, which is the number most easily mistaken for revenue.

-- Gross Booking Value: cash actually received from guests in the period.
-- NOT revenue: most of it is owed onward to owners or returned as deposits.
CREATE OR REPLACE FUNCTION public.ledger_gbv(p_from timestamptz, p_to timestamptz)
RETURNS numeric LANGUAGE sql STABLE AS $function$
  SELECT COALESCE(SUM(amount), 0)
    FROM ledger_entries
   WHERE account = 'cash' AND direction = 'debit'
     AND event_type IN ('booking_payment_received',
                        'consultation_payment_received',
                        'viewing_deposit_received')
     AND (p_from IS NULL OR entry_date >= p_from)
     AND (p_to   IS NULL OR entry_date <  p_to);
$function$;

-- Revenue per income stream. Income rises on the credit side, so a reversing
-- entry reduces the stream rather than being counted twice.
CREATE OR REPLACE FUNCTION public.ledger_revenue_by_stream(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(account text, amount numeric, entry_count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT l.account,
         COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
       - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0),
         COUNT(*) FILTER (WHERE l.direction = 'credit')
    FROM ledger_entries l
   WHERE ledger_account_kind(l.account) = 'income'
     AND (p_from IS NULL OR l.entry_date >= p_from)
     AND (p_to   IS NULL OR l.entry_date <  p_to)
   GROUP BY l.account;
$function$;

-- Twelve months of revenue, one row per month per stream.
CREATE OR REPLACE FUNCTION public.ledger_monthly_revenue(p_months integer DEFAULT 12)
RETURNS TABLE(month date, account text, amount numeric)
LANGUAGE sql STABLE AS $function$
  SELECT date_trunc('month', l.entry_date)::date,
         l.account,
         COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
       - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
    FROM ledger_entries l
   WHERE ledger_account_kind(l.account) = 'income'
     AND l.entry_date >= date_trunc('month', now()) - make_interval(months => p_months - 1)
   GROUP BY 1, 2
   ORDER BY 1;
$function$;

-- Per-property contribution. Revenue and owner payable both come from the
-- ledger; nights are counted from the bookings themselves.
CREATE OR REPLACE FUNCTION public.ledger_property_performance(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(property_id uuid, revenue numeric, owner_payable numeric, gbv numeric, booking_count bigint)
LANGUAGE sql STABLE AS $function$
  SELECT l.property_id,
         COALESCE(SUM(CASE WHEN ledger_account_kind(l.account) = 'income'
                           THEN CASE WHEN l.direction='credit' THEN l.amount ELSE -l.amount END
                      END), 0),
         COALESCE(SUM(CASE WHEN l.account = 'owner_payable'
                           THEN CASE WHEN l.direction='credit' THEN l.amount ELSE -l.amount END
                      END), 0),
         COALESCE(SUM(CASE WHEN l.account='cash' AND l.direction='debit'
                            AND l.event_type IN ('booking_payment_received',
                                                 'consultation_payment_received',
                                                 'viewing_deposit_received')
                           THEN l.amount END), 0),
         COUNT(DISTINCT l.booking_id) FILTER (WHERE l.event_type = 'booking_payment_received')
    FROM ledger_entries l
   WHERE l.property_id IS NOT NULL
     AND (p_from IS NULL OR l.entry_date >= p_from)
     AND (p_to   IS NULL OR l.entry_date <  p_to)
   GROUP BY l.property_id;
$function$;
