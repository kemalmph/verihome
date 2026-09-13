import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminAction =
  | { action: "confirm";   scheduled_at: string }
  | { action: "attend" }
  | { action: "no_show" }
  | { action: "refund" };

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

  switch (body.action) {
    case "confirm": {
      if (!body.scheduled_at) {
        return NextResponse.json({ error: "scheduled_at required" }, { status: 400 });
      }
      const { data, error } = await admin
        .from("viewings")
        .update({
          status:       "confirmed",
          scheduled_at: body.scheduled_at,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ viewing: data });
    }

    case "attend": {
      // Mark attended and issue credit atomically via RPC
      const { error: attendError } = await admin
        .from("viewings")
        .update({ attended: true, attended_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "confirmed"); // guard: only confirmed viewings can be attended

      if (attendError) return NextResponse.json({ error: attendError.message }, { status: 500 });

      const { data: credit, error: creditError } = await admin.rpc("issue_viewing_credit", {
        p_viewing_id: id,
      });

      if (creditError) {
        // Non-fatal — credit issuance can be retried; viewing is already marked attended
        console.error("[viewings/attend] credit issuance failed:", creditError.message);
        return NextResponse.json({ attended: true, creditError: creditError.message });
      }

      return NextResponse.json({ attended: true, credit });
    }

    case "no_show": {
      const { data, error } = await admin
        .from("viewings")
        .update({
          attended: false,
          attended_at: new Date().toISOString(),
          status: "no_show",
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // Deposit is forfeited — no credit issued, no refund
      return NextResponse.json({ viewing: data, deposit: "forfeited" });
    }

    case "refund": {
      const { data: viewing } = await admin
        .from("viewings")
        .select("deposit_paid, deposit_refunded")
        .eq("id", id)
        .single();

      if (!viewing?.deposit_paid) {
        return NextResponse.json({ error: "No deposit to refund" }, { status: 409 });
      }
      if (viewing.deposit_refunded) {
        return NextResponse.json({ error: "Deposit already refunded" }, { status: 409 });
      }

      const { data, error } = await admin
        .from("viewings")
        .update({
          deposit_refunded:    true,
          deposit_refunded_at: new Date().toISOString(),
          status:              "cancelled",
          cancelled_at:        new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ viewing: data, deposit: "refunded" });
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
