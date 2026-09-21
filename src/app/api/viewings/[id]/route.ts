import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminAction =
  | { action: "confirm";         scheduled_at: string }
  | { action: "attend" }
  | { action: "no_show" }
  | { action: "request_refund" }   // admin intends to refund — creates a transfer obligation
  | { action: "confirm_refund" };  // admin confirms money was actually sent

// PATCH /api/viewings/[id] — admin lifecycle actions
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as AdminAction;

  // Every branch below changes a row AND posts ledger entries. Each settle_*
  // function does both in one transaction, so a failed post leaves the viewing
  // exactly as it was instead of marking a deposit received with nothing behind
  // it. All are idempotent: a repeated click returns the row, it does not post
  // again.
  const fail = (err: unknown) =>
    NextResponse.json({ error: (err as Error).message }, { status: 500 });

  switch (body.action) {
    case "confirm": {
      if (!body.scheduled_at) {
        return NextResponse.json({ error: "scheduled_at required" }, { status: 400 });
      }
      const { data, error } = await admin.rpc("settle_viewing_deposit", {
        p_viewing_id: id, p_scheduled_at: body.scheduled_at, p_actor: user.id,
      });
      if (error) return fail(error);
      return NextResponse.json({ viewing: data, deposit: "received", ledgerError: null });
    }

    case "attend": {
      // Attendance, the credit row and the ledger were three separate writes —
      // two chances to diverge. Now one.
      const { data, error } = await admin.rpc("settle_viewing_attendance", {
        p_viewing_id: id, p_actor: user.id,
      });
      if (error) return fail(error);
      return NextResponse.json({ ...(data as Record<string, unknown>), ledgerError: null });
    }

    case "no_show": {
      const { data, error } = await admin.rpc("settle_viewing_no_show", {
        p_viewing_id: id, p_actor: user.id,
      });
      if (error) return fail(error);
      return NextResponse.json({ viewing: data, deposit: "forfeited", ledgerError: null });
    }

    case "request_refund": {
      // Stage one records only an intention, so there is no money event and
      // nothing to keep atomic — a plain update is the honest implementation.
      const { data: viewing } = await admin
        .from("viewings")
        .select("deposit_paid, deposit_refunded, deposit_refund_requested_at")
        .eq("id", id)
        .single();

      if (!viewing?.deposit_paid) {
        return NextResponse.json({ error: "No deposit to refund" }, { status: 409 });
      }
      if (viewing.deposit_refunded) {
        return NextResponse.json({ error: "Deposit already refunded" }, { status: 409 });
      }
      if (viewing.deposit_refund_requested_at) {
        return NextResponse.json({ error: "Refund already requested — confirm once sent" }, { status: 409 });
      }

      const { data, error } = await admin
        .from("viewings")
        .update({
          deposit_refund_requested_at: new Date().toISOString(),
          status:      "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return fail(error);
      return NextResponse.json({ viewing: data, deposit: "refund_pending" });
    }

    case "confirm_refund": {
      // Cash actually leaves here, not at request_refund.
      const { data, error } = await admin.rpc("settle_viewing_refund", {
        p_viewing_id: id, p_actor: user.id,
      });
      if (error) return fail(error);
      return NextResponse.json({ viewing: data, deposit: "refunded", ledgerError: null });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

// GET /api/viewings/[id] — fetch single viewing (owner or admin)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users").select("is_admin").eq("id", user.id).single();

  const { data, error } = await admin
    .from("viewings")
    .select(`*, property:properties ( id, name, area, slug )`)
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!profile?.is_admin && data.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ viewing: data });
}
