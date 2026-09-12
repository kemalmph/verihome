import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payment";
import { validateStayRules, calculatePrice, isRangeAvailable } from "@/lib/availability";

// POST /api/bookings — create a new short-stay booking
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    propertyId: string;
    checkIn:    string;
    checkOut:   string;
    guests:     number;
  };

  const { propertyId, checkIn, checkOut, guests } = body;
  if (!propertyId || !checkIn || !checkOut || !guests) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const inDate  = new Date(checkIn  + "T00:00:00Z");
  const outDate = new Date(checkOut + "T00:00:00Z");

  // Validate rules
  const validation = await validateStayRules(propertyId, inDate, outDate);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Quick availability check (the atomic RPC does it again with a lock)
  const available = await isRangeAvailable(propertyId, inDate, outDate);
  if (!available) {
    return NextResponse.json({ error: "Selected dates are not available" }, { status: 409 });
  }

  // Calculate price
  const quote = await calculatePrice(propertyId, inDate, outDate);
  if (!quote) {
    return NextResponse.json({ error: "Could not calculate price for this property" }, { status: 400 });
  }

  // Create payment intent
  const provider = getPaymentProvider();
  const intent   = await provider.createIntent(quote.total);

  // Atomic booking creation
  const admin = createAdminClient();
  const { data: booking, error } = await admin.rpc("create_booking_if_available", {
    p_property_id:     propertyId,
    p_user_id:         user.id,
    p_check_in:        checkIn,
    p_check_out:       checkOut,
    p_guests:          guests,
    p_price_per_night: quote.pricePerNight,
    p_cleaning_fee:    quote.cleaningFee,
    p_total_price:     quote.total,
    p_transfer_code:   intent.transferCode,
  });

  if (error) {
    if (error.message?.includes("dates_unavailable")) {
      return NextResponse.json({ error: "Selected dates are no longer available" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking, intent }, { status: 201 });
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
    .select(`
      *,
      property:properties ( id, name, area, slug )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data });
}
