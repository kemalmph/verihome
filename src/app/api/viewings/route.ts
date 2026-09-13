import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isBankTransfer } from "@/lib/payment";

const VIEWING_DEPOSIT = Number(process.env.VIEWING_DEPOSIT_AMOUNT ?? 200000);

// POST /api/viewings — request a property viewing
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    propertyId:    string;
    preferredDates: { date: string; time: string }[];  // e.g. [{date:"2026-02-10", time:"10:00"}]
    notes?:        string;
  };

  const { propertyId, preferredDates, notes } = body;
  if (!propertyId || !preferredDates?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const provider = getPaymentProvider();
  const intent   = await provider.createIntent({
    reference:   propertyId,
    amount:      VIEWING_DEPOSIT,
    description: "VeriHome viewing deposit",
    payerEmail:  user.email,
  });

  const transferCode = isBankTransfer(intent.action) ? intent.action.transferCode : null;

  const admin = createAdminClient();
  const { data: viewing, error } = await admin
    .from("viewings")
    .insert({
      property_id:        propertyId,
      user_id:            user.id,
      preferred_dates:    preferredDates,
      team_notes:         notes ?? null,
      deposit_amount:     VIEWING_DEPOSIT,
      bank_transfer_code: transferCode,
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
