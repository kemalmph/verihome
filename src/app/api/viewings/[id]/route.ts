import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  postViewingDepositReceived,
  postViewingDepositConvertedToCredit,
  postViewingDepositForfeited,
  postViewingDepositRefunded,
} from "@/lib/ledger/events";

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

  switch (body.action) {
    case "confirm": {
      if (!body.scheduled_at) {
        return NextResponse.json({ error: "scheduled_at required" }, { status: 400 });
      }

      // Only post if the deposit was not already confirmed — a second confirm
      // must not book the same cash twice.
      const { data: prior } = await admin
        .from("viewings").select("deposit_paid").eq("id", id).single();

      const { data, error } = await admin
        .from("viewings")
        .update({
          status:          "confirmed",
          scheduled_at:    body.scheduled_at,
          confirmed_at:    new Date().toISOString(),
          // Admin has verified the receipt — deposit is now confirmed
          deposit_paid:    true,
          deposit_paid_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      let ledgerError: string | null = null;
      if (prior?.deposit_paid !== true) {
        try {
          await postViewingDepositReceived(
            { id: data.id, property_id: data.property_id, user_id: data.user_id,
              amount: Number(data.deposit_amount ?? 0) },
            { createdBy: user.id }
          );
        } catch (err) {
          ledgerError = (err as Error).message;
          console.error("[viewings confirm] ledger:", ledgerError);
        }
      }
      return NextResponse.json({ viewing: data, ledgerError });
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
        const msg = creditError.message ?? "";
        // deposit_not_confirmed: admin hasn't verified the receipt yet — non-fatal,
        // attendance is recorded; credit will be issued once admin confirms the deposit.
        if (msg.includes("deposit_not_confirmed")) {
          return NextResponse.json({ attended: true, credit: null, note: "deposit not yet confirmed — credit pending" });
        }
        console.error("[viewings/attend] credit issuance failed:", msg);
        return NextResponse.json({ attended: true, creditError: msg });
      }

      // The RPC is idempotent and returns the existing row on a repeat call, so
      // post only when this call actually issued the credit.
      let ledgerError: string | null = null;
      const issued = credit as { id?: string; amount?: unknown; user_id?: string } | null;
      if (issued?.id) {
        const { data: already } = await admin
          .from("ledger_entries").select("id")
          .eq("viewing_id", id)
          .eq("event_type", "viewing_deposit_converted_to_credit")
          .limit(1);

        if (!already?.length) {
          const { data: v } = await admin
            .from("viewings").select("property_id, user_id").eq("id", id).single();
          try {
            await postViewingDepositConvertedToCredit(
              { id, property_id: v!.property_id, user_id: v!.user_id,
                amount: Number(issued.amount ?? 0) },
              { createdBy: user.id }
            );
          } catch (err) {
            ledgerError = (err as Error).message;
            console.error("[viewings/attend] ledger:", ledgerError);
          }
        }
      }

      return NextResponse.json({ attended: true, credit, ledgerError });
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

      // Deposit is forfeited — no credit issued, no refund. Forfeiture is the
      // one case where a deposit legitimately becomes revenue, and only if the
      // deposit was actually collected.
      let ledgerError: string | null = null;
      if (data.deposit_paid === true) {
        try {
          await postViewingDepositForfeited(
            { id: data.id, property_id: data.property_id, user_id: data.user_id,
              amount: Number(data.deposit_amount ?? 0) },
            { createdBy: user.id }
          );
        } catch (err) {
          ledgerError = (err as Error).message;
          console.error("[viewings no_show] ledger:", ledgerError);
        }
      }
      return NextResponse.json({ viewing: data, deposit: "forfeited", ledgerError });
    }

    case "request_refund": {
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

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // deposit_refunded stays false — transfer is pending
      return NextResponse.json({ viewing: data, deposit: "refund_pending" });
    }

    case "confirm_refund": {
      const { data: viewing } = await admin
        .from("viewings")
        .select("deposit_refund_requested_at, deposit_refunded")
        .eq("id", id)
        .single();

      if (!viewing?.deposit_refund_requested_at) {
        return NextResponse.json({ error: "No refund request to confirm" }, { status: 409 });
      }
      if (viewing.deposit_refunded) {
        return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
      }

      const { data, error } = await admin
        .from("viewings")
        .update({
          deposit_refunded:    true,
          deposit_refunded_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Cash actually leaves the account here, not at request_refund — which
      // records only the intention to pay it.
      let ledgerError: string | null = null;
      try {
        await postViewingDepositRefunded(
          { id: data.id, property_id: data.property_id, user_id: data.user_id,
            amount: Number(data.deposit_amount ?? 0) },
          { createdBy: user.id }
        );
      } catch (err) {
        ledgerError = (err as Error).message;
        console.error("[viewings confirm_refund] ledger:", ledgerError);
      }
      return NextResponse.json({ viewing: data, deposit: "refunded", ledgerError });
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
