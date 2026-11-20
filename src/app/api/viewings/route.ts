import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isBankTransfer } from "@/lib/payment";
import { VIEWING_POLICY_VERSION } from "@/lib/viewings/policy";

const VIEWING_DEPOSIT = Number(process.env.VIEWING_DEPOSIT_AMOUNT ?? 50000);

// POST /api/viewings — request a property viewing
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    propertyId:     string;
    preferredDates?: { date: string; time: string }[];
    // The client sent these two instead of preferredDates, so every request
    // 400'd and no viewing could ever be created. Both shapes accepted now.
    preferredDate?:  string;
    preferredTime?:  string;
    notes?:         string;
    policyAcknowledged?: boolean;
    policyVersion?: string;
  };

  const { propertyId, notes } = body;

  const preferredDates =
    body.preferredDates?.length
      ? body.preferredDates
      : body.preferredDate && body.preferredTime
        ? [{ date: body.preferredDate, time: body.preferredTime }]
        : [];

  if (!propertyId || preferredDates.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Checked here, not only in the component. The deposit terms are the one
  // thing the guest must have seen before money is requested, and a client can
  // skip any screen it likes.
  if (body.policyAcknowledged !== true) {
    return NextResponse.json(
      { error: "Ketentuan deposit harus disetujui sebelum melanjutkan. / The deposit terms must be accepted first." },
      { status: 400 }
    );
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
      deposit_amount:      VIEWING_DEPOSIT,
      bank_transfer_code:  transferCode,
      payment_provider:    intent.provider,
      payment_external_id: isBankTransfer(intent.action) ? null : intent.action.externalId,
      status:              "pending",
      // Stamped server-side: the timestamp has to come from the moment the
      // request was accepted, not from whatever the client claims.
      policy_acknowledged_at: new Date().toISOString(),
      policy_version:         body.policyVersion ?? VIEWING_POLICY_VERSION,
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
