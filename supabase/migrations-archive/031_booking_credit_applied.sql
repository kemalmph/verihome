-- 031: record on the booking how much credit was spent on it.
--
-- create_booking_with_credits takes p_credit_amount, marks the credits
-- redeemed, and then does not write the amount anywhere on the booking. So
-- bookings.credit_applied has always been 0, even for a booking paid partly in
-- credit, and the only record that credit was involved was the ledger entry.
--
-- That made two readers wrong:
--
--   postBookingRevenueEarned  computes total_price - credit_applied. Harmless
--                             at 0, but it double-subtracts the moment the
--                             column is real, because total_price is ALREADY
--                             net of credit.
--   integrity check 5         expects unearned_revenue to equal the cash side
--                             only, while the ledger holds cash + credit. Any
--                             booking using credit would have reported a
--                             mismatch that was not one.
--
-- Writing the column makes the row describe what happened. The subtraction in
-- postBookingRevenueEarned is removed in the same change, because total_price
-- is the net figure and always was.
--
-- Same signature, so CREATE OR REPLACE genuinely replaces rather than
-- overloading — the trap from §18.2. Verified with pg_proc after applying.

CREATE OR REPLACE FUNCTION public.create_booking_with_credits(
  p_property_id uuid, p_user_id uuid, p_check_in date, p_check_out date,
  p_guests integer, p_price_per_night numeric, p_cleaning_fee numeric,
  p_gross_price numeric, p_credit_amount numeric, p_total_price numeric,
  p_transfer_code text, p_expires_hours integer DEFAULT 48
)
RETURNS bookings
LANGUAGE plpgsql
AS $function$
DECLARE
  v_booking bookings; v_code TEXT; v_buffer INT; v_hex TEXT;
  v_credit user_credits%ROWTYPE; v_remaining NUMERIC := p_credit_amount;
  v_deduct NUMERIC; v_avail_total NUMERIC;
BEGIN
  v_hex := replace(p_property_id::text,'-','');
  PERFORM pg_advisory_xact_lock(('x'||left(v_hex,8))::bit(32)::int,('x'||right(v_hex,8))::bit(32)::int);

  IF p_credit_amount > 0 THEN
    SELECT COALESCE(SUM(amount),0) INTO v_avail_total
      FROM user_credits
     WHERE user_id = p_user_id AND redeemed_at IS NULL
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > now());
    IF v_avail_total < p_credit_amount THEN
      RAISE EXCEPTION 'insufficient_credits' USING ERRCODE='P0001';
    END IF;
  END IF;

  SELECT COALESCE(buffer_days,0) INTO v_buffer
    FROM short_stay_rates WHERE property_id=p_property_id AND active=true LIMIT 1;

  IF EXISTS(SELECT 1 FROM availability_blocks
             WHERE property_id=p_property_id
               AND start_date<p_check_out AND end_date+v_buffer>p_check_in
             FOR UPDATE) THEN
    RAISE EXCEPTION 'dates_unavailable' USING ERRCODE='P0001';
  END IF;

  v_code := generate_booking_code();

  INSERT INTO bookings(booking_code,property_id,user_id,check_in_date,check_out_date,
                       guests,price_per_night,cleaning_fee,total_price,credit_applied,
                       bank_transfer_code,expires_at)
  VALUES(v_code,p_property_id,p_user_id,p_check_in,p_check_out,
         p_guests,p_price_per_night,p_cleaning_fee,p_total_price,COALESCE(p_credit_amount,0),
         p_transfer_code,now()+(p_expires_hours||' hours')::interval)
  RETURNING * INTO v_booking;

  INSERT INTO availability_blocks(property_id,start_date,end_date,reason,booking_id)
  VALUES(p_property_id,p_check_in,p_check_out,'booked',v_booking.id);

  IF p_credit_amount > 0 THEN
    FOR v_credit IN
      SELECT * FROM user_credits
       WHERE user_id=p_user_id AND redeemed_at IS NULL
         AND status='active'
         AND (expires_at IS NULL OR expires_at>now())
       ORDER BY expires_at ASC NULLS LAST
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining<=0;
      v_deduct := LEAST(v_credit.amount, v_remaining);
      v_remaining := v_remaining - v_deduct;
      UPDATE user_credits SET redeemed_at=now(), booking_id=v_booking.id WHERE id=v_credit.id;
    END LOOP;
  END IF;

  RETURN v_booking;
END;$function$;
