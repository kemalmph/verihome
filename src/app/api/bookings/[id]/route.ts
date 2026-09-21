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

  // ── Financial transitions go through settlement functions ──────────────────
  // Marking a booking paid, or cancelling a paid one, changes the row AND the
  // ledger. Those used to be two round trips, so a failed post left a booking
  // marked paid with nothing behind it. Each RPC now does both in one
  // transaction and is idempotent on replay.
  if (isAdmin && (body.payment_status === "paid" || body.status === "cancelled")) {
    try {
      if (body.status === "cancelled") {
        const { data, error } = await admin.rpc("settle_booking_cancellation", {
          p_booking_id: id, p_actor: user.id,
        });
        if (error) throw new Error(error.message);
        if (body.admin_notes) {
          await admin.from("bookings").update({ admin_notes: body.admin_notes }).eq("id", id);
        }
        return NextResponse.json({ booking: data, ledgerError: null });
      }

      const { data, error } = await admin.rpc("settle_booking_payment", {
        p_booking_id: id, p_actor: user.id,
      });
      if (error) throw new Error(error.message);
      if (body.admin_notes) {
        await admin.from("bookings").update({ admin_notes: body.admin_notes }).eq("id", id);
      }
      return NextResponse.json({ booking: data, ledgerError: null });
    } catch (err) {
      // Nothing was written — the row and the books are still in step.
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // ── Everything else is a plain field update with no money attached ─────────
  const update: Record<string, unknown> = {};

  if (isAdmin) {
    if (body.status)      update.status      = body.status;
    if (body.admin_notes) update.admin_notes = body.admin_notes;
    if (body.status === "confirmed") update.confirmed_at = new Date().toISOString();
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

  // Credit restoration moved inside settle_booking_cancellation, which is the
  // only path that cancels — it now happens in the same transaction as the
  // cancellation that entitles the guest to it.
  return NextResponse.json({ booking: data, ledgerError: null });
}
