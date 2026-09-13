import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    propertyId:              string;
    price_per_night:         number;
    price_per_night_weekend: number | null;
    price_per_week:          number | null;
    price_per_month:         number | null;
    min_nights:              number;
    max_nights:              number | null;
    cleaning_fee:            number;
    security_deposit:        number;
    check_in_time:           string;
    check_out_time:          string;
    buffer_days:             number;
    active:                  boolean;
  };

  if (!body.propertyId || !body.price_per_night) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await admin
    .from("short_stay_rates")
    .upsert(
      {
        property_id:             body.propertyId,
        price_per_night:         body.price_per_night,
        price_per_night_weekend: body.price_per_night_weekend ?? null,
        price_per_week:          body.price_per_week          ?? null,
        price_per_month:         body.price_per_month         ?? null,
        min_nights:              body.min_nights  ?? 1,
        max_nights:              body.max_nights  ?? null,
        cleaning_fee:            body.cleaning_fee   ?? 0,
        security_deposit:        body.security_deposit ?? 0,
        check_in_time:           body.check_in_time   ?? "14:00",
        check_out_time:          body.check_out_time  ?? "12:00",
        buffer_days:             body.buffer_days     ?? 0,
        active:                  body.active,
      },
      { onConflict: "property_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update publish checklist: rate is configured if there's an active rate with a price
  const rateComplete = body.active && body.price_per_night > 0;
  await admin
    .from("publish_checklist")
    .upsert(
      { property_id: body.propertyId, rental_mode_configured: rateComplete },
      { onConflict: "property_id" }
    );

  // Purge the listing page cache so rate changes appear immediately
  const { data: prop } = await admin.from("properties").select("slug").eq("id", body.propertyId).single();
  if (prop?.slug) revalidatePath(`/listings/${prop.slug}`);
  revalidatePath("/listings");

  return NextResponse.json({ success: true });
}
