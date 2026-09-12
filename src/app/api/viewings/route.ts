import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payment";

const VIEWING_DEPOSIT = Number(process.env.VIEWING_DEPOSIT_AMOUNT ?? 200000);

// POST /api/viewings — request a property viewing
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    propertyId:   string;
    preferredDate: string;  // ISO date string
    preferredTime: string;  // e.g. "10:00"
    notes?:       string;
  };

  const { propertyId, preferredDate, preferredTime, notes } = body;
  if (!propertyId || !preferredDate || !preferredTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const provider = getPaymentProvider();
  const intent   = await provider.createIntent(VIEWING_DEPOSIT);

  const admin = createAdminClient();
  const { data: viewing, error } = await admin
    .from("viewings")
    .insert({
      property_id:        propertyId,
      user_id:            user.id,
      preferred_date:     preferredDate,
      preferred_time:     preferredTime,
      notes:              notes ?? null,
      deposit_amount:     VIEWING_DEPOSIT,
      bank_transfer_code: intent.transferCode,
      status:             "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ viewing, intent }, { status: 201 });
}

// GET /api/viewings — list user's own viewings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("viewings")
    .select(`*, property:properties ( id, name, area, slug )`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ viewings: data });
}
