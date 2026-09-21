-- Migration 025: expense and drawings accounts.
--
-- Without these the ledger could not record VeriHome spending its own money --
-- salaries, rent, tools, or a withdrawal by the founders. Every event type in
-- the original enum either left cash alone or moved it against a liability, so
-- spendable cash (W = cash - liabilities) could never fall. The overdraw
-- warning on the position statement was therefore unreachable: a smoke
-- detector in a house with nothing flammable.
--
-- 'equity_drawings' rather than 'owner_drawings': owner_payable already means
-- the property owner, and confusing the two in a financial system is expensive.

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_account_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_account_check CHECK (account IN (
  'cash','commission_receivable',
  'owner_payable','deposits_held','credits_outstanding','unearned_revenue',
  'revenue_booking_margin','revenue_consultation','revenue_cleaning',
  'revenue_commission','revenue_forfeited_deposit',
  'expense_operating','equity_drawings'
));

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_event_type_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_event_type_check CHECK (event_type IN (
  'booking_payment_received','booking_revenue_earned','booking_refund_issued',
  'consultation_payment_received','consultation_revenue_earned',
  'viewing_deposit_received','viewing_deposit_refunded','viewing_deposit_forfeited',
  'viewing_deposit_converted_to_credit',
  'security_deposit_received','security_deposit_refunded','security_deposit_claimed',
  'credit_issued','credit_redeemed','credit_expired',
  'owner_payout_due','owner_payout_paid',
  'placement_commission_earned','placement_commission_received',
  'cleaning_fee_received',
  'operating_expense_paid','equity_drawing_paid'
));

-- Expenses and drawings rise on the debit side, like assets. This replaces the
-- three-way version created in migration 020.
CREATE OR REPLACE FUNCTION public.ledger_account_kind(p_account text)
RETURNS text LANGUAGE sql IMMUTABLE AS $function$
  SELECT CASE
    WHEN p_account IN ('cash','commission_receivable') THEN 'asset'
    WHEN p_account IN ('owner_payable','deposits_held','credits_outstanding','unearned_revenue') THEN 'liability'
    WHEN p_account IN ('expense_operating','equity_drawings') THEN 'expense'
    ELSE 'income'
  END;
$function$;

-- Balance direction now keys on which side the account grows, not on
-- "is it an asset".
CREATE OR REPLACE FUNCTION public.ledger_balances(
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (account text, kind text, debits numeric, credits numeric, balance numeric)
LANGUAGE sql STABLE AS $function$
  SELECT
    l.account,
    ledger_account_kind(l.account),
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0),
    COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0),
    CASE WHEN ledger_account_kind(l.account) IN ('asset','expense')
      THEN COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
         - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
      ELSE COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'credit'), 0)
         - COALESCE(SUM(l.amount) FILTER (WHERE l.direction = 'debit'),  0)
    END
  FROM ledger_entries l
  WHERE (p_from IS NULL OR l.entry_date >= p_from)
    AND (p_to   IS NULL OR l.entry_date <  p_to)
  GROUP BY l.account;
$function$;
