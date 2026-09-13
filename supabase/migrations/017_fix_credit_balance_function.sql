-- Migration 017: Make get_user_credit_balance count only spendable credit.
--
-- The original body summed every row for the user:
--
--   SELECT COALESCE(SUM(amount), 0) FROM user_credits WHERE user_id = p_user_id;
--
-- It predates redeemed_at and expires_at (added in 016), so it counted credit
-- that had already been spent, and credit that had expired, as available.
--
-- Nothing calls it today -- /api/credits filters in TypeScript and
-- create_booking_with_credits does its own filtered check inside the advisory
-- lock -- but it is a correct-looking helper with exactly the right name, and
-- the next caller would have got an inflated balance.
--
-- This definition now matches those two call sites exactly: a credit counts
-- only while it is unredeemed and unexpired. NULL expires_at means never.

CREATE OR REPLACE FUNCTION public.get_user_credit_balance(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(SUM(amount), 0)
    FROM user_credits
   WHERE user_id     = p_user_id
     AND redeemed_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());
$function$;
