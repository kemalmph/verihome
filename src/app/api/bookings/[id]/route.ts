import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/bookings/[id] — upload payment proof (user) or update status (admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("is_admin").eq("id", user.id).single();

  const body = await req.json() as Record<string, unknown>;
  const isAdmin = profile?.is_admin === true;

  // Build allowed update fields
  const update: Record<string, unknown> = {};

  if (isAdmin) {
    if (body.status)         update.status         = body.status;
    if (body.payment_status) update.payment_status = body.payment_status;
    if (body.admin_notes)    update.admin_notes    = body.admin_notes;
    if (body.status === "confirmed") update.confirmed_at = new Date().toISOString();
    if (body.status === "cancelled") update.cancelled_at = new Date().toISOString();
  } else {
    // Users can only upload payment proof (via dedicated route)
    if (body.payment_proof_url) {
      update.payment_proof_url = body.payment_proof_url;
      update.payment_status    = "pending_verification";
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Restore credits if cancelling a booking that used them
  let creditRestoration: { restored: number; expired_skipped: number } | null = null;
  if (body.status === "cancelled") {
    const { data: cr } = await admin.rpc("restore_booking_credits", { p_booking_id: id });
    if (cr?.[0]) creditRestoration = cr[0];
  }

  return NextResponse.json({ booking: data, creditRestoration });
}
