import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { postBookingRevenueEarned } from "@/lib/ledger/events";

// Cron: mark confirmed bookings as completed once check-out date has passed.
// This is the moment the service is delivered, so it is also the moment the
// stay stops being a liability and becomes revenue.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: toComplete } = await admin
    .from("bookings")
    .select(`
      id, property_id, user_id, total_price, cleaning_fee, credit_applied, payment_status,
      commission_pct,
      property:properties ( owner_id, platform_commission_pct, cleaning_fee_goes_to )
    `)
    .eq("status", "confirmed")
    .lte("check_out_date", today);

  if (!toComplete || toComplete.length === 0) {
    return NextResponse.json({ completed: 0, unsplit: [] });
  }

  const unsplit: string[] = [];
  const ledgerFailures: { id: string; error: string }[] = [];
  const completed: string[] = [];

  // One booking at a time: a ledger failure on one must not stop the rest, and
  // must not leave that booking marked completed with no revenue recognised.
  for (const b of toComplete) {
    const property = (b.property ?? {}) as {
      owner_id?: string | null;
      platform_commission_pct?: unknown;
      cleaning_fee_goes_to?: string | null;
    };

    try {
      // Only bookings whose cash actually arrived have unearned_revenue to
      // release. Completing an unpaid booking would debit a liability that was
      // never credited and push the ledger negative.
      if (b.payment_status === "paid") {
        const result = await postBookingRevenueEarned(
          b as Parameters<typeof postBookingRevenueEarned>[0],
          property
        );
        if (!result.split) unsplit.push(b.id);
      }

      await admin.from("bookings").update({ status: "completed" }).eq("id", b.id);
      completed.push(b.id);
    } catch (err) {
      ledgerFailures.push({ id: b.id, error: (err as Error).message });
      console.error(`[complete-bookings] ${b.id}:`, (err as Error).message);
    }
  }

  return NextResponse.json({
    completed: completed.length,
    // Revenue booked entirely to the owner because no commission rate is set.
    unsplit,
    ledgerFailures,
  });
}
