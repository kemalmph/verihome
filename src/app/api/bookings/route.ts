import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isBankTransfer } from "@/lib/payment";
import { validateStayRules, calculatePrice, isRangeAvailable, getBufferDays } from "@/lib/availability";

// POST /api/bookings — create a new short-stay booking
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    propertyId:    string;
    checkIn:       string;
    checkOut:      string;
    guests:        number;
    creditAmount?: number;  // IDR credit to apply; must not exceed available balance
  };

  const { propertyId, checkIn, checkOut, guests, creditAmount = 0 } = body;
  if (!propertyId || !checkIn || !checkOut || !guests) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const inDate  = new Date(checkIn  + "T00:00:00Z");
  const outDate = new Date(checkOut + "T00:00:00Z");

  const [validation, bufferDays] = await Promise.all([
    validateStayRules(propertyId, inDate, outDate),
    getBufferDays(propertyId),
  ]);

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Quick pre-check with buffer (atomic RPC re-checks without buffer for the actual block)
  const available = await isRangeAvailable(propertyId, inDate, outDate, bufferDays);
  if (!available) {
    return NextResponse.json({ error: "Selected dates are not available" }, { status: 409 });
  }

  const quote = await calculatePrice(propertyId, inDate, outDate);
  if (!quote) {
    return NextResponse.json({ error: "Could not calculate price for this property" }, { status: 400 });
  }

  // Clamp credit to quote total so transfer amount is never negative
  const appliedCredit = Math.min(Math.round(creditAmount), quote.total);
  const transferTotal = quote.total - appliedCredit;

  const provider = getPaymentProvider();
  const intent = await provider.createIntent({
    reference:   propertyId,
    amount:      transferTotal,
    description: `VeriHome stay · ${checkIn} to ${checkOut}`,
    payerEmail:  user.email,
  });

  // Only a bank transfer carries a unique code. Under a redirecting provider
  // the record is matched by the provider's own reference instead.
  const transferCode = isBankTransfer(intent.action) ? intent.action.transferCode : null;

  const admin = createAdminClient();
  const rpc = appliedCredit > 0 ? "create_booking_with_credits" : "create_booking_if_available";
  const rpcArgs = appliedCredit > 0
    ? {
        p_property_id:     propertyId,
        p_user_id:         user.id,
        p_check_in:        checkIn,
        p_check_out:       checkOut,
        p_guests:          guests,
        p_price_per_night: quote.effectivePerNight,
        p_cleaning_fee:    quote.cleaningFee,
        p_gross_price:     quote.total,
        p_credit_amount:   appliedCredit,
        p_total_price:     transferTotal,
        p_transfer_code:   transferCode,
      }
    : {
        p_property_id:     propertyId,
        p_user_id:         user.id,
        p_check_in:        checkIn,
        p_check_out:       checkOut,
        p_guests:          guests,
        p_price_per_night: quote.effectivePerNight,
        p_cleaning_fee:    quote.cleaningFee,
        p_total_price:     transferTotal,
        p_transfer_code:   transferCode,
      };

  const { data: booking, error } = await admin.rpc(rpc, rpcArgs);

  // The RPC owns the atomic availability-check-and-insert and knows nothing
  // about payment, so the provider reference is stamped on afterwards. Only a
  // redirecting provider has one; manual transfers are matched by amount.
  if (!error && booking && !isBankTransfer(intent.action)) {
    await admin
      .from("bookings")
      .update({
        payment_provider:    intent.provider,
        payment_external_id: intent.action.externalId,
      })
      .eq("id", booking.id);
  }

  if (error) {
    if (error.message?.includes("dates_unavailable")) {
      return NextResponse.json({ error: "Selected dates are no longer available" }, { status: 409 });
    }
    if (error.message?.includes("insufficient_credits")) {
      return NextResponse.json({ error: "Insufficient credit balance" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    booking,
    intent,
    quote: {
      tier:            quote.tier,
      grossTotal:      quote.total,
      creditApplied:   appliedCredit,
      transferTotal,
      securityDeposit: quote.securityDeposit,
      checkInTime:     quote.checkInTime,
      checkOutTime:    quote.checkOutTime,
    },
  }, { status: 201 });
}

// GET /api/bookings — list user's own bookings
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const admin = createAdminClient();
  let query = admin
    .from("bookings")
    .select(`*, property:properties ( id, name, area, slug )`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data });
}
