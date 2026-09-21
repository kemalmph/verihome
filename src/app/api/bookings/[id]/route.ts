import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { postBookingPaymentReceived, postBookingRefundIssued } from "@/lib/ledger/events";

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

  // Read the prior state before writing: whether cash has already been booked
  // decides whether this change is a payment or a refund, and after the update
  // that information is gone.
  const { data: before } = await admin
    .from("bookings")
    .select("payment_status, status")
    .eq("id", id)
    .single();

  // Verifying payment IS confirmation. Without this a booking sits at 'pending'
  // while fully paid, and the completion cron — which only looks at 'confirmed'
  // — never runs it, so its revenue is never recognised. Done on the server so
  // it holds for every caller: the admin buttons, the gateway webhook, and
  // anything added later. An explicit status in the same request wins, so an
  // admin marking a booking paid and cancelled in one call still cancels it.
  const becomingPaid = update.payment_status === "paid" && before?.payment_status !== "paid";
  if (becomingPaid && before?.status === "pending" && update.status === undefined) {
    update.status       = "confirmed";
    update.confirmed_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Ledger ────────────────────────────────────────────────────────────────
  // Posted after the state change succeeds, and guarded so a repeated admin
  // action cannot double-post. A ledger failure is reported rather than
  // swallowed: the booking moved, so the books must be corrected by hand.
  let ledgerError: string | null = null;
  const wasPaid = before?.payment_status === "paid";
  const nowPaid = data.payment_status === "paid";

  try {
    if (!wasPaid && nowPaid) {
      await postBookingPaymentReceived(data, { createdBy: user.id });
    }

    // Cancelling a booking whose cash we hold means paying it back out.
    if (wasPaid && body.status === "cancelled" && before?.status !== "cancelled") {
      // Cash back is the cash paid, and total_price is already net of credit.
      // The credit half is returned as credit by restore_booking_credits below,
      // not as money — subtracting it here too refunded neither.
      const stayRefund    = Number(data.total_price ?? 0);
      const depositRefund = Number(data.security_deposit ?? 0);
      await postBookingRefundIssued(data, { stayRefund, depositRefund }, { createdBy: user.id });
    }
  } catch (err) {
    ledgerError = (err as Error).message;
    console.error("[bookings PATCH] ledger:", ledgerError);
  }

  // Restore credits if cancelling a booking that used them
  let creditRestoration: { restored: number; expired_skipped: number } | null = null;
  if (body.status === "cancelled") {
    const { data: cr } = await admin.rpc("restore_booking_credits", { p_booking_id: id });
    if (cr?.[0]) creditRestoration = cr[0];
  }

  return NextResponse.json({ booking: data, creditRestoration, ledgerError });
}
